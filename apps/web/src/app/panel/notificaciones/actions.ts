"use server";

import { revalidatePath } from "next/cache";
import { getActor, marcarPeriodosAtrasados, propiedadIdsVisibles } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { sendNotificacionEmail } from "@/lib/email";
import { logError } from "@/lib/logger";
import { cantidad } from "@/lib/format";
import type { Tenant, Prisma } from "@/generated/prisma/client";

/** Hoy a medianoche UTC — dinámico, para cálculo de días (no hardcodear fechas). */
function hoyUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Genera las notificaciones de recordatorio pendientes siguiendo la cadencia de ADR-0008:
 * 1. recordatorio_vencimiento → arrendatario cuando faltan ≤ recordatorio_dias_antes días
 * 2. cobro (alerta de atraso) → arrendatario cuando el período está atrasado
 * 3. liquidacion_propietario (aviso de ventana) → propietario cuando período "pagado" superó ventana
 *
 * Idempotente: no crea duplicados para el mismo período.
 */
/**
 * Genera recordatorios para un tenant específico.
 *
 * @param tenantOverride  Si se provee, se usa directamente (para cron jobs del
 *   sistema que no tienen sesión de usuario). Si se omite, se lee desde la sesión.
 */
export async function generarRecordatorios(tenantOverride?: Tenant): Promise<{
  ok: boolean;
  creados: number;
  mensaje: string;
}> {
  try {
    const HOY = hoyUTC();
    // tenantOverride = llamada del cron de sistema, sin sesión de usuario — sin
    // filtro por colaborador (procesa todo el tenant). Desde el panel, un
    // Colaborador solo genera recordatorios de sus propias propiedades (Fase D).
    const actor  = tenantOverride ? null : await getActor();
    const tenant = tenantOverride ?? actor!.tenant;
    const propiedadIds = actor ? await propiedadIdsVisibles(actor) : null;
    const diasAntes  = tenant.recordatorioDiasAntes;  // default 5
    const ventana    = tenant.ventanaLiquidacionDias;  // default 10

    // AUD-09: promover a "atrasado" antes de leer — el cron es la única vía
    // por la que el sistema queda correcto sin que nadie abra el panel.
    await marcarPeriodosAtrasados(tenant.id);

    // Obtener todos los períodos pendientes/atrasados/pagados con sus contratos y personas.
    // Secuencial, no Promise.all: tx comparte una única conexión Postgres.
    const [periodos, existentes] = await withTenant(tenant.id, async (tx) => {
      const periodos = await tx.periodoPago.findMany({
        where: {
          tenantId: tenant.id,
          estado: { in: ["pendiente", "atrasado", "pagado"] },
          ...(propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {}),
        },
        include: {
          contrato: {
            select: {
              id: true,
              arrendatarioId: true,
              propietarioId: true,
              propiedad: { select: { direccion: true } },
            },
          },
        },
      });
      // Notificaciones ya existentes (para deduplicar por periodoId en payload)
      const existentes = await tx.notificacion.findMany({
        where: { tenantId: tenant.id },
        select: { payload: true, tipo: true },
      });
      return [periodos, existentes] as const;
    });

    // Extraer periodoIds ya notificados por tipo
    const yaNotificado = new Set<string>();
    for (const n of existentes) {
      const payload = n.payload as Record<string, unknown> | null;
      if (payload?.periodoId) {
        yaNotificado.add(`${n.tipo}::${payload.periodoId}`);
      }
    }

    const nuevas: Prisma.NotificacionUncheckedCreateInput[] = [];

    for (const p of periodos) {
      const c = p.contrato;
      const diasHastaVencimiento = Math.floor(
        (p.fechaVencimiento.getTime() - HOY.getTime()) / 86400000
      );
      const diasDesdeVencimiento = Math.floor(
        (HOY.getTime() - p.fechaVencimiento.getTime()) / 86400000
      );

      // ── 1. Recordatorio de vencimiento próximo (pendiente) ─────────────
      if (
        p.estado === "pendiente" &&
        diasHastaVencimiento >= 0 &&
        diasHastaVencimiento <= diasAntes &&
        !yaNotificado.has(`recordatorio_vencimiento::${p.id}`)
      ) {
        nuevas.push({
          tenantId: tenant.id,
          personaId: c.arrendatarioId,
          contratoId: c.id,
          tipo: "recordatorio_vencimiento",
          canal: "email",
          estado: "pendiente",
          asunto: diasHastaVencimiento === 0
            ? `Tu arriendo vence hoy: ${c.propiedad.direccion}`
            : `Tu arriendo vence en ${cantidad(diasHastaVencimiento, "día", "días")}: ${c.propiedad.direccion}`,
          cuerpo: `El pago de tu arriendo vence el ${p.fechaVencimiento.toLocaleDateString("es-CL", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" })}. Paga antes de esa fecha para no generar intereses por mora.`,
          payload: { periodoId: p.id, diasRestantes: diasHastaVencimiento },
        });
        yaNotificado.add(`recordatorio_vencimiento::${p.id}`);
      }

      // ── 2. Alerta de atraso (atrasado sin pago) ─────────────────────────
      if (
        p.estado === "atrasado" &&
        !yaNotificado.has(`cobro::${p.id}`)
      ) {
        nuevas.push({
          tenantId: tenant.id,
          personaId: c.arrendatarioId,
          contratoId: c.id,
          tipo: "cobro",
          canal: "email",
          estado: "pendiente",
          asunto: `Pago atrasado ${cantidad(diasDesdeVencimiento, "día", "días")}: ${c.propiedad.direccion}`,
          cuerpo: `Tu pago del arriendo lleva ${cantidad(diasDesdeVencimiento, "día", "días")} de atraso. Regulariza cuanto antes: los intereses por mora se acumulan cada día.`,
          payload: { periodoId: p.id, diasAtraso: diasDesdeVencimiento },
        });
        yaNotificado.add(`cobro::${p.id}`);
      }

      // ── 3. Aviso de liquidación pendiente al propietario ────────────────
      // Cuando el período está "pagado" y se superó la ventana de liquidación
      if (
        p.estado === "pagado" &&
        p.fechaPagoReal !== null &&
        !yaNotificado.has(`liquidacion_propietario::${p.id}`)
      ) {
        const diasDesdePago = Math.floor(
          (HOY.getTime() - p.fechaPagoReal.getTime()) / 86400000
        );
        if (diasDesdePago > ventana) {
          nuevas.push({
            tenantId: tenant.id,
            personaId: c.propietarioId,
            contratoId: c.id,
            tipo: "liquidacion_propietario",
            canal: "email",
            estado: "pendiente",
            asunto: `Liquidación pendiente: ${c.propiedad.direccion}`,
            cuerpo: `Recibimos el pago del arriendo hace ${cantidad(diasDesdePago, "día", "días")} y la liquidación todavía no se procesa. Superó en ${cantidad(diasDesdePago - ventana, "día", "días")} la ventana acordada.`,
            payload: { periodoId: p.id, diasFueraVentana: diasDesdePago - ventana },
          });
          yaNotificado.add(`liquidacion_propietario::${p.id}`);
        }
      }
    }

    // Crear en lote
    if (nuevas.length > 0) {
      await withTenant(tenant.id, async (tx) => {
        for (const data of nuevas) {
          await tx.notificacion.create({ data });
        }
      });
    }

    revalidatePath("/panel/notificaciones");
    revalidatePath("/panel");

    return {
      ok: true,
      creados: nuevas.length,
      mensaje: nuevas.length > 0
        ? `Generamos ${cantidad(nuevas.length, "recordatorio", "recordatorios")}.`
        : "No hay recordatorios nuevos por generar.",
    };
  } catch (e) {
    logError("generarRecordatorios", e);
    // SEC: nunca exponer mensajes internos (Prisma/stack) al cliente
    return { ok: false, creados: 0, mensaje: "No pudimos generar los recordatorios. Vuelve a intentarlo." };
  }
}

/**
 * Envía las notificaciones pendientes por email (Resend en prod, console.log en dev).
 * Procesa en lotes de 50 para no saturar la API de email.
 */
/**
 * Envía notificaciones pendientes para un tenant específico.
 *
 * @param tenantOverride  Si se provee, se usa directamente (para cron jobs del
 *   sistema que no tienen sesión de usuario). Si se omite, se lee desde la sesión.
 */
export async function enviarNotificacionesPendientes(tenantOverride?: Tenant): Promise<{
  ok: boolean;
  enviadas: number;
  errores: number;
  sinEmail: number;
}> {
  try {
    const actor  = tenantOverride ? null : await getActor();
    const tenant = tenantOverride ?? actor!.tenant;
    const propiedadIds = actor ? await propiedadIdsVisibles(actor) : null;

    // Lectura en su propia transacción corta — no mantenemos abierta una
    // transacción mientras esperamos el I/O externo de envío de email más abajo.
    const pendientes = await withTenant(tenant.id, (tx) => tx.notificacion.findMany({
      where: {
        tenantId: tenant.id, estado: "pendiente", canal: "email",
        ...(propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {}),
      },
      include: {
        persona: { select: { nombre: true, email: true } },
      },
      take: 50,
      orderBy: { createdAt: "asc" },
    }));

    let enviadas = 0;
    let errores  = 0;
    let sinEmail = 0;

    for (const notif of pendientes) {
      if (!notif.persona.email) {
        sinEmail++;
        continue;
      }
      try {
        await sendNotificacionEmail(
          { asunto: notif.asunto, cuerpo: notif.cuerpo, tipo: notif.tipo },
          { email: notif.persona.email, nombre: notif.persona.nombre },
        );
        await withTenant(tenant.id, (tx) => tx.notificacion.update({
          where: { id: notif.id },
          data: { estado: "enviada", enviadaEn: new Date() },
        }));
        enviadas++;
      } catch (e) {
        logError(`enviarNotificacion/${notif.id}`, e);
        errores++;
      }
    }

    revalidatePath("/panel/notificaciones");
    revalidatePath("/panel");
    return { ok: true, enviadas, errores, sinEmail };
  } catch (e) {
    logError("enviarNotificacionesPendientes", e);
    return { ok: false, enviadas: 0, errores: 0, sinEmail: 0 };
  }
}

/** Marcar una notificación como "simulada" (enviada en MVP). */
export async function marcarSimulada(id: string): Promise<{ ok: boolean }> {
  try {
    const actor = await getActor();
    await withTenant(actor.tenantId, async (tx) => {
      // ADR-0013 (Fase D) — un Colaborador solo actúa sobre notificaciones de
      // sus propias propiedades; una sin contrato asociado no tiene dueño
      // identificable, así que queda fuera de su alcance.
      if (actor.rol !== "manager") {
        const notif = await tx.notificacion.findFirst({
          where: { id, tenantId: actor.tenantId },
          select: { contrato: { select: { propiedad: { select: { asignadoAId: true } } } } },
        });
        if (!notif || notif.contrato?.propiedad.asignadoAId !== actor.usuarioId) {
          throw new Error("No tienes acceso a esta notificación.");
        }
      }
      await tx.notificacion.update({
        where: { id, tenantId: actor.tenantId },
        data: { estado: "simulada", enviadaEn: new Date() },
      });
    });
    revalidatePath("/panel/notificaciones");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Marcar todas las notificaciones pendientes como "simuladas". */
export async function simularEnvioMasivo(): Promise<{ ok: boolean; enviadas: number }> {
  try {
    const actor = await getActor();
    const propiedadIds = await propiedadIdsVisibles(actor);
    const { count } = await withTenant(actor.tenantId, (tx) => tx.notificacion.updateMany({
      where: {
        tenantId: actor.tenantId, estado: "pendiente",
        ...(propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {}),
      },
      data: { estado: "simulada", enviadaEn: new Date() },
    }));
    revalidatePath("/panel/notificaciones");
    revalidatePath("/panel");
    return { ok: true, enviadas: count };
  } catch {
    return { ok: false, enviadas: 0 };
  }
}
