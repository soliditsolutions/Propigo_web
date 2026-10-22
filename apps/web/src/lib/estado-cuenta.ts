/**
 * Estado de cuenta de deuda (L-CM1).
 *
 * Es el documento que exige la demanda monitoria (Ley 21.461 / procedimiento
 * monitorio, Art. 758 y ss. CPC): no basta un total, hay que decir por cada
 * deuda **la forma, la fecha y el lugar** en que se contrajo. Por eso este
 * builder no suma los períodos en un número: los desglosa línea por línea —
 * arriendo, gasto común e interés por mora, cada uno con su período, su fecha de
 * vencimiento y el inmueble— para que el documento sea oponible.
 *
 * Es puro: recibe los períodos ya calculados en CLP y la fecha de corte, y no
 * toca base. La mora se calcula a la fecha de corte con el mismo motor del
 * resto del sistema (`calcularMora`).
 */
import { calcularMora } from "@propigo/core";

export type PeriodoDeuda = {
  numero: number;
  fechaVencimiento: Date;
  arriendoClp: number;
  gastoComunClp: number;
};

export type ContratoMora = {
  moraTasaPctMensual: number;
  moraDiasGracia: number;
};

/** Una línea del estado de cuenta: qué se debe, de cuándo, y cuánto. */
export type LineaDeuda = {
  concepto: "arriendo" | "gasto_comun" | "mora";
  periodoNumero: number;
  /** Fecha en que se contrajo/venció la obligación. */
  fechaVencimiento: Date;
  descripcion: string;
  montoClp: number;
};

export type EstadoCuenta = {
  fechaCorte: Date;
  lineas: LineaDeuda[];
  totalClp: number;
};

/**
 * Arma el estado de cuenta de deuda a una fecha de corte.
 *
 * La mora corre por período desde su vencimiento hasta la fecha de corte, con la
 * tasa y los días de gracia del contrato. Un período sin atraso efectivo (aún
 * dentro de la gracia) no genera línea de mora, pero sí de arriendo/GC si está
 * vencido e impago —de eso se trata la deuda—.
 */
export function construirEstadoCuenta(
  periodos: PeriodoDeuda[],
  contrato: ContratoMora,
  fechaCorte: Date,
): EstadoCuenta {
  const lineas: LineaDeuda[] = [];

  // Orden estable por período: el documento se lee de la deuda más antigua a la
  // más nueva, como cualquier estado de cuenta.
  const ordenados = [...periodos].sort((a, b) => a.numero - b.numero);

  for (const p of ordenados) {
    lineas.push({
      concepto: "arriendo",
      periodoNumero: p.numero,
      fechaVencimiento: p.fechaVencimiento,
      descripcion: `Arriendo período ${p.numero}`,
      montoClp: p.arriendoClp,
    });
    if (p.gastoComunClp > 0) {
      lineas.push({
        concepto: "gasto_comun",
        periodoNumero: p.numero,
        fechaVencimiento: p.fechaVencimiento,
        descripcion: `Gasto común período ${p.numero}`,
        montoClp: p.gastoComunClp,
      });
    }
    // La mora se calcula sobre arriendo + gasto común: ambos vencieron ese día.
    const baseMora = p.arriendoClp + p.gastoComunClp;
    const { interesCLP, diasAtraso } = calcularMora(
      baseMora, p.fechaVencimiento, fechaCorte,
      contrato.moraTasaPctMensual, contrato.moraDiasGracia,
    );
    if (interesCLP > 0) {
      lineas.push({
        concepto: "mora",
        periodoNumero: p.numero,
        fechaVencimiento: p.fechaVencimiento,
        descripcion: `Interés por mora período ${p.numero} (${diasAtraso} días)`,
        montoClp: interesCLP,
      });
    }
  }

  const totalClp = lineas.reduce((s, l) => s + l.montoClp, 0);
  return { fechaCorte, lineas, totalClp };
}
