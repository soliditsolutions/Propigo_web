"use server";

/**
 * Ejercicio de derechos de la Ley 21.719 desde el portal:
 *   · Rectificación de correo/teléfono (L-DP4) — con código de verificación.
 *   · Aviso de identidad incorrecta (nombre/RUT) — se deriva a la corredora,
 *     no es autoservicio (ver rectificacion-persona.ts).
 *   · Oposición al tratamiento (L-DP6) — pausa los avisos, con alcance
 *     elegido y quedando en el registro de solicitudes.
 *
 * Toda acción exige sesión de portal vigente y escribe solo sobre la persona
 * de esa sesión — nadie puede rectificar u oponerse en nombre de otro.
 */
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getPortalSession } from "@/lib/portal-auth";
import { withTenant } from "@/lib/tenant-db";
import { getClientIpFromHeaders } from "@/lib/ip";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarCodigo, hashCodigo } from "@/lib/codigo-verificacion";
import { sendCambioContactoCodeEmail } from "@/lib/email";
import {
  type CampoRectificable,
  esCampoRectificable,
  normalizarValorRectificacion,
  validarValorRectificacion,
  correoDeVerificacion,
} from "@/lib/rectificacion-persona";

export type ResultadoDerecho = { ok: true } | { ok: false; error: string };
export type ResultadoRectificacion = { ok: true; valorNuevo: string } | { ok: false; error: string };

async function sesionOError() {
  const session = await getPortalSession();
  if (!session) return null;
  return session;
}

/** Paso 1: pide el cambio, valida y envía el código de verificación. */
export async function solicitarRectificacionAction(
  campo: CampoRectificable,
  valorNuevoRaw: string,
): Promise<ResultadoDerecho> {
  const session = await sesionOError();
  if (!session) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar al portal." };
  if (!esCampoRectificable(campo)) return { ok: false, error: "Campo inválido." };
  const { personaId, tenantId } = session;

  const valorNuevo = normalizarValorRectificacion(campo, valorNuevoRaw ?? "");
  const errValor = validarValorRectificacion(campo, valorNuevo);
  if (errValor) return { ok: false, error: errValor };

  const ip = getClientIpFromHeaders(await headers());
  const rl = checkRateLimit(`rectificacion:${personaId}`, 5, 10 * 60_000);
  if (!rl.allowed) {
    return { ok: false, error: "Demasiadas solicitudes. Espera unos minutos e intenta de nuevo." };
  }

  try {
    const persona = await withTenant(tenantId, (tx) => tx.persona.findFirstOrThrow({
      where: { id: personaId, tenantId }, select: { nombre: true, email: true, telefono: true },
    }));

    if (campo === "telefono" && persona.telefono === valorNuevo) {
      return { ok: false, error: "Ya es tu teléfono actual." };
    }
    if (campo === "email" && persona.email === valorNuevo) {
      return { ok: false, error: "Ya es tu correo actual." };
    }

    const destino = correoDeVerificacion(campo, valorNuevo, persona.email);
    if (destino.error !== null) return { ok: false, error: destino.error };

    const codigo = generarCodigo();
    const codigoHash = hashCodigo(codigo);
    const expiraAt = new Date(Date.now() + 10 * 60 * 1000);

    await withTenant(tenantId, async (tx) => {
      await tx.codigoRectificacionPersona.deleteMany({
        where: { tenantId, personaId, campo, usadoAt: null },
      });
      await tx.codigoRectificacionPersona.create({
        data: { tenantId, personaId, campo, valorNuevo, codigoHash, expiraAt, ipSolicitud: ip },
      });
    });

    await sendCambioContactoCodeEmail(destino.correo, persona.nombre, codigo, campo, valorNuevo);
    return { ok: true };
  } catch (e) {
    logError("solicitarRectificacionAction", e);
    return { ok: false, error: "No se pudo enviar el código. Intenta de nuevo." };
  }
}

/** Paso 2: confirma el código y aplica el cambio. */
export async function confirmarRectificacionAction(
  campo: CampoRectificable,
  codigoIngresado: string,
): Promise<ResultadoRectificacion> {
  const session = await sesionOError();
  if (!session) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar al portal." };
  if (!esCampoRectificable(campo)) return { ok: false, error: "Campo inválido." };
  const { personaId, tenantId } = session;

  const codigo = (codigoIngresado ?? "").trim();
  if (!/^\d{6}$/.test(codigo)) return { ok: false, error: "El código debe tener 6 dígitos." };

  try {
    const ip = getClientIpFromHeaders(await headers());

    const resultado = await withTenant(tenantId, async (tx) => {
      const registro = await tx.codigoRectificacionPersona.findFirst({
        where:   { tenantId, personaId, campo, usadoAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (!registro) return { ok: false as const, error: "No hay código activo. Solicita uno nuevo." };
      if (registro.expiraAt <= new Date()) return { ok: false as const, error: "Tu código expiró. Solicita uno nuevo." };
      if (registro.intentos >= 3) return { ok: false as const, error: "Demasiados intentos. Solicita un nuevo código." };

      const { intentos } = await tx.codigoRectificacionPersona.update({
        where: { id: registro.id }, data: { intentos: { increment: 1 } }, select: { intentos: true },
      });

      if (registro.codigoHash !== hashCodigo(codigo)) {
        if (intentos >= 3) {
          await tx.codigoRectificacionPersona.update({ where: { id: registro.id }, data: { usadoAt: new Date() } });
          return { ok: false as const, error: "Demasiados intentos. Solicita un nuevo código." };
        }
        const restantes = 3 - intentos;
        return { ok: false as const, error: `Código incorrecto. ${restantes} intento${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""}.` };
      }

      await tx.persona.update({
        where: { id: personaId },
        data:  campo === "telefono" ? { telefono: registro.valorNuevo } : { email: registro.valorNuevo },
      });
      await tx.codigoRectificacionPersona.update({ where: { id: registro.id }, data: { usadoAt: new Date() } });
      await tx.solicitudDerechoPersona.create({
        data: { tenantId, personaId, derecho: "rectificacion", detalle: `${campo} → ${registro.valorNuevo}`, ip },
      });
      return { ok: true as const, valorNuevo: registro.valorNuevo };
    });

    if (resultado.ok) revalidatePath("/portal/mis-datos");
    return resultado;
  } catch (e) {
    logError("confirmarRectificacionAction", e);
    return { ok: false, error: "No se pudo aplicar el cambio. Intenta de nuevo." };
  }
}

/**
 * Nombre o RUT incorrectos: no es autoservicio (identidad). Deja constancia
 * para que la corredora lo corrija — L-DP4 exige un canal, no que todo campo
 * sea editable por la propia persona.
 */
export async function reportarIdentidadIncorrectaAction(detalle: string): Promise<ResultadoDerecho> {
  const session = await sesionOError();
  if (!session) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar al portal." };
  const { personaId, tenantId } = session;

  const texto = (detalle ?? "").trim().slice(0, 500);
  if (!texto) return { ok: false, error: "Cuéntanos qué dato está mal." };

  const ip = getClientIpFromHeaders(await headers());
  const rl = checkRateLimit(`identidad-persona:${personaId}`, 3, 60 * 60_000);
  if (!rl.allowed) return { ok: false, error: "Ya enviaste un aviso reciente. Tu corredora lo revisará." };

  try {
    await withTenant(tenantId, (tx) => tx.solicitudDerechoPersona.create({
      data: { tenantId, personaId, derecho: "identidad", detalle: texto, ip },
    }));
    return { ok: true };
  } catch (e) {
    logError("reportarIdentidadIncorrectaAction", e);
    return { ok: false, error: "No se pudo enviar el aviso. Intenta de nuevo." };
  }
}

/**
 * Oposición al tratamiento (L-DP6). Pausa los avisos —"solo_opcionales" deja
 * los del contrato (vencimientos, comprobantes); "todos" los detiene por
 * completo, incluidos esos—. Lo que es necesario para ejecutar el contrato
 * (cobros, comprobantes, el ledger) sigue tratándose: la Ley 21.719 no deja
 * que la oposición derrote una obligación contractual, y decirlo así es más
 * honesto que prometer un bloqueo total que el sistema no puede cumplir.
 */
export async function oponerseAlTratamientoAction(
  alcance: "solo_opcionales" | "todos",
  motivo?: string,
): Promise<ResultadoDerecho> {
  const session = await sesionOError();
  if (!session) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar al portal." };
  const { personaId, tenantId } = session;

  const ip = getClientIpFromHeaders(await headers());
  const motivoLimpio = motivo?.trim().slice(0, 500) || null;

  try {
    await withTenant(tenantId, async (tx) => {
      await tx.preferenciaNotificacion.upsert({
        where:  { tenantId_personaId: { tenantId, personaId } },
        create: { tenantId, personaId, suscrito: false, alcance, bajaHasta: null, motivo: motivoLimpio },
        update: { suscrito: false, alcance, bajaHasta: null, motivo: motivoLimpio },
      });
      await tx.solicitudDerechoPersona.create({
        data: { tenantId, personaId, derecho: "oposicion", detalle: `alcance=${alcance}${motivoLimpio ? ` · ${motivoLimpio}` : ""}`, ip },
      });
    });
    revalidatePath("/portal/mis-datos");
    return { ok: true };
  } catch (e) {
    logError("oponerseAlTratamientoAction", e);
    return { ok: false, error: "No pudimos registrar tu oposición. Intenta de nuevo." };
  }
}
