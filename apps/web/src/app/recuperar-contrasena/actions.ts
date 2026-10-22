"use server";

import { prisma }                      from "@/lib/db";
import { generateResetToken, hashToken } from "@/lib/token";
import { sendPasswordResetEmail }       from "@/lib/email";
import { logError } from "@/lib/logger";
import { headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";

// Cada solicitud válida envía un correo: sin tope, cualquiera podía inundar de
// correos de recuperación una dirección ajena (y cargarnos el costo de envío).
// Por correo: 3 cada 15 min. Por IP: 10 cada 15 min (frena barrer direcciones).
const VENTANA_MS     = 15 * 60_000;
const MAX_POR_CORREO = 3;
const MAX_POR_IP     = 10;

export type RecuperarState = { sent: true } | { error: string } | null;

export async function recuperarAction(
  _prev: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  // Tiempo mínimo de respuesta — previene timing attacks (CWE-208) para
  // que el atacante no pueda determinar si el email existe midiendo la latencia.
  const start      = Date.now();
  const MIN_MS     = 500;

  // Ambos contadores avanzan siempre (evaluados sin cortocircuito), y al
  // superarlos la respuesta es la misma de siempre: un límite distinto
  // revelaría qué correos tienen cuenta.
  const ip        = getClientIpFromHeaders(await headers());
  const porIp     = checkRateLimit(`recuperar_ip:${ip}`, MAX_POR_IP, VENTANA_MS).allowed;
  const porCorreo = checkRateLimit(`recuperar_correo:${email}`, MAX_POR_CORREO, VENTANA_MS).allowed;
  const permitido = porIp && porCorreo;

  try {
    // Siempre generar + hashear un token (equaliza el tiempo de cómputo)
    const rawToken  = generateResetToken();
    const tokenHash = await hashToken(rawToken);

    // ADR-0011 Fase 2: búsqueda por email cross-tenant vía función SECURITY
    // DEFINER — mismo motivo y mismo patrón que login (ver auth/actions.ts).
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM auth_lookup_usuario_by_email(${email})
    `;
    const user = rows[0] ?? null;

    if (user && permitido) {
      // Invalidar tokens previos sin usar para este usuario
      await prisma.resetToken.deleteMany({
        where: { usuarioId: user.id, usadoEn: null },
      });

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

      await prisma.resetToken.create({
        data: { usuarioId: user.id, tokenHash, expiresAt },
      });

      await sendPasswordResetEmail(email, rawToken);
    }
    // Si el usuario no existe: el hash ya fue computado (timing uniforme),
    // simplemente no persistimos nada ni enviamos email.
  } catch (err) {
    // Loguear internamente pero NO exponer detalles al cliente
    logError("recuperar-contrasena", err);
  }

  // Garantizar respuesta mínima para neutralizar timing attacks
  const elapsed = Date.now() - start;
  if (elapsed < MIN_MS) {
    await new Promise((r) => setTimeout(r, MIN_MS - elapsed));
  }

  // Respuesta siempre idéntica (anti-enumeración de cuentas — OWASP A07)
  return { sent: true };
}
