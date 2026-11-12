"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { headers } from "next/headers";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { getClientIpFromHeaders } from "@/lib/ip";
import { logError } from "@/lib/logger";
import { anonimizarPersona } from "@/lib/supresion-persona";

export type ResultadoSupresionAction =
  | { ok: true; borrados: Record<string, number>; conservado: string[] }
  | { ok: false; error: string };

/** Lo que hay que escribir para confirmar: un clic suelto no puede borrar una identidad. */
export const PALABRA_CONFIRMACION = "ANONIMIZAR";

/**
 * Derecho de supresión de una persona de la corredora (L-DP5). Solo el Manager.
 * Es irreversible, por eso exige escribir la palabra de confirmación aunque el
 * botón ya pida confirmar.
 */
export async function anonimizarPersonaAction(
  personaId: string,
  confirmacion: string,
): Promise<ResultadoSupresionAction> {
  if (confirmacion.trim() !== PALABRA_CONFIRMACION) {
    return { ok: false, error: `Escribe ${PALABRA_CONFIRMACION} para confirmar.` };
  }
  try {
    const actor = await getActor();
    if (actor.rol !== "manager") return { ok: false, error: "Solo el Manager puede anonimizar a una persona." };

    const ip = getClientIpFromHeaders(await headers());
    const r = await withTenant(actor.tenantId, (tx) =>
      anonimizarPersona(tx, { tenantId: actor.tenantId, personaId, actorId: actor.usuarioId, ip }),
    );
    if (!r.ok) return { ok: false, error: r.motivo };

    revalidatePath("/panel/contratos");
    return { ok: true, borrados: r.borrados, conservado: r.conservado };
  } catch (e) {
    unstable_rethrow(e);
    logError("supresion/anonimizar", e);
    return { ok: false, error: "No pudimos anonimizar a la persona. No se cambió nada; inténtalo de nuevo." };
  }
}
