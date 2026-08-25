"use server";

import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { verificarTokenBaja, calcularBajaHasta } from "@/lib/notificacion-preferencias";
import { headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Rate limit de la superficie pública.
 *
 * /no-molestar es la única ruta de esta función sin sesión: cualquiera en
 * internet puede invocar estas acciones. El token firmado impide actuar sobre
 * una persona ajena, pero no impide martillar el endpoint — y cada intento
 * válido escribe en la base. El resto de las rutas públicas del proyecto
 * (OTP del portal, subida, valoraciones) ya se protegen así; esta no lo hacía.
 *
 * Los límites son holgados para un uso legítimo: nadie se da de baja veinte
 * veces por minuto, pero abrir el enlace y corregir la elección un par de
 * veces es perfectamente normal.
 */
const LIMITE_ESCRITURA = { max: 10, ventanaMs: 10 * 60 * 1000 };
const LIMITE_LECTURA   = { max: 30, ventanaMs: 10 * 60 * 1000 };

async function limitar(prefijo: string, max: number, ventanaMs: number): Promise<boolean> {
  const ip = getClientIpFromHeaders(await headers());
  return checkRateLimit(`${prefijo}:${ip}`, max, ventanaMs).allowed;
}

export type ResultadoBaja =
  | { ok: true; permanente: boolean; hasta: string | null; total: boolean }
  | { ok: false; error: string };

/**
 * Registra la baja pedida desde el enlace del pie de un correo.
 *
 * No hay sesión: la autorización es el token firmado, que solo permite darse
 * de baja y no leer ni modificar ningún otro dato (ver
 * lib/notificacion-preferencias.ts).
 *
 * Idempotente a propósito: si alguien hace clic dos veces, o vuelve al enlace
 * meses después, el resultado es el mismo. Un "ya te habías dado de baja" que
 * pareciera un error haría dudar de si la solicitud quedó registrada.
 */
export async function registrarBaja(
  token: string,
  duracion: string,
  alcance: string,
  motivo?: string,
): Promise<ResultadoBaja> {
  try {
    if (!(await limitar("baja", LIMITE_ESCRITURA.max, LIMITE_ESCRITURA.ventanaMs)))
      return { ok: false, error: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." };

    const payload = await verificarTokenBaja(token);
    if (!payload) return { ok: false, error: "Este enlace no es válido. Búscalo en el pie de cualquier aviso que te hayamos enviado." };

    if (alcance !== "solo_opcionales" && alcance !== "todos")
      return { ok: false, error: "Elige qué avisos quieres dejar de recibir." };

    let hasta: Date | null;
    try {
      hasta = calcularBajaHasta(duracion);
    } catch {
      return { ok: false, error: "Elige por cuánto tiempo quieres dejar de recibir los avisos." };
    }

    const { personaId, tenantId } = payload;

    // La persona debe existir en ese tenant. Si el token es válido pero la
    // persona ya no está, se responde igual que ante un token inválido: no
    // tiene sentido revelar qué ids existen.
    const existe = await withTenant(tenantId, (tx) =>
      tx.persona.findFirst({ where: { id: personaId, tenantId }, select: { id: true } }));
    if (!existe) return { ok: false, error: "Este enlace no es válido." };

    await withTenant(tenantId, (tx) => tx.preferenciaNotificacion.upsert({
      where:  { tenantId_personaId: { tenantId, personaId } },
      create: { tenantId, personaId, suscrito: false, bajaHasta: hasta, alcance, motivo: motivo?.slice(0, 300) || null },
      update: { suscrito: false, bajaHasta: hasta, alcance, motivo: motivo?.slice(0, 300) || null },
    }));

    return {
      ok: true,
      permanente: hasta === null,
      hasta: hasta ? hasta.toISOString() : null,
      total: alcance === "todos",
    };
  } catch (e) {
    logError("registrarBaja", e);
    return { ok: false, error: "No pudimos registrar tu solicitud. Intenta de nuevo en unos minutos." };
  }
}

/** Datos mínimos para mostrar el formulario sin exponer de más. */
export async function contextoBaja(token: string): Promise<{ ok: boolean; nombre?: string; corredora?: string }> {
  try {
    // Devuelve el nombre de la persona, así que también se limita: sin esto,
    // quien obtenga un token podría usarlo como sonda repetida contra la base.
    if (!(await limitar("baja-ctx", LIMITE_LECTURA.max, LIMITE_LECTURA.ventanaMs)))
      return { ok: false };

    const payload = await verificarTokenBaja(token);
    if (!payload) return { ok: false };

    const persona = await withTenant(payload.tenantId, (tx) =>
      tx.persona.findFirst({
        where: { id: payload.personaId, tenantId: payload.tenantId },
        select: { nombre: true },
      }));
    if (!persona) return { ok: false };

    // El nombre del tenant no está bajo el filtro de persona; se lee aparte.
    const tenant = await prisma.tenant.findUnique({
      where: { id: payload.tenantId }, select: { nombre: true },
    });

    return { ok: true, nombre: persona.nombre, corredora: tenant?.nombre };
  } catch (e) {
    logError("contextoBaja", e);
    return { ok: false };
  }
}
