"use server";

/**
 * Solicitud de cambio de plan (P-B6) con gate de downgrade (P-B7).
 *
 * Sin pasarela conectada (P-B2/P-B4) el cambio no se aplica solo: se valida
 * acá con las mismas reglas que usará el cambio automático y se envía como
 * solicitud a soporte, que lo aplica y, si corresponde, cobra la diferencia.
 */
import { withTenant } from "@/lib/tenant-db";
import { getActor, getUfCLP, getUsoCupos } from "@/lib/queries";
import { PLANS, getPlanEfectivo, desglosarPrecioClp } from "@/lib/plans";
import {
  tipoDeCambio, diferenciaUpgradeUf, excedentesParaPlan, MODALIDADES_UPGRADE,
  type TipoCambio, type ModalidadUpgrade, type Excedente,
} from "@/lib/billing/cambio-plan";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendSolicitudCambioPlanEmail } from "@/lib/email";

export type CambioPlanState =
  | { ok: true; tipo: TipoCambio; planDestino: string }
  | { ok: false; error: string; excedentes?: Excedente[] };

export async function solicitarCambioPlanAction(input: {
  destinoId: string;
  modalidad?: string | null;
}): Promise<CambioPlanState> {
  const actor = await getActor();
  if (actor.rol !== "manager") {
    return { ok: false, error: "Solo el Manager de la cuenta puede cambiar el plan." };
  }

  // El argumento llega del cliente: no confiar en su forma.
  const destinoId = typeof input?.destinoId === "string" ? input.destinoId : "";
  const destino = PLANS.find((p) => p.id === destinoId);
  if (!destino) return { ok: false, error: "El plan elegido no existe." };

  const origen = getPlanEfectivo(actor.tenant.plan);
  const tipo = tipoDeCambio(origen, destino);
  if (!tipo) return { ok: false, error: `Ya tienes el plan ${destino.name}.` };

  let modalidad: ModalidadUpgrade | null = null;
  if (tipo === "upgrade") {
    const m = input?.modalidad;
    if (!MODALIDADES_UPGRADE.includes(m as ModalidadUpgrade)) {
      return { ok: false, error: "Elige cuándo quieres que empiece el plan nuevo." };
    }
    modalidad = m as ModalidadUpgrade;
  } else {
    // D-05: se valida en el servidor con el uso real del momento; la UI solo
    // anticipa el resultado.
    const excedentes = excedentesParaPlan(destino, await getUsoCupos(actor.tenantId, actor.usuarioId));
    if (excedentes.length > 0) {
      return {
        ok: false,
        error: `Tu cuenta todavía no cabe en el plan ${destino.name}. Libera cupo y vuelve a intentarlo.`,
        excedentes,
      };
    }
  }

  // Después de validar: un intento rechazado no consume cupo de envío.
  if (!checkRateLimit(`cambio_plan:${actor.tenantId}`, 3, 60 * 60_000).allowed) {
    return { ok: false, error: "Ya enviaste varias solicitudes en la última hora. Espera la respuesta de soporte." };
  }

  const manager = await withTenant(actor.tenantId, (tx) => tx.usuario.findUnique({
    where: { id: actor.usuarioId },
    select: { nombre: true, email: true },
  }));
  if (!manager) return { ok: false, error: "No se encontró tu usuario. Vuelve a iniciar sesión." };

  let diferenciaUf: number | null = null;
  let diferenciaTotalClp: number | null = null;
  if (modalidad === "inmediato") {
    diferenciaUf = diferenciaUpgradeUf(origen, destino);
    try {
      diferenciaTotalClp = desglosarPrecioClp(diferenciaUf, await getUfCLP(new Date())).totalClp;
    } catch {
      // Sin valor UF disponible el correo lleva solo el monto en UF, que es el que manda.
      diferenciaTotalClp = null;
    }
  }

  try {
    await sendSolicitudCambioPlanEmail({
      corredora: actor.tenant.nombre,
      nombreManager: manager.nombre,
      emailManager: manager.email,
      planOrigen: origen.name,
      planDestino: destino.name,
      tipo, modalidad, diferenciaUf, diferenciaTotalClp,
    });
  } catch (err) {
    console.error("[cambio-plan] no se pudo enviar la solicitud:", err instanceof Error ? err.message : err);
    return { ok: false, error: "No se pudo enviar la solicitud. Intenta de nuevo en unos minutos." };
  }

  return { ok: true, tipo, planDestino: destino.name };
}
