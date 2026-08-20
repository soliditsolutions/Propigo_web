/**
 * POST /api/portal/verificar-otp
 * Valida el código OTP y emite una sesión JWT de solo lectura (ADR-0007).
 *
 * SEGURIDAD:
 * - El código se verifica contra el hash almacenado (SHA-256 + AUTH_SECRET).
 * - Máx 5 intentos por OTP; tras agotar, el OTP queda bloqueado.
 * - OTP de un solo uso: se marca `usadoEn` al verificar correctamente.
 * - Sesión JWT firmada con prefijo "portal:" para separar del dominio de panel.
 * - Audit log en acceso_log — Ley 19.628 / 21.719.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant-db";
import { signPortalSession, setPortalCookie } from "@/lib/portal-auth";
import { getClientIp } from "@/lib/ip";
import { logError } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

function hashOtp(codigo: string): string {
  const salt = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(codigo + salt).digest("hex");
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // IP-based rate limiting: 10 intentos/min. Previene ataques de fuerza bruta por OTP.
  const rl = checkRateLimit(`portal_verificar:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body    = await req.json().catch(() => null);
    const otpId   = typeof body?.otpId  === "string" ? body.otpId.trim()  : null;
    const codigo  = typeof body?.codigo === "string" ? body.codigo.trim() : null;

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!otpId || !codigo || !/^\d{6}$/.test(codigo) || !UUID_RE.test(otpId)) {
      return NextResponse.json({ ok: false, error: "Datos inválidos.", errorCode: "AGOTADO" }, { status: 400 });
    }

    // ADR-0011 Fase 2: el otpId es el credencial en sí — no sabemos su tenant
    // hasta resolverlo, así que la carga inicial usa la función SECURITY
    // DEFINER de solo lectura (setup.sql); las escrituras de más abajo ya
    // conocen el tenant y usan withTenant() normalmente.
    const otpRows = await prisma.$queryRaw<{
      id: string; tenant_id: string; persona_id: string; propiedad_id: string;
      codigo_hash: string; expira_en: Date; intentos: number;
      max_intentos: number; usado_en: Date | null;
    }[]>`SELECT * FROM portal_lookup_acceso_otp(${otpId}::uuid)`;
    const otpRow = otpRows[0];
    const otp = otpRow ? {
      id: otpRow.id, tenantId: otpRow.tenant_id, personaId: otpRow.persona_id,
      propiedadId: otpRow.propiedad_id, codigoHash: otpRow.codigo_hash,
      expiraEn: otpRow.expira_en, intentos: otpRow.intentos,
      maxIntentos: otpRow.max_intentos, usadoEn: otpRow.usado_en,
    } : null;

    const ahora = new Date();

    // Verificaciones separadas para dar feedback preciso al cliente:
    // AGOTADO, EXPIRADO e INCORRECTO tienen UX distintas.
    if (!otp) {
      return NextResponse.json(
        { ok: false, error: "Código no encontrado.", errorCode: "AGOTADO" },
        { status: 400 },
      );
    }
    if (otp.usadoEn !== null || otp.intentos >= otp.maxIntentos) {
      return NextResponse.json(
        { ok: false, error: "Has agotado los intentos. Solicita un nuevo código.", errorCode: "AGOTADO" },
        { status: 400 },
      );
    }
    if (otp.expiraEn < ahora) {
      return NextResponse.json(
        { ok: false, error: "El código expiró. Solicita uno nuevo en el portal.", errorCode: "EXPIRADO" },
        { status: 400 },
      );
    }

    // Verificar el código
    const codigoHashIngresado = hashOtp(codigo);
    if (codigoHashIngresado !== otp.codigoHash) {
      // Incremento atómico (SET intentos = intentos + 1 en una sola sentencia SQL):
      // dos verificaciones paralelas con el mismo otpId no deben poder leer el
      // mismo `otp.intentos` y pisarse el conteo, lo que permitiría más intentos
      // de fuerza bruta que maxIntentos.
      const actualizado = await withTenant(otp.tenantId, (tx) => tx.accesoOtp.update({
        where: { id: otpId },
        data:  { intentos: { increment: 1 } },
        select: { intentos: true, maxIntentos: true },
      }));
      const restantes = actualizado.maxIntentos - actualizado.intentos;
      return NextResponse.json(
        {
          ok:                false,
          errorCode:         restantes > 0 ? "INCORRECTO" : "AGOTADO",
          intentosRestantes: Math.max(0, restantes),
          error:             restantes > 0
            ? `Código incorrecto. Te quedan ${restantes} intento${restantes !== 1 ? "s" : ""}.`
            : "Has agotado los intentos. Solicita un nuevo código.",
        },
        { status: 400 },
      );
    }

    // ── OTP válido ───────────────────────────────────────────────────────────

    const contrato = await withTenant(otp.tenantId, async (tx) => {
      // Marcar como usado
      await tx.accesoOtp.update({
        where: { id: otpId },
        data: { usadoEn: ahora, intentos: otp.intentos + 1 },
      });

      // Determinar el rol: arrendatario tiene prioridad
      return tx.contrato.findFirst({
        where: {
          tenantId:    otp.tenantId,
          propiedadId: otp.propiedadId,
          OR: [
            { arrendatarioId: otp.personaId },
            { propietarioId:  otp.personaId },
          ],
          estado: { in: ["vigente", "terminado", "terminado_anticipado"] },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, arrendatarioId: true },
      });
    });

    if (!contrato) {
      return NextResponse.json(
        { ok: false, error: "No se encontró un contrato activo para esta propiedad." },
        { status: 404 },
      );
    }

    const rol: "arrendatario" | "propietario" =
      contrato.arrendatarioId === otp.personaId ? "arrendatario" : "propietario";

    // Emitir JWT de sesión portal
    const token = await signPortalSession({
      personaId:   otp.personaId,
      propiedadId: otp.propiedadId,
      tenantId:    otp.tenantId,
      rol,
    });
    await setPortalCookie(token);

    // Audit log — Ley 19.628 / 21.719
    await withTenant(otp.tenantId, (tx) => tx.accesoLog.create({
      data: {
        tenantId:  otp.tenantId,
        personaId: otp.personaId,
        accion:    "portal_acceso_verificado",
        ip,
      },
    }));

    return NextResponse.json({
      ok:         true,
      redirectTo: `/portal/contrato/${contrato.id}`,
    });
  } catch (e) {
    logError("verificar-otp", e);
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}
