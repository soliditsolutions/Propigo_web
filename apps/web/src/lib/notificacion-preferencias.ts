/**
 * Preferencias de notificación y control de volumen.
 *
 * Marco legal (Chile). El **art. 28 B de la Ley 19.496** obliga a que toda
 * comunicación promocional identifique al remitente e incluya una vía para
 * pedir la suspensión de los envíos; solicitada, quedan **prohibidos**. Los
 * avisos de arriendo son contractuales y no publicitarios, así que el artículo
 * no los alcanza de forma directa — pero la **Ley 21.719** (vigente desde el
 * 2026-12-01) reconoce el derecho de oposición del titular sobre sus datos, y
 * ofrecer la baja en todos los avisos es la lectura defendible de ambas.
 *
 * Decisión de producto asociada: la baja NO se ofrece en los correos de
 * seguridad (código de acceso al portal, verificación de dispositivo,
 * recuperación de contraseña). Dejar que alguien se "dé de baja" del código
 * con el que entra a su propia cuenta lo dejaría fuera del sistema, y esos
 * correos no son comunicaciones que él no pidió: son respuesta a una acción
 * suya de ese mismo minuto.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type BajaPayload = JWTPayload & {
  personaId: string;
  tenantId:  string;
};

/**
 * Tope de correos por persona y por día.
 *
 * Existe para que una carga masiva —varias alertas automáticas calzando el
 * mismo día, o un corredor que envía en ráfaga— no le llene el buzón al
 * arrendatario. Lo que excede no se descarta: queda pendiente y sale al día
 * siguiente, así que ningún aviso se pierde, solo se reparte.
 */
export const MAX_CORREOS_POR_DIA = 3;

function getSecretoBaja(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) throw new Error("AUTH_SECRET demasiado corto");
  // Prefijo de ámbito, igual que portal-auth: un token de baja jamás debe
  // servir como sesión, ni una sesión como token de baja.
  return new TextEncoder().encode("baja-notificaciones:" + raw);
}

/**
 * Token para el enlace de baja que viaja en el pie de cada correo.
 *
 * Sin expiración a propósito: el correo puede quedar archivado meses y el
 * enlace tiene que seguir funcionando. Un enlace de baja vencido obligaría a
 * la persona a buscar otra vía para ejercer un derecho que la ley le reconoce.
 * No expone nada: solo permite darse de baja, nunca leer ni modificar datos.
 */
export async function firmarTokenBaja(personaId: string, tenantId: string): Promise<string> {
  return new SignJWT({ personaId, tenantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(getSecretoBaja());
}

export async function verificarTokenBaja(token: string): Promise<BajaPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretoBaja());
    const p = payload as BajaPayload;
    if (!p.personaId || !p.tenantId) return null;
    return p;
  } catch {
    return null;
  }
}

export type Preferencia = {
  suscrito:  boolean;
  bajaHasta: Date | null;
} | null;

/**
 * ¿Corresponde enviarle a esta persona hoy?
 *
 * La ausencia de preferencia significa suscrito: así, una persona recién
 * incorporada recibe sus avisos sin depender de que el alta haya creado la
 * fila. Una baja temporal ya vencida vuelve a habilitar los envíos sola.
 */
export function puedeRecibir(pref: Preferencia, hoy: Date = new Date()): boolean {
  if (!pref) return true;
  if (pref.suscrito) return true;
  if (pref.bajaHasta === null) return false;             // permanente
  return hoy > pref.bajaHasta;                           // temporal ya vencida
}

/** Texto para la interfaz. Describe el estado sin obligar a interpretarlo. */
export function describirPreferencia(pref: Preferencia, hoy: Date = new Date()): string {
  if (puedeRecibir(pref, hoy)) return "Recibes los avisos por correo.";
  if (pref?.bajaHasta) {
    return `Pausados hasta el ${pref.bajaHasta.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}.`;
  }
  return "Diste de baja los avisos por correo.";
}

/** Duraciones que ofrece el formulario de baja. */
export const DURACIONES = [
  { clave: "1m",         etiqueta: "Un mes",           dias: 30 },
  { clave: "3m",         etiqueta: "Tres meses",       dias: 90 },
  { clave: "permanente", etiqueta: "De forma permanente", dias: null },
] as const;

export type ClaveDuracion = (typeof DURACIONES)[number]["clave"];

/**
 * Fecha de término de una baja. null = permanente.
 * Lanza ante una clave desconocida en vez de asumir permanente: equivocarse
 * hacia "permanente" silenciaría a alguien que solo pidió una pausa.
 */
export function calcularBajaHasta(clave: string, desde: Date = new Date()): Date | null {
  const d = DURACIONES.find((x) => x.clave === clave);
  if (!d) throw new Error(`Duración desconocida: ${clave}`);
  if (d.dias === null) return null;
  const hasta = new Date(desde);
  hasta.setUTCDate(hasta.getUTCDate() + d.dias);
  return hasta;
}
