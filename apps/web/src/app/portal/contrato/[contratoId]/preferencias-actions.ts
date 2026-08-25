"use server";

import { revalidatePath } from "next/cache";
import { getPortalSession } from "@/lib/portal-auth";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";

export type ResultadoPreferencia = { ok: true } | { ok: false; error: string };

/**
 * Reactiva los avisos por correo desde el portal.
 *
 * La autorización es la sesión del portal, y la preferencia se escribe SOLO
 * para la persona de esa sesión: nadie puede reactivar los avisos de otro. Es
 * la contraparte de /no-molestar — allá se da de baja sin sesión (desde el
 * enlace del correo), acá se vuelve con sesión.
 */
export async function reactivarAvisos(): Promise<ResultadoPreferencia> {
  try {
    const session = await getPortalSession();
    if (!session) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar al portal." };

    const { personaId, tenantId } = session;

    await withTenant(tenantId, (tx) => tx.preferenciaNotificacion.upsert({
      where:  { tenantId_personaId: { tenantId, personaId } },
      // Se limpia bajaHasta: una baja temporal que se reactiva a mano no debe
      // dejar una fecha que la vuelva a apagar sola más adelante.
      create: { tenantId, personaId, suscrito: true, bajaHasta: null },
      update: { suscrito: true, bajaHasta: null, motivo: null },
    }));

    revalidatePath("/portal/contrato");
    return { ok: true };
  } catch (e) {
    logError("reactivarAvisos", e);
    return { ok: false, error: "No pudimos actualizar tu preferencia. Intenta de nuevo." };
  }
}

/** Pausa los avisos desde el portal, sin tener que buscar un correo viejo. */
export async function pausarAvisos(): Promise<ResultadoPreferencia> {
  try {
    const session = await getPortalSession();
    if (!session) return { ok: false, error: "Tu sesión expiró. Vuelve a entrar al portal." };

    const { personaId, tenantId } = session;

    await withTenant(tenantId, (tx) => tx.preferenciaNotificacion.upsert({
      where:  { tenantId_personaId: { tenantId, personaId } },
      create: { tenantId, personaId, suscrito: false, bajaHasta: null },
      update: { suscrito: false, bajaHasta: null },
    }));

    revalidatePath("/portal/contrato");
    return { ok: true };
  } catch (e) {
    logError("pausarAvisos", e);
    return { ok: false, error: "No pudimos actualizar tu preferencia. Intenta de nuevo." };
  }
}
