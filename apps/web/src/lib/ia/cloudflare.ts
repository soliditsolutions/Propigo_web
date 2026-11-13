/**
 * Cliente de Cloudflare Workers AI (endpoint compatible con OpenAI).
 *
 * Es el único punto de la plataforma que habla con una IA externa. La
 * verificación de cédula y la revisión de contratos pasan por acá, así que
 * cambiar de proveedor o de modelo es editar este archivo y las variables.
 *
 * - Credenciales por variable de entorno: nunca aparecen en un error ni en un log.
 * - Antes de cada llamada se revisa el tope diario de neuronas del flujo.
 * - Después de cada llamada se registra el consumo (solo cifras).
 * - No se activa AI Gateway ni su caché/registro: guardarían el contenido y
 *   romperían la retención cero que Cloudflare documenta.
 */
import { calcularNeuronas } from "./precios";
import { almacenPrisma, hayCupoIa, type AlmacenUsoIa, type FlujoIa } from "./uso";

export type ErrorIaCodigo =
  | "no_configurada"
  | "cupo_diario"
  | "timeout"
  | "limite_proveedor"
  | "http"
  | "respuesta_invalida";

/** Fallo de la IA externa. El mensaje nunca lleva credenciales ni contenido. */
export class ErrorIa extends Error {
  constructor(readonly codigo: ErrorIaCodigo, mensaje: string, readonly estadoHttp?: number) {
    super(mensaje);
    this.name = "ErrorIa";
  }
}

export type ParteMensaje =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type MensajeIa = { role: "system" | "user"; content: string | ParteMensaje[] };

export type OpcionesChat = {
  flujo: FlujoIa;
  modelo: string;
  mensajes: MensajeIa[];
  maxTokens: number;
  temperatura?: number;
  timeoutMs: number;
  /** Para pruebas. */
  fetchFn?: typeof fetch;
  almacen?: AlmacenUsoIa;
  env?: Record<string, string | undefined>;
};

export type RespuestaChat = {
  texto: string;
  uso: { tokensEntrada: number; tokensSalida: number; neuronas: number };
};

type Credenciales = { cuenta: string; token: string };

function credenciales(env: Record<string, string | undefined>): Credenciales | null {
  const cuenta = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  return cuenta && token ? { cuenta, token } : null;
}

/** Si están las dos variables de Cloudflare. */
export function iaConfigurada(env: Record<string, string | undefined> = process.env): boolean {
  return credenciales(env) !== null;
}

async function almacenPorDefecto(): Promise<AlmacenUsoIa> {
  const { prisma } = await import("@/lib/db");
  return almacenPrisma(prisma);
}

/**
 * Un registro de uso que falla no puede tumbar la llamada de IA ni esconder su
 * resultado: se intenta y, si no se logra, se sigue.
 */
async function registrarSinFallar(almacen: AlmacenUsoIa, fila: Parameters<AlmacenUsoIa["registrar"]>[0]): Promise<void> {
  try {
    await almacen.registrar(fila);
  } catch {
    // Solo se pierde una cifra de consumo.
  }
}

/**
 * Si el flujo todavía tiene tope diario. Para consultarlo ANTES de descontar el
 * cupo del plan del usuario: así un corte por demanda no le gasta una revisión.
 * Si el conteo falla se deja pasar (el corte real lo pone Cloudflare).
 */
export async function hayCupoDiarioIa(
  flujo: FlujoIa,
  env: Record<string, string | undefined> = process.env,
  almacen?: AlmacenUsoIa,
): Promise<boolean> {
  try {
    return await hayCupoIa(flujo, almacen ?? (await almacenPorDefecto()), new Date(), env);
  } catch {
    return true;
  }
}

export async function pedirChat(op: OpcionesChat): Promise<RespuestaChat> {
  const env = op.env ?? process.env;
  const cred = credenciales(env);
  if (!cred) throw new ErrorIa("no_configurada", "La IA no está configurada (faltan las variables de Cloudflare).");

  const almacen = op.almacen ?? (await almacenPorDefecto());

  if (!(await hayCupoDiarioIa(op.flujo, env, almacen))) throw new ErrorIa("cupo_diario", "Se alcanzó el tope diario de uso de la IA.");

  const fetchFn = op.fetchFn ?? fetch;
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cred.cuenta)}/ai/v1/chat/completions`;

  let res: Response;
  try {
    res = await fetchFn(url, {
      method: "POST",
      signal: AbortSignal.timeout(op.timeoutMs),
      headers: { Authorization: `Bearer ${cred.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: op.modelo,
        messages: op.mensajes,
        max_tokens: op.maxTokens,
        temperature: op.temperatura ?? 0,
      }),
    });
  } catch (e) {
    await registrarSinFallar(almacen, { flujo: op.flujo, modelo: op.modelo, tokensEntrada: 0, tokensSalida: 0, neuronas: 0, ok: false });
    const agotado = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ErrorIa(agotado ? "timeout" : "http", agotado ? "La IA no respondió a tiempo." : "No se pudo contactar a la IA.");
  }

  if (!res.ok) {
    await registrarSinFallar(almacen, { flujo: op.flujo, modelo: op.modelo, tokensEntrada: 0, tokensSalida: 0, neuronas: 0, ok: false });
    // 429: Cloudflare cortó por límite (por ejemplo, se acabaron las neuronas del día).
    throw new ErrorIa(
      res.status === 429 ? "limite_proveedor" : "http",
      `La IA respondió con error ${res.status}.`,
      res.status,
    );
  }

  let datos: {
    choices?: { message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  try {
    datos = await res.json();
  } catch {
    throw new ErrorIa("respuesta_invalida", "La IA devolvió una respuesta que no es JSON.");
  }

  const tokensEntrada = Number(datos.usage?.prompt_tokens) || 0;
  const tokensSalida = Number(datos.usage?.completion_tokens) || 0;
  const neuronas = calcularNeuronas(op.modelo, tokensEntrada, tokensSalida);
  await registrarSinFallar(almacen, { flujo: op.flujo, modelo: op.modelo, tokensEntrada, tokensSalida, neuronas, ok: true });

  const contenido = datos.choices?.[0]?.message?.content;
  if (typeof contenido !== "string" || !contenido.trim()) {
    throw new ErrorIa("respuesta_invalida", "La IA devolvió una respuesta vacía.");
  }
  return { texto: contenido.trim(), uso: { tokensEntrada, tokensSalida, neuronas } };
}
