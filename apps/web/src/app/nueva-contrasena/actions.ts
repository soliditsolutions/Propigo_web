"use server";

import { redirect }       from "next/navigation";
import { prisma }         from "@/lib/db";
import { withTenant }     from "@/lib/tenant-db";
import { hashToken }      from "@/lib/token";
import { hashPassword }   from "@/lib/password";
import { evaluatePassword } from "@/lib/password-strength";

export type NuevaContrasenaState = { error: string } | null;

export async function nuevaContrasenaAction(
  _prev: NuevaContrasenaState,
  formData: FormData,
): Promise<NuevaContrasenaState> {
  const rawToken = formData.get("token")?.toString()    ?? "";
  const password = formData.get("password")?.toString() ?? "";

  if (!rawToken) {
    return { error: "Enlace de recuperación inválido. Solicita uno nuevo." };
  }

  // Verificar token en DB (re-validación defensiva — podría haber expirado entre
  // el page load y el submit del formulario). Se resuelve antes del chequeo
  // de fuerza para poder rechazar una contraseña que contenga la propia
  // información personal del usuario.
  const tokenHash = await hashToken(rawToken);

  const resetToken = await prisma.resetToken.findFirst({
    where: {
      tokenHash,
      usadoEn:   null,              // de un solo uso
      expiresAt: { gt: new Date() }, // no expirado
    },
    select: { id: true, usuarioId: true },
  });

  if (!resetToken) {
    return { error: "El enlace expiró o ya se usó. Solicita uno nuevo." };
  }

  // reset_token no tiene tenant_id (sin RLS) pero usuario sí — igual que
  // auth_tenant_de_usuario más abajo, se lee vía función SECURITY DEFINER
  // porque todavía no hay sesión/tenant conocido en este punto del flujo.
  const usuarioRows = await prisma.$queryRaw<{ nombre: string; email: string; rut: string | null }[]>`
    SELECT * FROM auth_lookup_usuario_por_id(${resetToken.usuarioId}::uuid)
  `;
  const strength = evaluatePassword(password, usuarioRows[0]);
  if (!strength.passes) {
    return { error: strength.suggestion };
  }

  // ADR-0011 Fase 2: reset_token no tiene tenant_id (no está sujeta a RLS),
  // pero usuario sí — necesitamos su tenant antes de poder actualizar su
  // password bajo RLS. Función de solo lectura, la escritura sigue el camino
  // normal (withTenant) una vez resuelto el tenant.
  const tenantRows = await prisma.$queryRaw<{ tenant_id: string | null }[]>`
    SELECT auth_tenant_de_usuario(${resetToken.usuarioId}::uuid) AS tenant_id
  `;
  const tenantId = tenantRows[0]?.tenant_id;
  if (!tenantId) {
    return { error: "El enlace expiró o ya se usó. Solicita uno nuevo." };
  }

  // Actualizar contraseña e invalidar token en transacción atómica
  try {
    const passwordHash = await hashPassword(password);

    await withTenant(tenantId, async (tx) => {
      await tx.usuario.update({
        where: { id: resetToken.usuarioId },
        data:  { passwordHash },
      });
      await tx.resetToken.update({
        where: { id: resetToken.id },
        data:  { usadoEn: new Date() },
      });
    });
  } catch {
    return { error: "No pudimos actualizar tu contraseña. Intenta de nuevo." };
  }

  redirect("/login?reset=1");
}
