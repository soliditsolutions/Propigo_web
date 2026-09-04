/**
 * Estado de cuenta de deuda (L-CM1).
 *
 * Lo que se cuida: que el desglose tenga cada deuda por separado —arriendo,
 * gasto común, mora— con su período y su fecha, porque eso es lo que la demanda
 * monitoria exige, y que el total sea la suma exacta de las líneas.
 */
import { describe, it, expect } from "vitest";
import { construirEstadoCuenta, type PeriodoDeuda } from "../estado-cuenta";

const contrato = { moraTasaPctMensual: 3, moraDiasGracia: 5 };
const corte = new Date("2026-09-30T00:00:00Z");

describe("construirEstadoCuenta", () => {
  it("desglosa arriendo, gasto común y mora por período (L-CM1)", () => {
    const periodos: PeriodoDeuda[] = [
      { numero: 7, fechaVencimiento: new Date("2026-08-05"), arriendoClp: 450_000, gastoComunClp: 45_000 },
    ];
    const ec = construirEstadoCuenta(periodos, contrato, corte);
    const conceptos = ec.lineas.map((l) => l.concepto);
    expect(conceptos).toContain("arriendo");
    expect(conceptos).toContain("gasto_comun");
    expect(conceptos).toContain("mora");
    // Cada línea trae su período y su fecha de vencimiento (forma, fecha).
    for (const l of ec.lineas) {
      expect(l.periodoNumero).toBe(7);
      expect(l.fechaVencimiento.toISOString().slice(0, 10)).toBe("2026-08-05");
    }
  });

  it("el total es la suma exacta de las líneas", () => {
    const periodos: PeriodoDeuda[] = [
      { numero: 7, fechaVencimiento: new Date("2026-08-05"), arriendoClp: 450_000, gastoComunClp: 45_000 },
      { numero: 8, fechaVencimiento: new Date("2026-09-05"), arriendoClp: 450_000, gastoComunClp: 45_000 },
    ];
    const ec = construirEstadoCuenta(periodos, contrato, corte);
    const suma = ec.lineas.reduce((s, l) => s + l.montoClp, 0);
    expect(ec.totalClp).toBe(suma);
  });

  it("sin gasto común no agrega esa línea", () => {
    const ec = construirEstadoCuenta(
      [{ numero: 3, fechaVencimiento: new Date("2026-08-05"), arriendoClp: 450_000, gastoComunClp: 0 }],
      contrato, corte,
    );
    expect(ec.lineas.some((l) => l.concepto === "gasto_comun")).toBe(false);
  });

  it("dentro de los días de gracia no genera línea de mora, pero sí la deuda", () => {
    // Vence el 28-sep; corte 30-sep = 2 días, dentro de la gracia de 5.
    const ec = construirEstadoCuenta(
      [{ numero: 9, fechaVencimiento: new Date("2026-09-28"), arriendoClp: 450_000, gastoComunClp: 0 }],
      contrato, corte,
    );
    expect(ec.lineas.some((l) => l.concepto === "mora")).toBe(false);
    expect(ec.lineas.some((l) => l.concepto === "arriendo")).toBe(true);
    expect(ec.totalClp).toBe(450_000);
  });

  it("ordena de la deuda más antigua a la más nueva", () => {
    const ec = construirEstadoCuenta(
      [
        { numero: 8, fechaVencimiento: new Date("2026-09-05"), arriendoClp: 450_000, gastoComunClp: 0 },
        { numero: 7, fechaVencimiento: new Date("2026-08-05"), arriendoClp: 450_000, gastoComunClp: 0 },
      ],
      contrato, corte,
    );
    expect(ec.lineas[0].periodoNumero).toBe(7);
  });

  it("sin períodos: estado vacío, total cero", () => {
    const ec = construirEstadoCuenta([], contrato, corte);
    expect(ec.lineas).toEqual([]);
    expect(ec.totalClp).toBe(0);
  });
});
