"use server";

/**
 * Canal público de ejercicio de derechos (L-DP7, Ley 21.719).
 *
 * Sin sesión: lo usa cualquier titular, sea o no parte de un contrato. Hace tres
 * cosas y nada más: registra la solicitud con su plazo, acusa recibo al titular
 * con el folio y avisa al buzón de privacidad. NO verifica identidad ni
 * entrega datos: eso se hace al responder, con una persona delante. Por eso la
 * respuesta no depende de si el RUT existe en la plataforma.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getClientIpFromHeaders } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { textoEspera } from "@/lib/espera";
import { logError } from "@/lib/logger";
import { canonicalRut, validateRut } from "@/lib/rut";
import { sendAcuseDerechoEmail, sendSolicitudDerechoAdminEmail } from "@/lib/email";
import { calcularVencimiento, CLAVES_DERECHO, etiquetaDerecho, generarFolio } from "@/lib/derechos";

const schema = z.object({
  derecho: z.enum(CLAVES_DERECHO, { message: "Elige el derecho que quieres ejercer." }),
  nombre:  z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  rut:     z.string().trim().refine((v) => validateRut(v), "El RUT no es válido."),
  email:   z.string().trim().toLowerCase().email("Escribe un correo válido.").max(120),
  detalle: z.string().trim().max(2000, "El detalle admite hasta 2000 caracteres.").optional(),
  acepta:  z.literal(true, { message: "Debes aceptar el uso de estos datos para atender tu solicitud." }),
});

export type ResultadoDerecho =
  | { ok: true; folio: string; venceAt: string }
  | { ok: false; error: string };

// Por IP frena la inundación; por RUT, que alguien llene la bandeja de privacidad
// a nombre de otro. Los dos límites son altos para una persona real.
const POR_IP  = { limite: 5, ventanaMs: 60 * 60_000 };
const POR_RUT = { limite: 3, ventanaMs: 24 * 60 * 60_000 };

export async function solicitarDerechoAction(entrada: unknown): Promise<ResultadoDerecho> {
  const parsed = schema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos ingresados." };
  const d = parsed.data;
  const rut = canonicalRut(d.rut);

  const ip = getClientIpFromHeaders(await headers());
  const porIp  = checkRateLimit(`derechos_ip:${ip}`, POR_IP.limite, POR_IP.ventanaMs);
  const porRut = checkRateLimit(`derechos_rut:${rut}`, POR_RUT.limite, POR_RUT.ventanaMs);
  const limitado = !porIp.allowed ? porIp : !porRut.allowed ? porRut : null;
  if (limitado && !limitado.allowed) {
    return {
      ok: false,
      error: `Enviaste varias solicitudes seguidas. Vuelve a intentarlo en ${textoEspera(String(limitado.retryAfter))}.`,
    };
  }

  const recibidaAt = new Date();
  const venceAt = calcularVencimiento(recibidaAt);
  const folio = generarFolio(recibidaAt);

  try {
    await prisma.solicitudDerecho.create({
      data: {
        folio, derecho: d.derecho, rut, nombre: d.nombre, email: d.email,
        detalle: d.detalle || null, ip, recibidaAt, venceAt,
      },
    });
  } catch (e) {
    logError("derechos/crear", e);
    return { ok: false, error: "No pudimos registrar tu solicitud. Inténtalo de nuevo en unos minutos, o escríbenos al correo de privacidad." };
  }

  // La solicitud ya quedó guardada: un fallo de correo no la invalida. El aviso
  // diario de plazos (cron) la recoge aunque el correo interno no haya salido.
  const derecho = etiquetaDerecho(d.derecho);
  await Promise.allSettled([
    sendAcuseDerechoEmail(d.email, { nombre: d.nombre, folio, derecho, venceAt }),
    sendSolicitudDerechoAdminEmail({
      folio, derecho, nombre: d.nombre, rut, email: d.email,
      detalle: d.detalle || null, ip, recibidaAt, venceAt,
    }),
  ]).then((rs) => rs.forEach((r) => r.status === "rejected" && logError("derechos/correo", r.reason)));

  return { ok: true, folio, venceAt: venceAt.toISOString() };
}
