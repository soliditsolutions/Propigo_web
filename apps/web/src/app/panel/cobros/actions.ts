"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { siguienteFolio } from "@/lib/folio";
import {
  construirSnapshotPago, construirSnapshotLiquidacion,
  type EmisorSnapshot, type InmuebleSnapshot, type ParteSnapshot,
} from "@/lib/comprobante";
import {
  calcularMora,
  conciliar,
  calcularLiquidacion,
  convertirUfAClp,
  redondearPeso,
  esPeriodoDeReajuste,
  aplicarReajusteIpc,
  variacionIpc,
  type TipoAjusteLiquidacion,
} from "@housing/core";

function primerDiaMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
}

/** Error de dominio controlado — el mensaje llega al cliente tal cual. */
class DomainError extends Error {
  constructor(msg: string) { super(msg); this.name = "DomainError"; }
}

type ContratoConPartes = {
  propiedad: { direccion: string; comuna: string | null; rol: string; avaluoFiscal: unknown | null };
  arrendatario: { nombre: string; rut: string };
  propietario:  { nombre: string; rut: string };
};

/**
 * Congela emisor (corredora), inmueble y partes para el snapshot del documento
 * (L-CP3). Los datos se copian al momento del hecho: el comprobante no debe
 * cambiar si mañana cambia el RUT de la corredora o la dirección del inmueble.
 */
function datosDocumento(
  tenant: { nombre: string; rut: string; giro: string | null; direccion: string | null; esPersonaJuridica: boolean },
  c: ContratoConPartes,
): { emisor: EmisorSnapshot; inmueble: InmuebleSnapshot; arrendatario: ParteSnapshot; propietario: ParteSnapshot } {
  return {
    emisor: {
      nombre: tenant.nombre, rut: tenant.rut, giro: tenant.giro,
      direccion: tenant.direccion, esPersonaJuridica: tenant.esPersonaJuridica,
    },
    inmueble: {
      direccion: c.propiedad.direccion, comuna: c.propiedad.comuna, rol: c.propiedad.rol,
      avaluoFiscalClp: c.propiedad.avaluoFiscal != null ? Number(c.propiedad.avaluoFiscal) : null,
    },
    arrendatario: { nombre: c.arrendatario.nombre, rut: c.arrendatario.rut },
    propietario:  { nombre: c.propietario.nombre,  rut: c.propietario.rut },
  };
}

// ─── Paso 1: conciliar un pago declarado ─────────────────────────────────────

export type ResultadoSimular =
  | { ok: true; estado: "conciliado"; interesCLP: number; diasAtraso: number; totalCLP: number }
  | { ok: true; estado: "en_revision"; totalEsperado: number; diferencia: number }
  | { ok: false; error: string };

export async function simularPago(
  periodoId: string,
  fechaPagoRealStr: string,   // "YYYY-MM-DD"
  montoPagadoCLP: number,
  forzar = false,             // true = el corredor acepta la diferencia y confirma el pago
): Promise<ResultadoSimular> {
  if (!Number.isFinite(montoPagadoCLP) || montoPagadoCLP <= 0) {
    return { ok: false, error: "Monto inválido: debe ser mayor que cero." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPagoRealStr) || isNaN(new Date(fechaPagoRealStr).getTime())) {
    return { ok: false, error: "Fecha inválida." };
  }
  try {
    const actor  = await getActor();
    const tenant = actor.tenant;
    const fechaPagoReal = new Date(fechaPagoRealStr + "T00:00:00Z");

    const resultado = await withTenant(tenant.id, async (tx) => {
      // BL-RC1: Carga y reverifica el estado DENTRO de la TX.
      // La compuerta atómica es el updateMany con WHERE estado='atrasado' más abajo:
      // PostgreSQL serializa el UPDATE de fila, por lo que una TX concurrente verá
      // count=0 y lanzará DomainError sin crear asientos duplicados.
      const periodo = await tx.periodoPago.findFirst({
        where: { id: periodoId, tenantId: tenant.id, estado: "atrasado" },
        include: {
          contrato: {
            select: {
              id: true, denominacion: true, valorArriendo: true,
              moraTasaPct: true, moraDiasGracia: true,
              comisionCorredorPct: true, cobraGastoComun: true,
              arrendatarioId: true, propietarioId: true,
              reajuste: true, fechaInicio: true,
              propiedad: { select: { asignadoAId: true, direccion: true, comuna: true, rol: true, avaluoFiscal: true } },
              arrendatario: { select: { nombre: true, rut: true } },
              propietario:  { select: { nombre: true, rut: true } },
            },
          },
        },
      });
      if (!periodo) {
        throw new DomainError(
          "El período no existe, no pertenece a este corredor, o ya fue procesado.",
        );
      }
      // ADR-0013 (Fase D) — un Colaborador solo concilia pagos de sus propias propiedades.
      if (actor.rol !== "manager" && periodo.contrato.propiedad.asignadoAId !== actor.usuarioId)
        throw new DomainError("No tienes acceso a este período de pago.");

      const c = periodo.contrato;

      // Calcula arriendoCLP desde montoBase del período (fuente canónica de la obligación).
      // Para UF: se usa la cotización al día de vencimiento del período, no al de pago real,
      // porque la obligación se fija en UF a la fecha de vencimiento (el pago tardío
      // agrega mora encima, no revalúa la base).
      let arriendoCLP: number;
      let ufAplicada: number | null = null;
      if (c.denominacion === "UF") {
        const ufRow = await tx.serieUf.findFirst({
          where: { fecha: { lte: periodo.fechaVencimiento } },
          orderBy: { fecha: "desc" },
        });
        if (!ufRow) {
          if (process.env.NODE_ENV === "production") {
            throw new DomainError(
              "No hay datos de UF disponibles para esta fecha. Contacta al administrador.",
            );
          }
          ufAplicada = 37000;
        } else {
          ufAplicada = Number(ufRow.valorClp);
        }
        arriendoCLP = convertirUfAClp(Number(periodo.montoBase), ufAplicada);
      } else {
        arriendoCLP = redondearPeso(Number(periodo.montoBase));
      }

      // ── Reajuste IPC (solo contratos CLP con frecuencia de reajuste activa) ──
      let ipcReajuste: { delta: number; variacionPct: number } | null = null;
      if (c.denominacion === "CLP" && c.reajuste !== "ninguna") {
        const mesesCiclo = c.reajuste === "semestral" ? 6 : 12;
        if (esPeriodoDeReajuste(periodo.numero, mesesCiclo)) {
          const mesInicio = primerDiaMes(c.fechaInicio);
          const mesPago   = primerDiaMes(fechaPagoReal);
          // Secuencial, no Promise.all: tx comparte una única conexión Postgres.
          const ipcIni = await tx.serieIpc.findUnique({ where: { periodo: mesInicio } });
          const ipcFin = await tx.serieIpc.findUnique({ where: { periodo: mesPago  } });
          if (ipcIni && ipcFin) {
            const nuevoArriendo = aplicarReajusteIpc(
              arriendoCLP,
              Number(ipcIni.indice),
              Number(ipcFin.indice),
            );
            const delta = nuevoArriendo - arriendoCLP;
            const variacionPct = variacionIpc(Number(ipcIni.indice), Number(ipcFin.indice)) * 100;
            if (delta !== 0) {
              ipcReajuste = { delta, variacionPct };
              arriendoCLP = nuevoArriendo;
            }
          }
          // Si no hay datos IPC en SerieIpc, se procede sin reajuste (no bloquea el flujo)
        }
      }

      // Mora (fecha real del pago)
      const { diasAtraso, interesCLP } = calcularMora(
        arriendoCLP,
        periodo.fechaVencimiento,
        fechaPagoReal,
        Number(c.moraTasaPct),
        c.moraDiasGracia,
      );

      const montoGastoComun = Number(periodo.montoGastoComun);

      const conciliado = conciliar({
        montoPagadoCLP,
        arriendoCLP,
        montoGastoComun: c.cobraGastoComun ? montoGastoComun : 0,
        interesCLP,
      });

      const montoConciliado  = conciliado.estado === "conciliado";

      // No calzó y el corredor NO forzó: registrar en revisión y devolver diferencia
      if (!montoConciliado && !forzar) {
        await tx.pagoEntrante.create({
          data: {
            tenantId: tenant.id, contratoId: c.id, periodoId,
            montoClp: montoPagadoCLP, fechaPagoReal,
            canal: "transferencia_declarada", estado: "en_revision",
          },
        });
        return {
          ok: true as const, estado: "en_revision" as const,
          totalEsperado: conciliado.totalEsperado,
          diferencia: conciliado.diferencia,
        };
      }

      // BL-RC1: Compuerta atómica — solo la primera TX que llegue aquí actualiza la fila.
      // La segunda TX concurrente verá count=0 (la fila ya es "pagado") y lanzará DomainError,
      // haciendo rollback antes de crear cualquier asiento duplicado.
      const gate = await tx.periodoPago.updateMany({
        where: { id: periodoId, tenantId: tenant.id, estado: "atrasado" },
        data:  { estado: "pagado", fechaPagoReal },
      });
      if (gate.count === 0) {
        throw new DomainError(
          "Este período fue procesado simultáneamente por otra operación. Recarga la página para ver el estado actualizado.",
        );
      }

      const baseAsiento = {
        tenantId: tenant.id,
        contratoId: c.id,
        periodoId: periodo.id,
        arrendatarioId: c.arrendatarioId,
        propietarioId: c.propietarioId,
        fechaEvento: fechaPagoReal,
        monedaOrigen: c.denominacion,
        valorOrigen: c.denominacion === "UF" ? Number(c.valorArriendo) : null,
        ufAplicada,
      };

      // Reajuste IPC (cuando aplica — actualiza valorArriendo del contrato)
      if (ipcReajuste) {
        await tx.asientoLedger.create({
          data: {
            ...baseAsiento,
            tipo: "CARGO_AJUSTE", concepto: "ajuste",
            montoClp: Math.abs(ipcReajuste.delta),
            signo: ipcReajuste.delta >= 0 ? 1 : -1,
            descripcion: `Reajuste IPC período ${periodo.numero}: ${ipcReajuste.variacionPct >= 0 ? "+" : ""}${ipcReajuste.variacionPct.toFixed(2)}%`,
          },
        });
        await tx.contrato.update({
          where: { id: c.id, tenantId: tenant.id },
          data:  { valorArriendo: arriendoCLP },
        });
      }

      // Cargo de interés (si hay mora): omitido cuando el corredor forzó el pago con diferencia
      if (interesCLP > 0 && montoConciliado) {
        await tx.asientoLedger.create({
          data: { ...baseAsiento, tipo: "CARGO_INTERES", concepto: "interes", montoClp: interesCLP,
            descripcion: `Mora ${diasAtraso} días` },
        });
      }

      // Pago recibido — cuando forzado con diferencia, se registra el monto real pagado
      const montoRecibido = montoConciliado ? arriendoCLP + interesCLP : montoPagadoCLP;
      await tx.asientoLedger.create({
        data: { ...baseAsiento, tipo: "PAGO_RECIBIDO", concepto: "arriendo",
          montoClp: montoRecibido,
          ...(forzar && !montoConciliado ? { descripcion: "Pago con diferencia aceptada por corredor" } : {}),
        },
      });

      // Pago recibido — gasto común
      if (c.cobraGastoComun && montoGastoComun > 0) {
        await tx.asientoLedger.create({
          data: { ...baseAsiento, tipo: "PAGO_RECIBIDO", concepto: "gasto_comun",
            montoClp: montoGastoComun },
        });
      }

      // Snapshot congelado del comprobante (L-CP1/3) + folio correlativo (L-CP4).
      const folioPago = await siguienteFolio(tx, tenant.id, "pago", fechaPagoReal);
      const docPago = datosDocumento(tenant, c);
      const snapshotPago = construirSnapshotPago({
        folio: folioPago, fecha: fechaPagoReal, periodoNumero: periodo.numero,
        ...docPago,
        arriendoClp: arriendoCLP,
        interesClp: montoConciliado ? interesCLP : 0,
        diasAtraso,
        montoGastoComunClp: c.cobraGastoComun ? montoGastoComun : 0,
        denominacion: c.denominacion,
        ...(ufAplicada ? { ufAplicada } : {}),
        totalClp: montoPagadoCLP,
      });
      await tx.voucher.create({
        data: {
          tenantId: tenant.id, contratoId: c.id, periodoId: periodo.id,
          arrendatarioId: c.arrendatarioId, tipo: "pago",
          montoClp: montoPagadoCLP, fecha: fechaPagoReal,
          folio: folioPago,
          snapshot: {
            ...snapshotPago,
            ...(forzar && !montoConciliado ? { diferenciaAceptada: conciliado.diferencia } : {}),
          },
        },
      });

      await tx.notificacion.create({
        data: {
          tenantId: tenant.id,
          personaId: c.arrendatarioId,
          contratoId: c.id,
          tipo: "cobro",
          asunto: `Pago recibido — período ${periodo.numero}${ipcReajuste ? ` (reajuste IPC ${ipcReajuste.variacionPct >= 0 ? "+" : ""}${ipcReajuste.variacionPct.toFixed(2)}%)` : ""}`,
          cuerpo: `Monto: $${montoPagadoCLP.toLocaleString("es-CL")}. Fecha: ${fechaPagoRealStr}.`,
          estado: "pendiente",
        },
      });

      return {
        ok: true as const, estado: "conciliado" as const,
        interesCLP: montoConciliado ? interesCLP : 0,
        diasAtraso,
        totalCLP: montoConciliado ? conciliado.totalEsperado : montoPagadoCLP,
      };
    }, { timeout: 15_000 });

    // Solo revalidar cuando el pago fue efectivamente procesado
    if (resultado.estado === "conciliado") {
      revalidatePath("/panel/cobros");
      revalidatePath("/panel/vouchers");
      revalidatePath("/panel");
    }
    return resultado;
  } catch (e) {
    logError("simularPago", e);
    if (e instanceof DomainError) return { ok: false, error: e.message };
    // SEC: nunca exponer mensajes internos (Prisma/stack) al cliente
    return { ok: false, error: "No se pudo procesar el pago. Verifica que el período esté en estado atrasado e intenta nuevamente." };
  }
}

// ─── Paso 2: cerrar la liquidación ───────────────────────────────────────────

export type ResultadoCerrar =
  | { ok: true; comisionCLP: number; descuentoCLP: number; netoCLP: number }
  | { ok: false; error: string };

export interface AjusteForm {
  tipo: TipoAjusteLiquidacion;
  montoCLP: number;
  descripcion: string;
}

export async function cerrarLiquidacion(
  periodoId: string,
  ajustes: AjusteForm[],
): Promise<ResultadoCerrar> {
  for (const a of ajustes) {
    if (!Number.isFinite(a.montoCLP) || a.montoCLP <= 0) {
      return { ok: false, error: "Monto de ajuste inválido: debe ser mayor que cero." };
    }
    if (!a.descripcion?.trim()) {
      return { ok: false, error: "Cada ajuste requiere una descripción." };
    }
  }
  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    const resultado = await withTenant(tenant.id, async (tx) => {
      // BL-RC2: Carga y reverifica el estado DENTRO de la TX.
      const periodo = await tx.periodoPago.findFirst({
        where: { id: periodoId, tenantId: tenant.id, estado: "pagado" },
        include: {
          contrato: {
            select: {
              id: true, denominacion: true, comisionCorredorPct: true,
              arrendatarioId: true, propietarioId: true,
              propiedad: { select: { asignadoAId: true, direccion: true, comuna: true, rol: true, avaluoFiscal: true } },
              arrendatario: { select: { nombre: true, rut: true } },
              propietario:  { select: { nombre: true, rut: true } },
            },
          },
        },
      });
      if (!periodo) {
        throw new DomainError(
          "El período no existe, no pertenece a este corredor, o ya fue liquidado.",
        );
      }
      // ADR-0013 (Fase D) — un Colaborador solo cierra liquidaciones de sus propias propiedades.
      if (actor.rol !== "manager" && periodo.contrato.propiedad.asignadoAId !== actor.usuarioId)
        throw new DomainError("No tienes acceso a este período de pago.");

      const c = periodo.contrato;

      // Obtiene el arriendoCLP del asiento PAGO_RECIBIDO (arriendo) creado en paso 1
      const pagoAsiento = await tx.asientoLedger.findFirst({
        where: { periodoId, tenantId: tenant.id, tipo: "PAGO_RECIBIDO", concepto: "arriendo" },
        select: { montoClp: true, fechaEvento: true, ufAplicada: true, valorOrigen: true },
      });
      if (!pagoAsiento) {
        throw new DomainError("No se encontró el asiento de pago. Concilia primero.");
      }

      const interesAsiento = await tx.asientoLedger.findFirst({
        where: { periodoId, tenantId: tenant.id, tipo: "CARGO_INTERES" },
        select: { montoClp: true },
      });
      const arriendoCLP = Number(pagoAsiento.montoClp) - Number(interesAsiento?.montoClp ?? 0);

      const liq = calcularLiquidacion({
        arriendoCLP,
        ajustes: ajustes.map((a) => ({ tipo: a.tipo, montoCLP: a.montoCLP })),
        comisionPct: Number(c.comisionCorredorPct),
        // La corredora persona jurídica emite comisión afecta; el IVA lo soporta
        // el propietario y sale de su neto (L-IV). Persona natural: exenta.
        comisionAfectaIva: tenant.esPersonaJuridica,
      });

      // BL-RC2: Compuerta atómica — solo la primera TX liquida este período.
      const gate = await tx.periodoPago.updateMany({
        where: { id: periodoId, tenantId: tenant.id, estado: "pagado" },
        data:  { estado: "liquidado" },
      });
      if (gate.count === 0) {
        throw new DomainError(
          "Este período fue liquidado simultáneamente por otra operación. Recarga la página para ver el estado actualizado.",
        );
      }

      const baseAsiento = {
        tenantId: tenant.id, contratoId: c.id, periodoId,
        arrendatarioId: c.arrendatarioId, propietarioId: c.propietarioId,
        fechaEvento: pagoAsiento.fechaEvento,
        monedaOrigen: c.denominacion,
        ufAplicada: pagoAsiento.ufAplicada ? Number(pagoAsiento.ufAplicada) : null,
        valorOrigen: pagoAsiento.valorOrigen ? Number(pagoAsiento.valorOrigen) : null,
      };

      // Ajustes al arrendatario (CARGO_AJUSTE)
      for (const a of ajustes.filter((a) => a.tipo === "cargo_arrendatario")) {
        await tx.asientoLedger.create({
          data: { ...baseAsiento, tipo: "CARGO_AJUSTE", concepto: "ajuste",
            montoClp: a.montoCLP, descripcion: a.descripcion },
        });
      }

      // Ajustes al propietario (AJUSTE_LIQUIDACION)
      if (liq.descuentoPropietarioCLP > 0) {
        for (const a of ajustes.filter((a) => a.tipo === "descuento_propietario" || a.tipo === "retencion")) {
          await tx.asientoLedger.create({
            data: { ...baseAsiento, tipo: "AJUSTE_LIQUIDACION", concepto: "ajuste",
              montoClp: a.montoCLP, descripcion: a.descripcion },
          });
        }
      }

      // Comisión del corredor
      await tx.asientoLedger.create({
        data: { ...baseAsiento, tipo: "COMISION_CORREDOR", concepto: "arriendo",
          montoClp: liq.comisionCLP },
      });

      // IVA de la comisión (solo si la corredora es persona jurídica). Es un
      // asiento aparte para que la liquidación y las vistas puedan mostrarlo por
      // separado, y para que el cuadre del período sea explícito.
      if (liq.ivaComisionCLP > 0) {
        await tx.asientoLedger.create({
          data: { ...baseAsiento, tipo: "IVA_COMISION", concepto: "arriendo",
            montoClp: liq.ivaComisionCLP, descripcion: "IVA de la comisión" },
        });
      }

      // Liquidación al propietario
      await tx.asientoLedger.create({
        data: { ...baseAsiento, tipo: "LIQUIDACION_PROPIETARIO", concepto: "arriendo",
          montoClp: liq.liquidacionNetaCLP,
          descripcion: `Liquidación período ${periodo.numero}` },
      });

      // Registra ajustes en su tabla
      for (const a of ajustes) {
        await tx.ajusteLiquidacion.create({
          data: { tenantId: tenant.id, periodoId, tipo: a.tipo,
            montoCLP: a.montoCLP, descripcion: a.descripcion },
        });
      }

      // Snapshot con el desglose COMPLETO: ajustes uno por uno (L-CP2) e IVA de
      // la comisión según naturaleza jurídica de la corredora (L-IV2) + folio.
      const folioLiq = await siguienteFolio(tx, tenant.id, "liquidacion", pagoAsiento.fechaEvento);
      const docLiq = datosDocumento(tenant, c);
      const snapshotLiq = construirSnapshotLiquidacion({
        folio: folioLiq, fecha: pagoAsiento.fechaEvento, periodoNumero: periodo.numero,
        ...docLiq,
        arriendoClp: arriendoCLP,
        comisionClp: liq.comisionCLP,
        descuentoPropietarioClp: liq.descuentoPropietarioCLP,
        netoPropietarioClp: liq.liquidacionNetaCLP,
        ajustes: ajustes.map((a) => ({ tipo: a.tipo, descripcion: a.descripcion, montoClp: a.montoCLP })),
      });
      await tx.voucher.create({
        data: {
          tenantId: tenant.id, contratoId: c.id, periodoId,
          arrendatarioId: c.arrendatarioId, tipo: "liquidacion",
          montoClp: liq.liquidacionNetaCLP, fecha: pagoAsiento.fechaEvento,
          folio: folioLiq,
          snapshot: snapshotLiq,
        },
      });

      // Notificaciones
      //
      // Van como "pendiente", NO "simulada": el despachador
      // (enviarNotificacionesPendientes) solo toma las pendientes, así que
      // marcarlas simuladas equivalía a no enviarlas nunca. El propietario
      // jamás recibía su aviso de liquidación aunque el voucher sí se generaba.
      const money = (n: number) => `${Math.round(n).toLocaleString("es-CL")}`;

      // Glosa: el desglose ya vive en el snapshot del voucher; sin él, el correo
      // decía solo el total y el destinatario no podía cuadrar de dónde salía.
      const glosaPropietario = [
        `Arriendo: ${money(arriendoCLP)}`,
        `Comisión corredor: -${money(liq.comisionCLP)}`,
        liq.descuentoPropietarioCLP > 0 ? `Descuentos: -${money(liq.descuentoPropietarioCLP)}` : null,
        ...ajustes.map((a) => `${a.descripcion}: ${a.montoCLP < 0 ? "-" : "+"}${money(Math.abs(a.montoCLP))}`),
        `Neto a pagar: ${money(liq.liquidacionNetaCLP)}`,
      ].filter(Boolean).join(" · ");

      await tx.notificacion.create({
        data: { tenantId: tenant.id, personaId: c.arrendatarioId, contratoId: c.id,
          tipo: "voucher_pago", asunto: `Comprobante período ${periodo.numero}`,
          cuerpo: `Comprobante del período ${periodo.numero}. Arriendo: ${money(arriendoCLP)}.`,
          estado: "pendiente" },
      });
      await tx.notificacion.create({
        data: { tenantId: tenant.id, personaId: c.propietarioId, contratoId: c.id,
          tipo: "liquidacion_propietario",
          asunto: `Liquidación período ${periodo.numero}`,
          cuerpo: `Detalle de tu liquidación del período ${periodo.numero}. ${glosaPropietario}.`,
          estado: "pendiente" },
      });

      return {
        ok: true as const,
        comisionCLP: liq.comisionCLP,
        descuentoCLP: liq.descuentoPropietarioCLP,
        netoCLP: liq.liquidacionNetaCLP,
      };
    }, { timeout: 15_000 });

    revalidatePath("/panel/cobros");
    revalidatePath("/panel/vouchers");
    revalidatePath("/panel");
    return resultado;
  } catch (e) {
    logError("cerrarLiquidacion", e);
    if (e instanceof DomainError) return { ok: false, error: e.message };
    // SEC: nunca exponer mensajes internos (Prisma/stack) al cliente
    return { ok: false, error: "No se pudo cerrar la liquidación. Verifica que el período esté conciliado e intenta nuevamente." };
  }
}
