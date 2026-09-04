/**
 * Orquestación de la suscripción de un tenant a Housing.
 *
 * Junta tres cosas que hasta ahora vivían sueltas: los precios (plans.ts), el
 * puerto de pasarela (gateway.ts) y los modelos SuscripcionTenant/CargoBilling.
 * El alta es: elegir plan → inscribir tarjeta (redirección al proveedor) →
 * volver → primer cobro → suscripción activa.
 *
 * Decisión de producto (2026-09): NO hay plan gratuito. Todo tenant necesita
 * una suscripción con cobro para usar el panel; el acceso lo decide
 * `suscripcionVigente` mirando `periodoActualHasta`, no el string `Tenant.plan`.
 *
 * En dev la pasarela es el fake (crearGatewayDeEntorno); el contrato es el
 * mismo que tendrá el proveedor real, así que nada de acá cambia cuando se
 * resuelva D-02.
 *
 * Todo lo que toca base recibe un `TenantClient` y debe correr dentro de
 * `withTenant`: las tablas de billing están bajo RLS (setup.sql), igual que el
 * resto del esquema.
 */
import type { TenantClient } from "../tenant-db";
import { PLANS, getPlanEfectivo, precioUf, desglosarPrecioClp } from "../plans";
import type { BillingGateway, DesgloseMonto } from "./gateway";

export type Ciclo = "mensual" | "anual";

/** Si el string corresponde a un plan real (no cae al fallback de bronze). */
export function esPlanValido(planId: string): boolean {
  return PLANS.some((p) => p.id === planId);
}

/**
 * Etiqueta del período que cubre un cargo, "YYYY-MM". Junto con tenant y tipo
 * es la clave natural que impide cobrar dos veces el mismo período. Para el plan
 * anual se usa igual el mes de inicio: la renovación del año siguiente cae en
 * otro "YYYY-MM" y no choca.
 */
export function etiquetaPeriodo(desde: Date): string {
  const y = desde.getUTCFullYear();
  const m = String(desde.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Hasta cuándo queda cubierto el servicio tras pagar en `desde`.
 *
 * Se suma en meses de calendario (no 30 días fijos): un cobro mensual el 15 de
 * enero cubre hasta el 15 de febrero, como espera cualquiera que mire su estado
 * de cuenta. Si el mes destino no tiene ese día (31-ene + 1 mes), se ancla al
 * último día del mes que correspondía.
 */
export function periodoHasta(ciclo: Ciclo, desde: Date): Date {
  const meses = ciclo === "anual" ? 12 : 1;
  const d = new Date(desde);
  const diaOriginal = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + meses);
  if (d.getUTCDate() < diaOriginal) d.setUTCDate(0);
  return d;
}

/** Desglose en CLP del cargo de suscripción de un plan/ciclo, a la UF dada. */
export function montoSuscripcion(
  planId: string,
  ciclo: Ciclo,
  valorUfClp: number,
): DesgloseMonto {
  const plan = getPlanEfectivo(planId);
  const uf = precioUf(plan, ciclo);
  const { netoClp, ivaClp, totalClp } = desglosarPrecioClp(uf, valorUfClp);
  return { netoClp, ivaClp, totalClp, montoUf: uf, ufAplicada: valorUfClp };
}

/**
 * Clave de idempotencia del primer cobro. Determinista a partir de
 * (tenant, período): reintentar el alta no cobra dos veces, y el índice único
 * de CargoBilling.idempotencyKey lo respalda a nivel de base.
 */
export function claveCobroSuscripcion(tenantId: string, periodo: string): string {
  return `sub_${tenantId}_${periodo}`;
}

/** Estados de suscripción que dan derecho a usar el panel. */
const ESTADOS_CON_ACCESO = new Set(["trial", "activa", "pago_pendiente", "cancelada"]);

/**
 * Si el tenant tiene derecho al servicio AHORA. Mira la fecha pagada, no el
 * string del plan: una suscripción `cancelada` sigue dando acceso hasta el fin
 * del período pagado (D-05), y una `activa` cuyo período ya venció, no.
 */
export function suscripcionVigente(
  sub: { estado: string; periodoActualHasta: Date } | null,
  ahora: Date = new Date(),
): boolean {
  if (!sub) return false;
  if (!ESTADOS_CON_ACCESO.has(sub.estado)) return false;
  return sub.periodoActualHasta.getTime() > ahora.getTime();
}

// ── Orquestación (toca base + pasarela) ─────────────────────────────────────

export type ResultadoAlta =
  | { ok: true; suscripcionId: string }
  | { ok: false; error: string; reintentable: boolean };

/**
 * Confirma la tarjeta recién inscrita y deja la suscripción activa con su
 * primer período pagado. Idempotente: si el cargo del período ya existe pagado,
 * no vuelve a cobrar.
 *
 * Corre dentro de `withTenant` (recibe `tx`): las tablas de billing están bajo
 * RLS. El cobro al proveedor es I/O externo y ocurre entre escrituras cortas;
 * la idempotencia (clave determinista + índice único) lo hace seguro ante
 * reintentos y fallos de red.
 */
export async function activarSuscripcionConTarjeta(params: {
  tx: TenantClient;
  gateway: BillingGateway;
  tenantId: string;
  planId: string;
  ciclo: Ciclo;
  tokenInscripcion: string;
  valorUfClp: number;
  ahora?: Date;
}): Promise<ResultadoAlta> {
  const { tx, gateway, tenantId, planId, ciclo, tokenInscripcion, valorUfClp } = params;
  const ahora = params.ahora ?? new Date();

  if (!esPlanValido(planId)) {
    return { ok: false, error: "Plan desconocido.", reintentable: false };
  }

  const medio = await gateway.confirmarInscripcion(tokenInscripcion);
  if (!medio) {
    return {
      ok: false,
      error: "No pudimos confirmar tu tarjeta. Intenta inscribirla de nuevo.",
      reintentable: true,
    };
  }

  const periodo = etiquetaPeriodo(ahora);
  const monto = montoSuscripcion(planId, ciclo, valorUfClp);
  const idempotencyKey = claveCobroSuscripcion(tenantId, periodo);

  // Una suscripción viva por tenant (índice parcial en setup.sql). Si el usuario
  // reintenta tras un fallo, se reusa la que ya existe en vez de crear otra.
  const viva = await tx.suscripcionTenant.findFirst({
    where: { tenantId, estado: { in: ["trial", "activa", "pago_pendiente", "suspendida"] } },
    select: { id: true },
  });
  const sub = viva
    ? await tx.suscripcionTenant.update({
        where: { id: viva.id },
        data:  { planId, ciclo, medioPagoRef: medio.referencia },
      })
    : await tx.suscripcionTenant.create({
        data: {
          tenantId, planId, ciclo,
          estado: "pago_pendiente",
          medioPagoRef: medio.referencia,
          periodoActualHasta: ahora, // se extiende al aprobar el cobro
        },
      });

  // El cargo del período. El índice único de idempotencyKey impide duplicarlo:
  // si ya existe (reintento), se recupera en vez de crear otro.
  const cargo = await tx.cargoBilling.upsert({
    where:  { idempotencyKey },
    create: {
      tenantId, suscripcionId: sub.id, tipo: "suscripcion", estado: "pendiente",
      periodo,
      montoNetoClp: monto.netoClp, ivaClp: monto.ivaClp, montoTotalClp: monto.totalClp,
      montoUf: monto.montoUf, ufAplicada: monto.ufAplicada,
      idempotencyKey,
    },
    update: {},
  });

  // Ya estaba pagado (reintento después de un alta exitosa): nada que cobrar.
  if (cargo.estado === "pagado") {
    return { ok: true, suscripcionId: sub.id };
  }

  let cobro;
  try {
    cobro = await gateway.cobrar({
      idempotencyKey, tenantId, medioPago: medio.referencia, monto,
      descripcion: `Housing ${planId} (${ciclo}) — ${periodo}`,
    });
  } catch {
    await tx.cargoBilling.update({
      where: { id: cargo.id },
      data:  {
        intentos: { increment: 1 },
        ultimoErrorCategoria: "temporal",
        ultimoErrorMensaje: "El proveedor no respondió.",
      },
    });
    return {
      ok: false,
      error: "El proveedor de pago no respondió. Intenta de nuevo.",
      reintentable: true,
    };
  }

  if (cobro.estado !== "aprobado") {
    await tx.cargoBilling.update({
      where: { id: cargo.id },
      data:  {
        estado: "fallido", intentos: { increment: 1 },
        ultimoErrorCategoria: cobro.categoria, ultimoErrorMensaje: cobro.mensaje,
      },
    });
    const reintentable = cobro.categoria === "rechazo" || cobro.categoria === "temporal";
    return {
      ok: false,
      error: cobro.categoria === "medio_invalido"
        ? "Tu tarjeta fue rechazada. Prueba con otra."
        : "No pudimos procesar el cobro. Revisa tu tarjeta e intenta de nuevo.",
      reintentable,
    };
  }

  // Cobro aprobado: cargo pagado y período extendido → acceso habilitado.
  await tx.cargoBilling.update({
    where: { id: cargo.id },
    data:  { estado: "pagado", gatewayRef: cobro.referenciaTransaccion, pagadoEn: cobro.autorizadoEn },
  });
  await tx.suscripcionTenant.update({
    where: { id: sub.id },
    data:  { estado: "activa", periodoActualHasta: periodoHasta(ciclo, ahora) },
  });

  return { ok: true, suscripcionId: sub.id };
}
