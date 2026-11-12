/**
 * Canal público de ejercicio de derechos (L-DP7, Ley 21.719).
 *
 * Reglas puras: qué derechos existen, el plazo de respuesta, el folio y cuándo
 * una solicitud requiere aviso interno. Sin base de datos ni correo, para poder
 * probarlas sin nada de eso y para importarlas desde el formulario público.
 *
 * PLAZO (L-06): 30 días corridos desde el ingreso, prorrogable una vez en casos
 * justificados. Las fuentes consultadas coinciden en los 30 días y difieren en
 * cuánto dura la prórroga, así que el sistema **no automatiza la prórroga**: si
 * hace falta, la decide una persona y se avisa al titular. Falta que el abogado
 * confirme el artículo exacto; hasta entonces la política publica el plazo sin
 * citar artículo.
 */
import { randomInt } from "node:crypto";

export const DERECHOS = [
  { clave: "acceso",        etiqueta: "Acceso",                 ayuda: "Saber qué datos suyos tratamos y recibir una copia." },
  { clave: "rectificacion", etiqueta: "Rectificación",          ayuda: "Corregir datos inexactos o incompletos." },
  { clave: "supresion",     etiqueta: "Supresión",              ayuda: "Pedir que eliminemos sus datos cuando la ley lo permita." },
  { clave: "oposicion",     etiqueta: "Oposición",              ayuda: "Oponerse a un tratamiento de sus datos." },
  { clave: "portabilidad",  etiqueta: "Portabilidad",           ayuda: "Recibir sus datos en un formato estructurado y reutilizable." },
  { clave: "bloqueo",       etiqueta: "Bloqueo",                ayuda: "Suspender temporalmente el tratamiento de sus datos." },
] as const;

export type ClaveDerecho = (typeof DERECHOS)[number]["clave"];
export const CLAVES_DERECHO = DERECHOS.map((d) => d.clave) as [ClaveDerecho, ...ClaveDerecho[]];

export const etiquetaDerecho = (clave: string): string =>
  DERECHOS.find((d) => d.clave === clave)?.etiqueta ?? clave;

export const PLAZO_RESPUESTA_DIAS = 30;
/** Cuántos días antes del vencimiento empieza el aviso interno diario. */
export const DIAS_AVISO_PREVIO = 5;

const DIA_MS = 86_400_000;

export function calcularVencimiento(recibida: Date): Date {
  return new Date(recibida.getTime() + PLAZO_RESPUESTA_DIAS * DIA_MS);
}

/** Sin 0/O/1/I/L: el folio se lee por teléfono o se copia a mano. */
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generarFolio(ahora: Date = new Date()): string {
  let sufijo = "";
  for (let i = 0; i < 6; i++) sufijo += ALFABETO[randomInt(ALFABETO.length)];
  return `DER-${ahora.getUTCFullYear()}-${sufijo}`;
}

export type EstadoSolicitud = "recibida" | "en_proceso" | "respondida" | "rechazada";
const ABIERTAS: readonly string[] = ["recibida", "en_proceso"];

export type SolicitudParaAviso = {
  estado: string;
  venceAt: Date;
  avisadaAt: Date | null;
};

/**
 * Una solicitud abierta se avisa cuando faltan `DIAS_AVISO_PREVIO` días o menos
 * (o ya venció), y como mucho una vez cada 24 horas: el aviso diario no debe
 * volverse ruido que alguien aprende a ignorar.
 */
export function requiereAviso(s: SolicitudParaAviso, ahora: Date = new Date()): boolean {
  if (!ABIERTAS.includes(s.estado)) return false;
  if (s.venceAt.getTime() - ahora.getTime() > DIAS_AVISO_PREVIO * DIA_MS) return false;
  return !s.avisadaAt || ahora.getTime() - s.avisadaAt.getTime() >= DIA_MS;
}

/** Días que faltan (negativo si ya venció), redondeados hacia abajo. */
export function diasParaVencer(venceAt: Date, ahora: Date = new Date()): number {
  return Math.floor((venceAt.getTime() - ahora.getTime()) / DIA_MS);
}
