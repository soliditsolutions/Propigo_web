import { describe, expect, it } from "vitest";
import { calcularNeuronas, MODELO_TEXTO_DEFECTO, MODELO_VISION_DEFECTO } from "../precios";
import {
  hayCupoIa, inicioDiaUtc, NEURONAS_GRATIS_DIA, presupuestoNeuronasDia, topeDelFlujo, type AlmacenUsoIa,
} from "../uso";

describe("calcularNeuronas", () => {
  it("usa la tabla de precios por millón de tokens", () => {
    // 1 M de entrada de Scout = 24.545; 1 M de salida = 77.273.
    expect(calcularNeuronas(MODELO_VISION_DEFECTO, 1_000_000, 0)).toBe(24_545);
    expect(calcularNeuronas(MODELO_VISION_DEFECTO, 0, 1_000_000)).toBe(77_273);
  });

  it("una revisión típica de contrato cuesta ≈ 330 neuronas", () => {
    expect(calcularNeuronas(MODELO_TEXTO_DEFECTO, 7000, 700)).toBe(331);
  });

  it("redondea hacia arriba: una llamada nunca cuesta 0 si gastó tokens", () => {
    expect(calcularNeuronas(MODELO_VISION_DEFECTO, 1, 0)).toBe(1);
  });

  it("un modelo fuera de la tabla da 0 en vez de inventar un costo", () => {
    expect(calcularNeuronas("@cf/otro/modelo", 5000, 500)).toBe(0);
  });
});

describe("tope diario", () => {
  it("el día de Cloudflare empieza a las 00:00 UTC", () => {
    expect(inicioDiaUtc(new Date("2026-11-13T23:59:59Z")).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    expect(inicioDiaUtc(new Date("2026-11-13T00:00:00Z")).toISOString()).toBe("2026-11-13T00:00:00.000Z");
  });

  it("sin variable, el presupuesto es lo gratis de Cloudflare", () => {
    expect(presupuestoNeuronasDia({})).toBe(NEURONAS_GRATIS_DIA);
    expect(presupuestoNeuronasDia({ IA_NEURONAS_DIA: "" })).toBe(NEURONAS_GRATIS_DIA);
  });

  it("IA_NEURONAS_DIA lo sube, y 0 quita el tope", () => {
    expect(presupuestoNeuronasDia({ IA_NEURONAS_DIA: "50000" })).toBe(50_000);
    expect(presupuestoNeuronasDia({ IA_NEURONAS_DIA: "0" })).toBe(Infinity);
  });

  it("un valor inválido vuelve al presupuesto gratis, no abre el tope", () => {
    for (const v of ["abc", "-5", "1.5"]) {
      expect(presupuestoNeuronasDia({ IA_NEURONAS_DIA: v })).toBe(NEURONAS_GRATIS_DIA);
    }
  });

  it("las revisiones de contrato tienen el 70 % del total; el registro, todo", () => {
    expect(topeDelFlujo("contrato_validar_doc", {})).toBe(7_000);
    expect(topeDelFlujo("registro_cedula", {})).toBe(10_000);
  });

  const almacenCon = (gastadas: number): AlmacenUsoIa => ({
    neuronasDesde: async () => gastadas,
    registrar: async () => {},
  });

  it("las revisiones se cortan antes que el registro, que conserva su reserva", async () => {
    const ahora = new Date("2026-11-13T15:00:00Z");
    // 7.500 gastadas: sobre el 70 % de las revisiones, bajo el 100 % del registro.
    expect(await hayCupoIa("contrato_validar_doc", almacenCon(7_500), ahora, {})).toBe(false);
    expect(await hayCupoIa("registro_cedula", almacenCon(7_500), ahora, {})).toBe(true);
    expect(await hayCupoIa("registro_cedula", almacenCon(10_000), ahora, {})).toBe(false);
  });

  it("consulta el consumo desde el inicio del día UTC", async () => {
    let desde: Date | null = null;
    const almacen: AlmacenUsoIa = { neuronasDesde: async (d) => { desde = d; return 0; }, registrar: async () => {} };
    await hayCupoIa("registro_cedula", almacen, new Date("2026-11-13T22:30:00Z"), {});
    expect(desde!.toISOString()).toBe("2026-11-13T00:00:00.000Z");
  });

  it("sin tope propio no consulta la base", async () => {
    let consultas = 0;
    const almacen: AlmacenUsoIa = { neuronasDesde: async () => { consultas++; return 0; }, registrar: async () => {} };
    expect(await hayCupoIa("contrato_validar_doc", almacen, new Date(), { IA_NEURONAS_DIA: "0" })).toBe(true);
    expect(consultas).toBe(0);
  });
});
