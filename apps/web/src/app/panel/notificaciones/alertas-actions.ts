"use server";

import { revalidatePath } from "next/cache";
import { getActor, propiedadIdsVisibles } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { renderizarAlerta, validarAlerta, type EntradaAlerta } from "@/lib/alertas";
import { clpOrUf } from "@/lib/format";

export type ResultadoAlerta =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Alertas personalizadas de la corredora.
 *
 * Reparto de permisos (ADR-0013): crear, editar y activar/desactivar es
 * exclusivo del Manager — son plantillas que quedan disponibles para toda la
 * cuenta, así que su edición es administración. **Enviarlas** la puede usar
 * cualquier corredor, limitado a los contratos que ya tiene permitido ver.
 */

/** Listado para el panel. Cualquier corredor de la cuenta puede verlas. */
export async function listarAlertas() {
  const actor = await getActor();
  return withTenant(actor.tenantId, (tx) => tx.alertaPersonalizada.findMany({
    where:   { tenantId: actor.tenantId },
    orderBy: [{ activa: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, nombre: true, asunto: true, cuerpo: true, destinatario: true,
      activa: true, disparador: true, diasOffset: true, createdAt: true,
      creadaPor: { select: { nombre: true } },
    },
  }));
}

export async function crearAlerta(entrada: EntradaAlerta): Promise<ResultadoAlerta> {
  try {
    const actor = await getActor();
    if (actor.rol !== "manager")
      return { ok: false, error: "Solo el administrador de la cuenta puede crear alertas." };

    const error = validarAlerta(entrada);
    if (error) return { ok: false, error };

    await withTenant(actor.tenantId, (tx) => tx.alertaPersonalizada.create({
      data: {
        tenantId:     actor.tenantId,
        nombre:       entrada.nombre.trim(),
        asunto:       entrada.asunto.trim(),
        cuerpo:       entrada.cuerpo.trim(),
        destinatario: entrada.destinatario,
        disparador:   entrada.disparador,
        diasOffset:   entrada.diasOffset,
        creadaPorId:  actor.usuarioId,
      },
    }));

    revalidatePath("/panel/notificaciones");
    return { ok: true };
  } catch (e) {
    logError("crearAlerta", e);
    return { ok: false, error: "No se pudo crear la alerta." };
  }
}

export async function actualizarAlerta(id: string, entrada: EntradaAlerta): Promise<ResultadoAlerta> {
  try {
    const actor = await getActor();
    if (actor.rol !== "manager")
      return { ok: false, error: "Solo el administrador de la cuenta puede editar alertas." };

    const error = validarAlerta(entrada);
    if (error) return { ok: false, error };

    const afectadas = await withTenant(actor.tenantId, (tx) => tx.alertaPersonalizada.updateMany({
      // El tenantId va en el WHERE aunque RLS ya filtre: es la convención del
      // proyecto para que la pertenencia no dependa de una sola capa.
      where: { id, tenantId: actor.tenantId },
      data: {
        nombre:       entrada.nombre.trim(),
        asunto:       entrada.asunto.trim(),
        cuerpo:       entrada.cuerpo.trim(),
        destinatario: entrada.destinatario,
        disparador:   entrada.disparador,
        diasOffset:   entrada.diasOffset,
      },
    }));
    if (afectadas.count === 0) return { ok: false, error: "La alerta ya no existe." };

    revalidatePath("/panel/notificaciones");
    return { ok: true };
  } catch (e) {
    logError("actualizarAlerta", e);
    return { ok: false, error: "No se pudo actualizar la alerta." };
  }
}

/**
 * Activa o desactiva. No se borra: una alerta ya enviada dejó notificaciones
 * que la referencian, y perder el rastro de con qué texto se avisó a alguien
 * es exactamente lo que no queremos en una discusión con un arrendatario.
 */
export async function cambiarEstadoAlerta(id: string, activa: boolean): Promise<ResultadoAlerta> {
  try {
    const actor = await getActor();
    if (actor.rol !== "manager")
      return { ok: false, error: "Solo el administrador de la cuenta puede activar o desactivar alertas." };

    const afectadas = await withTenant(actor.tenantId, (tx) => tx.alertaPersonalizada.updateMany({
      where: { id, tenantId: actor.tenantId },
      data:  { activa },
    }));
    if (afectadas.count === 0) return { ok: false, error: "La alerta ya no existe." };

    revalidatePath("/panel/notificaciones");
    return { ok: true };
  } catch (e) {
    logError("cambiarEstadoAlerta", e);
    return { ok: false, error: "No se pudo cambiar el estado de la alerta." };
  }
}

/**
 * Envía una alerta sobre un contrato concreto.
 *
 * Crea la notificación como **pendiente**, que es lo único que el despachador
 * toma. Marcarla "simulada" acá equivaldría a no enviarla nunca — el fallo que
 * tuvo cinco tipos de notificación sin salir durante meses.
 */
export async function enviarAlerta(alertaId: string, contratoId: string): Promise<ResultadoAlerta> {
  try {
    const actor = await getActor();
    const propiedadIds = await propiedadIdsVisibles(actor);

    return await withTenant(actor.tenantId, async (tx) => {
      const alerta = await tx.alertaPersonalizada.findFirst({
        where: { id: alertaId, tenantId: actor.tenantId },
      });
      if (!alerta)        return { ok: false as const, error: "La alerta no existe." };
      if (!alerta.activa) return { ok: false as const, error: "Esa alerta está desactivada." };

      // ADR-0013 (Fase D): un Colaborador solo puede accionar sobre contratos
      // de propiedades que tiene asignadas. Para el Manager propiedadIds es
      // null (sin filtro).
      const contrato = await tx.contrato.findFirst({
        where: {
          id: contratoId, tenantId: actor.tenantId,
          ...(propiedadIds ? { propiedadId: { in: propiedadIds } } : {}),
        },
        select: {
          id: true, valorArriendo: true, denominacion: true,
          arrendatarioId: true, propietarioId: true,
          arrendatario: { select: { id: true, nombre: true } },
          propietario:  { select: { id: true, nombre: true } },
          propiedad:    { select: { direccion: true } },
          periodos: {
            where: { estado: { in: ["pendiente", "atrasado"] } },
            orderBy: { fechaVencimiento: "asc" },
            take: 1,
            select: { id: true, fechaVencimiento: true },
          },
        },
      });
      if (!contrato) return { ok: false as const, error: "No tienes acceso a ese contrato." };

      const destino = alerta.destinatario === "arrendatario" ? contrato.arrendatario : contrato.propietario;

      const datos = {
        arrendatario: contrato.arrendatario.nombre,
        propietario:  contrato.propietario.nombre,
        direccion:    contrato.propiedad.direccion,
        monto:        clpOrUf(Number(contrato.valorArriendo), contrato.denominacion),
        vencimiento:  contrato.periodos[0]?.fechaVencimiento ?? null,
        corredora:    actor.tenant.nombre,
      };

      await tx.notificacion.create({
        data: {
          tenantId:   actor.tenantId,
          personaId:  destino.id,
          contratoId: contrato.id,
          alertaId:   alerta.id,
          tipo:       "alerta_personalizada",
          canal:      "email",
          estado:     "pendiente",
          asunto:     renderizarAlerta(alerta.asunto, datos),
          cuerpo:     renderizarAlerta(alerta.cuerpo, datos),
        },
      });

      revalidatePath("/panel/notificaciones");
      return { ok: true as const };
    });
  } catch (e) {
    logError("enviarAlerta", e);
    return { ok: false, error: "No se pudo enviar la alerta." };
  }
}
