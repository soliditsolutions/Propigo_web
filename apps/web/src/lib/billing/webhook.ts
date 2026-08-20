/**
 * Recepción de webhooks de pasarela — ADR-0014, fila P-A3.
 *
 * La lógica vive acá (y no en el route handler) para poder testearla sin
 * levantar Next: el handler queda como una cáscara delgada que traduce
 * Request → resultado → Response.
 *
 * Reglas que guían el diseño:
 *
 * 1. **Verificar la firma antes de creerle NADA al payload.** Es un endpoint
 *    público que mueve plata; sin firma válida el cuerpo es texto de un
 *    desconocido.
 * 2. **Guardar el evento crudo antes de procesarlo.** Si el procesamiento
 *    falla queremos poder reconstruir qué dijo el proveedor exactamente, no
 *    nuestra interpretación de lo que dijo.
 * 3. **El código HTTP le dice al proveedor si reintentar.** Los proveedores
 *    reenvían ante 5xx y se rinden ante 4xx. Devolver el código equivocado
 *    causa o bien un evento perdido para siempre, o bien un reenvío infinito.
 */
import type { BillingGateway } from "./gateway";
import { prisma } from "../db";

/**
 * Tope de tamaño del cuerpo. Un webhook legítimo son unos pocos KB; aceptar
 * megabytes de un endpoint público y sin autenticar es un vector de abuso
 * gratuito. Se corta ANTES de verificar la firma porque firmar un cuerpo
 * enorme también cuesta CPU.
 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * Ventana de anti-replay. Un evento con timestamp más viejo que esto se
 * descarta aunque la firma sea válida: alguien que capture un webhook
 * legítimo no debe poder reinyectarlo semanas después. Es holgada a propósito
 * — los proveedores reintentan durante horas cuando nuestro servidor está
 * caído, y esos reintentos SÍ son legítimos.
 */
const VENTANA_REPLAY_MS = 24 * 60 * 60 * 1000;

export type ResultadoWebhook = {
  /** Código HTTP a devolver. Determina si el proveedor reintenta. */
  status: number;
  /** Cuerpo de la respuesta. Nunca incluye detalle interno. */
  body: { ok: boolean; detalle: string };
};

const RESPUESTAS = {
  aceptado:    { status: 200, body: { ok: true,  detalle: "procesado" } },
  duplicado:   { status: 200, body: { ok: true,  detalle: "duplicado" } },
  muyGrande:   { status: 413, body: { ok: false, detalle: "cuerpo demasiado grande" } },
  sinFirma:    { status: 401, body: { ok: false, detalle: "firma invalida" } },
  ilegible:    { status: 400, body: { ok: false, detalle: "payload ilegible" } },
  expirado:    { status: 400, body: { ok: false, detalle: "evento fuera de ventana" } },
  errorInterno:{ status: 500, body: { ok: false, detalle: "error interno" } },
} as const satisfies Record<string, ResultadoWebhook>;

/**
 * Procesa un webhook entrante.
 *
 * @param gateway  adaptador del proveedor (verifica firma y normaliza el evento)
 * @param cuerpoCrudo  cuerpo TAL CUAL llegó — no re-serializado: la firma se
 *                     calcula sobre los bytes exactos y cualquier round-trip
 *                     por `JSON.parse`/`stringify` la invalida
 * @param headers  headers de la request, en minúsculas
 * @param ahora  inyectable para poder testear la ventana de replay
 */
export async function procesarWebhook(
  gateway: BillingGateway,
  cuerpoCrudo: string,
  headers: Record<string, string>,
  ahora: Date = new Date(),
): Promise<ResultadoWebhook> {
  if (Buffer.byteLength(cuerpoCrudo, "utf8") > MAX_BODY_BYTES) {
    return RESPUESTAS.muyGrande;
  }

  // Firma primero: todo lo de abajo asume que el cuerpo es confiable.
  if (!gateway.verificarFirmaWebhook(cuerpoCrudo, headers)) {
    return RESPUESTAS.sinFirma;
  }

  const evento = gateway.parsearEvento(cuerpoCrudo);
  if (!evento) {
    // Firma válida pero no entendemos el contenido. Es 400, no 500: reintentar
    // el mismo payload daría exactamente el mismo resultado.
    return RESPUESTAS.ilegible;
  }

  const antiguedadMs = ahora.getTime() - evento.ocurridoEn.getTime();
  if (antiguedadMs > VENTANA_REPLAY_MS) {
    return RESPUESTAS.expirado;
  }

  try {
    // Guardar el crudo es lo que hace que esto sea idempotente: el UNIQUE de
    // `idExterno` convierte un reenvío en una violación de constraint, que se
    // traduce en "ya lo tenía" en vez de en un segundo procesamiento.
    await prisma.eventoGatewayPago.create({
      data: {
        proveedor: gateway.nombre,
        idExterno: evento.idExterno,
        tipo: evento.tipo,
        payload: JSON.parse(cuerpoCrudo) as object,
      },
    });
  } catch (e) {
    if (esViolacionDeUnico(e)) {
      // Ya lo recibimos antes. 200 para que el proveedor deje de reenviar:
      // desde su punto de vista el evento está entregado, y lo está.
      return RESPUESTAS.duplicado;
    }
    // Cualquier otra cosa (base caída, etc.) sí merece reintento del proveedor.
    throw e;
  }

  // El evento quedó persistido y es nuevo. El procesamiento de negocio
  // (acreditar el cargo, marcar la suscripción, devengar comisión) llega en
  // las fases B–E; acá se cierra el ciclo de recepción, que es lo que P-A3
  // tiene que garantizar. `procesadoEn` queda null hasta que exista ese
  // consumidor — así se distingue "recibido" de "aplicado" sin inventar un
  // estado que todavía no significa nada.
  return RESPUESTAS.aceptado;
}

/**
 * Detecta el error de clave duplicada de Postgres (código 23505) sin depender
 * del tipo de error de Prisma, que cambia entre versiones mayores. Se mira
 * tanto `code` (Prisma expone P2002) como el código nativo.
 */
function esViolacionDeUnico(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const code = (e as { code?: unknown }).code;
  return code === "P2002" || code === "23505";
}

export const _internals = { MAX_BODY_BYTES, VENTANA_REPLAY_MS, RESPUESTAS };
