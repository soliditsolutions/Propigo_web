/**
 * Tests: reglas del cambio de plan (P-B6 / P-B7, decisiones D-18 y D-05).
 *
 * Lo que se cuida: que la diferencia del upgrade inmediato sea la del mes
 * COMPLETO (sin prorrateo, D-18/D-13) y que el gate de downgrade bloquee
 * exactamente cuando la cuenta no cabe en el plan destino — ni antes (bloquear
 * a quien ya liberó cupo) ni después (dejar bajar a quien quedaría excedido).
 */
import { describe, it, expect } from "vitest";
import { getPlanEfectivo } from "@/lib/plans";
import { tipoDeCambio, diferenciaUpgradeUf, excedentesParaPlan } from "../cambio-plan";

const bronze  = getPlanEfectivo("bronze");
const silver  = getPlanEfectivo("silver");
const gold    = getPlanEfectivo("gold");
const diamond = getPlanEfectivo("diamond");

describe("tipoDeCambio", () => {
  it("sigue el orden de los planes", () => {
    expect(tipoDeCambio(bronze, gold)).toBe("upgrade");
    expect(tipoDeCambio(diamond, silver)).toBe("downgrade");
  });

  it("es null si el plan no cambia", () => {
    expect(tipoDeCambio(gold, gold)).toBeNull();
  });
});

describe("diferenciaUpgradeUf", () => {
  it("cobra la diferencia mensual completa, sin prorrateo", () => {
    expect(diferenciaUpgradeUf(bronze, silver)).toBe(silver.mensualUf - bronze.mensualUf);
    expect(diferenciaUpgradeUf(silver, diamond)).toBe(1.2);
  });

  it("no arrastra colas de coma flotante", () => {
    // 0.9 − 0.5 en coma flotante es 0.4000000000000001
    expect(diferenciaUpgradeUf(silver, gold)).toBe(0.4);
  });

  it("rechaza un downgrade o el mismo plan", () => {
    expect(() => diferenciaUpgradeUf(gold, silver)).toThrow();
    expect(() => diferenciaUpgradeUf(gold, gold)).toThrow();
  });
});

describe("excedentesParaPlan (gate de downgrade)", () => {
  it("permite bajar justo en el límite", () => {
    expect(excedentesParaPlan(silver, { propiedades: silver.maxPropiedades, usuarios: silver.maxUsuarios })).toEqual([]);
  });

  it("bloquea con una propiedad de más e informa cuántas sobran", () => {
    expect(excedentesParaPlan(silver, { propiedades: silver.maxPropiedades + 1, usuarios: 1 })).toEqual([
      { recurso: "propiedades", uso: silver.maxPropiedades + 1, max: silver.maxPropiedades, sobran: 1 },
    ]);
  });

  it("reporta usuarios y propiedades a la vez", () => {
    const ex = excedentesParaPlan(bronze, { propiedades: 30, usuarios: 4 });
    expect(ex.map((e) => [e.recurso, e.sobran])).toEqual([
      ["propiedades", 30 - bronze.maxPropiedades],
      ["usuarios", 4 - bronze.maxUsuarios],
    ]);
  });
});
