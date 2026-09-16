/**
 * POST /api/portal/solicitar-otp
 * Genera un OTP de 6 dígitos para el portal de autoconsulta (ADR-0007).
 *
 * SEGURIDAD:
 * - Anti-enumeración: respuesta idéntica exista o no el RUT.
 * - Timing-safe: añade demora mínima fija para igualar tiempos de respuesta.
 * - Rate limiting: máx 5 solicitudes/min por IP + máx 3 por persona en 10 minutos.
 * - OTP hasheado con SHA-256 + AUTH_SECRET; nunca se guarda en texto claro.
 * - Ley 21.719: audit log en acceso_log.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant-db";
import { sendPortalOtpEmail } from "@/lib/email";
import { getClientIp } from "@/lib/ip";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { generarCodigo, hashCodigo as hashOtp } from "@/lib/codigo-verificacion";

/** Normaliza RUT a formato canónico sin puntos: "12345678-9" */
function normalizarRut(rut: string): string {
  const sinPuntos = rut.replace(/\./g, "").trim().toUpperCase();
  if (sinPuntos.includes("-")) return sinPuntos;
  return sinPuntos.slice(0, -1) + "-" + sinPuntos.slice(-1);
}

// Respuesta genérica anti-enumeración — SIEMPRE devuelve esta estructura
function respuestaGenerica(otpId: string) {
  return NextResponse.json({
    ok:      true,
    otpId,
    mensaje: "Si el RUT está registrado, recibirás un código en tu correo.",
  });
}

export async function POST(req: NextRequest) {
  // Tiempo mínimo de respuesta para igualar tiempos (timing-safe)
  const tiempoMinimo = new Promise<void>((r) => setTimeout(r, 600 + Math.random() * 400));

  const ip = getClientIp(req);

  // IP-based rate limiting: 5 solicitudes/min. Previene inundación de emails desde una IP.
  const rl = checkRateLimit(`portal_otp:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    await tiempoMinimo;
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Intenta en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json().catch(() => null);
    const rutRaw = typeof body?.rut === "string" ? body.rut : null;

    if (!rutRaw) {
      await tiempoMinimo;
      return respuestaGenerica(randomUUID());
    }

    const rut = normalizarRut(rutRaw);

    // ADR-0011 Fase 2: buscar persona por RUT es cross-tenant por diseño —
    // resuelto con una función SECURITY DEFINER de solo lectura (ver setup.sql).
    const rows = await prisma.$queryRaw<{
      persona_id: string; tenant_id: string; nombre: string; email: string | null;
      contrato_id: string | null; propiedad_id: string | null; direccion: string | null;
      rol: "arrendatario" | "propietario" | null;
    }[]>`SELECT * FROM portal_lookup_persona_por_rut(${rut})`;
    const persona = rows[0];

    // Si no existe o no tiene email o no tiene contrato activo → respuesta genérica
    if (!persona?.email || !persona.contrato_id) {
      await tiempoMinimo;
      return respuestaGenerica(randomUUID());
    }

    const { tenant_id: tenantId, propiedad_id: propiedadId, direccion, rol } = persona;

    // Rate limiting: máx 3 OTPs en 10 minutos por persona
    const hace10min = new Date(Date.now() - 10 * 60 * 1000);
    const recientes = await withTenant(tenantId, (tx) => tx.accesoOtp.count({
      where: { personaId: persona.persona_id, createdAt: { gt: hace10min } },
    }));
    if (recientes >= 3) {
      await tiempoMinimo;
      return respuestaGenerica(randomUUID()); // Rate limited (silently)
    }

    // Generar OTP de 6 dígitos
    const codigo     = generarCodigo();
    const codigoHash = hashOtp(codigo);
    const expiraEn   = new Date(Date.now() + 10 * 60 * 1000);

    const otp = await withTenant(tenantId, async (tx) => {
      // Invalidar OTPs previos no usados de esta persona
      await tx.accesoOtp.updateMany({
        where: {
          personaId: persona.persona_id,
          usadoEn:   null,
          expiraEn:  { gt: new Date() },
        },
        data: { expiraEn: new Date() },
      });

      const creado = await tx.accesoOtp.create({
        data: {
          tenantId,
          personaId:   persona.persona_id,
          propiedadId: propiedadId!,
          canal:       "email",
          codigoHash,
          expiraEn,
          ipSolicitud: ip,
          maxIntentos: 3,
        },
      });

      // Audit log — Ley 19.628 / 21.719
      await tx.accesoLog.create({
        data: {
          tenantId,
          personaId: persona.persona_id,
          accion:    "portal_otp_solicitado",
          ip,
        },
      });

      return creado;
    });

    // Enviar email (no bloquea si falla — el error se registra)
    await sendPortalOtpEmail(persona.email, persona.nombre, codigo, direccion!, rol!).catch((e) =>
      logError("sendPortalOtpEmail", e),
    );

    await tiempoMinimo;
    return respuestaGenerica(otp.id);
  } catch (e) {
    logError("solicitar-otp", e);
    await tiempoMinimo;
    return respuestaGenerica(randomUUID());
  }
}
