"use server";

import { headers }                       from "next/headers";
import { prisma }                        from "@/lib/db";
import { withTenant }                    from "@/lib/tenant-db";
import { getActor }                      from "@/lib/queries";
import { generateResetToken, hashToken } from "@/lib/token";
import { sendCollaboratorInviteEmail }   from "@/lib/email";
import { getClientIpFromHeaders }        from "@/lib/ip";
import { PLANS, getCupoUsuarios }        from "@/lib/plans";

class DomainError extends Error {
  constructor(msg: string) { super(msg); this.name = "DomainError"; }
}

export type InvitarState =
  | { ok: true }
  | { ok: false; error: string; field?: string };

export type AccionEquipoState =
  | { ok: true }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITACION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// ── Cupo de usuarios por plan (ADR-0013, Fase E) ─────────────────────────────
// Una invitación pendiente ocupa cupo igual que un Colaborador activo
// (ROL-FLU-5) — si no contara, el Manager podría invitar más gente de la que
// el plan permite mientras las invitaciones siguen sin aceptarse.
async function contarCupoUsado(tenantId: string, managerId: string): Promise<number> {
  const activos = await withTenant(tenantId, (tx) => tx.usuario.count({
    where: { tenantId, rol: "colaborador", desactivadoEn: null },
  }));
  const pendientes = await prisma.invitacionColaborador.count({
    where: { invitadoPorId: managerId, usadoEn: null, expiresAt: { gt: new Date() } },
  });
  return 1 + activos + pendientes; // +1 = el propio Manager, siempre ocupa un cupo
}

// ── Invitar colaborador ──────────────────────────────────────────────────────
// Manager-only (verificado dentro de la función, no solo oculto en la UI).
// Reutiliza generateResetToken()/hashToken() de lib/token.ts — mismo patrón
// de token de un solo uso que ResetToken. invitacion_colaborador no tiene
// tenant_id (fuera de RLS, igual que reset_token) porque la página de
// aceptación aún no conoce el tenant — por eso las operaciones sobre ella van
// con `prisma` directo, no `withTenant`.
export async function invitarColaboradorAction(
  nombre: string,
  emailRaw: string,
): Promise<InvitarState> {
  const actor = await getActor();
  if (actor.rol !== "manager") {
    return { ok: false, error: "Solo el administrador de la cuenta puede invitar colaboradores." };
  }

  const cupoMax   = getCupoUsuarios(actor.tenant.plan);
  const cupoUsado = await contarCupoUsado(actor.tenantId, actor.usuarioId);
  if (cupoUsado >= cupoMax) {
    return {
      ok: false,
      error: `Alcanzaste el límite de ${cupoMax} usuario${cupoMax === 1 ? "" : "s"} de tu plan. Desactiva a alguien o mejora tu plan para invitar a más gente.`,
    };
  }

  const nombreLimpio = nombre.trim();
  const email        = emailRaw.trim().toLowerCase();

  if (!nombreLimpio || nombreLimpio.length < 2 || nombreLimpio.length > 80) {
    return { ok: false, error: "El nombre debe tener entre 2 y 80 caracteres.", field: "nombre" };
  }
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "El correo electrónico no es válido.", field: "email" };
  }

  // Unicidad global — misma función SECURITY DEFINER que usa /registro.
  const rows = await prisma.$queryRaw<{ existe: boolean }[]>`
    SELECT auth_email_existe(${email}) AS existe
  `.catch(() => null);
  if (rows?.[0]?.existe) {
    return { ok: false, error: "Ya existe una cuenta con ese correo.", field: "email" };
  }

  const rawToken  = generateResetToken();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITACION_TTL_MS);
  const ip        = getClientIpFromHeaders(await headers());

  try {
    await prisma.$transaction([
      // Invalidar invitaciones previas sin usar del mismo correo — evita que
      // queden dos links vivos apuntando a nombres/emisores distintos.
      prisma.invitacionColaborador.deleteMany({
        where: { email, usadoEn: null },
      }),
      prisma.invitacionColaborador.create({
        data: {
          invitadoPorId: actor.usuarioId,
          nombre:        nombreLimpio,
          email,
          tokenHash,
          expiresAt,
        },
      }),
    ]);
    await sendCollaboratorInviteEmail(email, nombreLimpio, rawToken, actor.tenant.nombre);
  } catch {
    return { ok: false, error: "Error al enviar la invitación. Intenta de nuevo." };
  }

  // Auditoría — tenant-scoped, va en su propia transacción withTenant (RLS).
  await withTenant(actor.tenantId, (tx) => tx.auditoriaEquipo.create({
    data: {
      tenantId: actor.tenantId,
      actorId:  actor.usuarioId,
      accion:   "invitar",
      detalle:  email,
      ip,
    },
  })).catch(() => { /* la invitación ya se envió; no bloquear por un fallo de auditoría */ });

  return { ok: true };
}

// ── Desactivar / reactivar colaborador ───────────────────────────────────────
// Manager-only. Nadie desactiva al dueño de la cuenta (ni a sí mismo). Al
// desactivar, sus propiedades asignadas quedan sin asignar en la MISMA
// transacción — nunca debe quedar una propiedad apuntando a alguien inactivo.

export async function desactivarColaboradorAction(usuarioId: string): Promise<AccionEquipoState> {
  const actor = await getActor();
  if (actor.rol !== "manager") {
    return { ok: false, error: "Solo el administrador de la cuenta puede desactivar colaboradores." };
  }
  if (usuarioId === actor.usuarioId) {
    return { ok: false, error: "No puedes desactivarte a ti mismo." };
  }

  const ip = getClientIpFromHeaders(await headers());

  try {
    await withTenant(actor.tenantId, async (tx) => {
      const objetivo = await tx.usuario.findUnique({
        where:  { id: usuarioId },
        select: { id: true, rol: true, desactivadoEn: true },
      });
      if (!objetivo) throw new DomainError("Colaborador no encontrado.");
      if (objetivo.rol === "manager") throw new DomainError("No se puede desactivar al administrador de la cuenta.");
      if (objetivo.desactivadoEn) throw new DomainError("Este colaborador ya está desactivado.");

      await tx.usuario.update({ where: { id: usuarioId }, data: { desactivadoEn: new Date() } });
      await tx.propiedad.updateMany({ where: { asignadoAId: usuarioId }, data: { asignadoAId: null } });
      await tx.auditoriaEquipo.create({
        data: { tenantId: actor.tenantId, actorId: actor.usuarioId, accion: "desactivar", objetivoId: usuarioId, ip },
      });
    });
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    return { ok: false, error: "Error al desactivar. Intenta de nuevo." };
  }

  return { ok: true };
}

export async function reactivarColaboradorAction(usuarioId: string): Promise<AccionEquipoState> {
  const actor = await getActor();
  if (actor.rol !== "manager") {
    return { ok: false, error: "Solo el administrador de la cuenta puede reactivar colaboradores." };
  }

  const ip = getClientIpFromHeaders(await headers());

  try {
    await withTenant(actor.tenantId, async (tx) => {
      const objetivo = await tx.usuario.findUnique({
        where:  { id: usuarioId },
        select: { id: true, rol: true, desactivadoEn: true },
      });
      if (!objetivo) throw new DomainError("Colaborador no encontrado.");
      if (objetivo.rol === "manager") throw new DomainError("El administrador de la cuenta no puede reactivarse.");
      if (!objetivo.desactivadoEn) throw new DomainError("Este colaborador ya está activo.");

      // No recupera automáticamente sus propiedades anteriores (decisión
      // confirmada — quedaron sin asignar al desactivar, el Manager las
      // reasigna a mano si corresponde).
      await tx.usuario.update({ where: { id: usuarioId }, data: { desactivadoEn: null } });
      await tx.auditoriaEquipo.create({
        data: { tenantId: actor.tenantId, actorId: actor.usuarioId, accion: "reactivar", objetivoId: usuarioId, ip },
      });
    });
  } catch (err) {
    if (err instanceof DomainError) return { ok: false, error: err.message };
    return { ok: false, error: "Error al reactivar. Intenta de nuevo." };
  }

  return { ok: true };
}

// ── Lista del equipo (para /panel/equipo) ────────────────────────────────────
export async function getEquipo() {
  const actor = await getActor();
  if (actor.rol !== "manager") {
    throw new DomainError("Solo el administrador de la cuenta puede ver esta página.");
  }

  return withTenant(actor.tenantId, (tx) => tx.usuario.findMany({
    where:  { tenantId: actor.tenantId, rol: "colaborador" },
    select: {
      id: true, nombre: true, email: true, desactivadoEn: true, createdAt: true,
      _count: { select: { propiedadesAsignadas: true } },
    },
    orderBy: { createdAt: "asc" },
  }));
}

export type CupoInfo = { usado: number; max: number; planLabel: string };

export async function getCupoInfo(): Promise<CupoInfo> {
  const actor = await getActor();
  if (actor.rol !== "manager") {
    throw new DomainError("Solo el administrador de la cuenta puede ver esta información.");
  }

  const max   = getCupoUsuarios(actor.tenant.plan);
  const usado = await contarCupoUsado(actor.tenantId, actor.usuarioId);
  const plan  = PLANS.find((p) => p.id === actor.tenant.plan);

  return { usado, max, planLabel: plan?.name ?? "Gratuito" };
}

// Sin parámetros: toda función exportada de un archivo "use server" es un
// endpoint que el cliente puede invocar con los argumentos que quiera. Antes
// recibía el tenantId (público en las URLs del marketplace) sin verificar
// sesión: devolvía nombres y correos de invitados de cualquier corredora.
export async function getInvitacionesPendientes() {
  const actor = await getActor();
  if (actor.rol !== "manager") return [];
  const tenantId = actor.tenantId;
  // invitacion_colaborador no tiene tenant_id — se filtra por invitadoPorId
  // perteneciente al tenant (solo puede ser el Manager, uno por tenant esta fase).
  const manager = await withTenant(tenantId, (tx) => tx.usuario.findFirst({
    where: { tenantId, rol: "manager" }, select: { id: true },
  }));
  if (!manager) return [];

  return prisma.invitacionColaborador.findMany({
    where: {
      invitadoPorId: manager.id,
      usadoEn:       null,
      expiresAt:     { gt: new Date() },
    },
    select: { id: true, nombre: true, email: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
}
