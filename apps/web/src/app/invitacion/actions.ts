"use server";

import { redirect }                      from "next/navigation";
import { prisma }                        from "@/lib/db";
import { withTenant }                    from "@/lib/tenant-db";
import { hashToken }                     from "@/lib/token";
import { hashPassword }                  from "@/lib/password";
import { evaluatePassword }              from "@/lib/password-strength";
import { signSession, setSessionCookie } from "@/lib/auth";
import { getCupoUsuarios }               from "@/lib/plans";

export type AceptarInvitacionState = { error: string; field?: string } | null;

export async function aceptarInvitacionAction(
  _prev: AceptarInvitacionState,
  formData: FormData,
): Promise<AceptarInvitacionState> {
  const rawToken = formData.get("token")?.toString()    ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const consent  = formData.get("consent")?.toString();

  if (!rawToken) {
    return { error: "Enlace de invitación inválido. Pide a tu administrador que te reenvíe la invitación." };
  }

  // Ley 21.719 Art. 4 — consentimiento explícito e inequívoco (no premarcado),
  // mismo criterio que /registro.
  if (!consent) {
    return { error: "Debes aceptar los Términos de uso y la Política de privacidad." };
  }

  // Re-validar el token en el servidor — pudo expirar o usarse entre el
  // page load y el submit del formulario. Se resuelve antes del chequeo de
  // fuerza para poder rechazar una contraseña que contenga el propio
  // nombre/correo del invitado.
  const tokenHash = await hashToken(rawToken);
  const invitacion = await prisma.invitacionColaborador.findFirst({
    where: {
      tokenHash,
      usadoEn:   null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, invitadoPorId: true, nombre: true, email: true },
  });

  if (!invitacion) {
    return { error: "La invitación expiró o ya se usó. Pide a tu administrador que te reenvíe una nueva." };
  }

  const strength = evaluatePassword(password, { nombre: invitacion.nombre, email: invitacion.email });
  if (!strength.passes) {
    return { error: strength.suggestion, field: "password" };
  }

  // invitacion_colaborador no tiene tenant_id — se resuelve vía la misma
  // función SECURITY DEFINER que usa nueva-contrasena para un caso análogo
  // (identificar el tenant de un Usuario ya existente antes de tener sesión).
  const tenantRows = await prisma.$queryRaw<{ tenant_id: string | null }[]>`
    SELECT auth_tenant_de_usuario(${invitacion.invitadoPorId}::uuid) AS tenant_id
  `;
  const tenantId = tenantRows[0]?.tenant_id;
  if (!tenantId) {
    return { error: "La invitación expiró o ya se usó. Pide a tu administrador que te reenvíe una nueva." };
  }

  // Doble-chequeo de unicidad (defensa en profundidad — auth_email_existe ya
  // se corrió al invitar, pero el correo pudo registrarse mientras tanto).
  const emailRows = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT auth_email_existe(${invitacion.email}) AS existe
  `;
  if (emailRows[0]?.existe) {
    return { error: "Ya existe una cuenta con este correo electrónico." };
  }

  // ADR-0013 (Fase E) — revalidar el cupo del plan al ACEPTAR, no solo al
  // invitar. Esta invitación ya contaba como "pendiente" en el cupo del
  // Manager (contarCupoUsado() en panel/equipo/actions.ts), así que
  // convertirla en un Colaborador activo no aumenta el total ocupado — pero
  // si el Manager bajó de plan mientras la invitación seguía viva, el cupo
  // actual puede ya estar completo solo con el Manager + los colaboradores
  // ya activos. Sin este chequeo, una invitación enviada bajo un plan más
  // alto se podría aceptar igual y dejar al tenant con más usuarios activos
  // de los que su plan actual permite.
  const tenantParaCupo = await withTenant(tenantId, (tx) => tx.tenant.findUnique({
    where: { id: tenantId }, select: { plan: true },
  }));
  const activosParaCupo = await withTenant(tenantId, (tx) => tx.usuario.count({
    where: { tenantId, rol: "colaborador", desactivadoEn: null },
  }));
  const cupoMax   = getCupoUsuarios(tenantParaCupo?.plan ?? null);
  const cupoUsado = 1 + activosParaCupo; // 1 = el Manager
  if (cupoUsado >= cupoMax) {
    return {
      error: "El cupo de usuarios del plan de esta cuenta ya está completo. Contacta a tu administrador para que libere un cupo o mejore su plan, y vuelve a intentarlo.",
    };
  }

  let newUser: { id: string; tenantId: string; rol: "manager" | "colaborador"; nombre: string; email: string };

  try {
    const passwordHash = await hashPassword(password);
    const now          = new Date();

    // withTenant() ya abre una única transacción interactiva — no anidar
    // otra con tx.$transaction(), solo encadenar ambas operaciones sobre el
    // mismo `tx` para que se confirmen o reviertan juntas.
    newUser = await withTenant(tenantId, async (tx) => {
      // Consumo atómico de la invitación (ver nueva-contrasena/actions.ts):
      // dos aceptaciones simultáneas no deben crear dos cuentas.
      const consumida = await tx.invitacionColaborador.updateMany({
        where: { id: invitacion.id, usadoEn: null },
        data:  { usadoEn: now },
      });
      if (consumida.count !== 1) throw new Error("invitación ya usada");
      const usuario = await tx.usuario.create({
        data: {
          tenantId,
          rol:            "colaborador",
          nombre:         invitacion.nombre,
          email:          invitacion.email,
          passwordHash,
          consentGivenAt: now,
          consentVersion: "tys-v1.0",
        },
        select: { id: true, tenantId: true, rol: true, nombre: true, email: true },
      });
      return usuario;
    });
  } catch {
    return { error: "No pudimos crear tu cuenta. Intenta de nuevo." };
  }

  try {
    const token = await signSession({
      sub:            newUser.id,
      tenantId:       newUser.tenantId,
      rol:            newUser.rol,
      nombre:         newUser.nombre,
      email:          newUser.email,
      perfilCompleto: false,
    });
    await setSessionCookie(token);
  } catch {
    return { error: "Cuenta creada, pero no pudimos iniciar sesión. Intenta ingresar desde /login." };
  }

  redirect("/verificar-dispositivo");
}
