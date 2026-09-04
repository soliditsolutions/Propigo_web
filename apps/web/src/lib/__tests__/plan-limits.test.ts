/**
 * Cupos por plan — Fase B0 del rowMap.
 *
 * Cubre las dos mitades del enforcement:
 *  - la tabla de planes (qué números vende cada uno y el fallback conservador);
 *  - los helpers que los aplican contra la base.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  PLANS,
  IVA_PCT,
  MESES_PAGADOS_ANUAL,
  getCupoPropiedades,
  getCupoTokensDiarios,
  getCupoUsuarios,
  getPlanEfectivo,
  puedeExportar,
  precioUf,
  desglosarPrecioClp,
} from "../plans";
import { verificarCupoPropiedades, consumirTokenIa, consultarConsumoIaHoy } from "../plan-limits";
import type { TenantClient } from "../tenant-db";

const TENANT = "11111111-1111-4111-8111-111111111111";

/** Planes desconocidos que deben caer al cupo más bajo, no a ilimitado. */
const PLANES_INVALIDOS = [null, "", "Gratuito", "GRATUITO", "enterprise", "diamond_v2", "DIAMOND", " gold "];

describe("Tabla de planes", () => {
  it("los 4 planes tienen los cupos decididos", () => {
    expect(PLANS.map((p) => [p.id, p.maxPropiedades, p.maxUsuarios, p.tokensDiarios])).toEqual([
      ["bronze", 10, 1, 3],
      ["silver", 25, 1, 10],
      ["gold", 75, 5, 30],
      ["diamond", 200, 10, 100],
    ]);
  });

  it("los precios en UF son los decididos y el anual equivale a 10 meses", () => {
    for (const p of PLANS) {
      expect(p.anualUf).toBeCloseTo(p.mensualUf * MESES_PAGADOS_ANUAL, 10);
    }
    expect(PLANS.map((p) => p.mensualUf)).toEqual([0.25, 0.5, 0.9, 1.7]);
    expect(PLANS.map((p) => p.anualUf)).toEqual([2.5, 5, 9, 17]);
  });

  it("los cupos crecen de forma monótona entre planes", () => {
    // Si un plan más caro diera menos de algo, la escalera de precios dejaría
    // de tener sentido y nadie lo notaría hasta que un cliente reclamara.
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].maxPropiedades).toBeGreaterThan(PLANS[i - 1].maxPropiedades);
      expect(PLANS[i].tokensDiarios).toBeGreaterThan(PLANS[i - 1].tokensDiarios);
      expect(PLANS[i].mensualUf).toBeGreaterThan(PLANS[i - 1].mensualUf);
      // Los usuarios NO crecen estrictamente: Bronze y Silver comparten el tope
      // de 1 usuario a propósito (ninguno tiene subusuarios). Basta con que no
      // decrezca; lo que diferencia a Silver de Bronze son propiedades, tokens
      // y precio, no los usuarios.
      expect(PLANS[i].maxUsuarios).toBeGreaterThanOrEqual(PLANS[i - 1].maxUsuarios);
    }
  });

  it("Bronze y Silver no tienen subusuarios; Gold y Diamond sí", () => {
    // Regla de producto: los dos planes de entrada son de un solo usuario (el
    // Manager). El multiusuario empieza en Gold.
    const cupo = (id: string) => PLANS.find((p) => p.id === id)!.maxUsuarios;
    expect(cupo("bronze")).toBe(1);
    expect(cupo("silver")).toBe(1);
    expect(cupo("gold")).toBe(5);
    expect(cupo("diamond")).toBe(10);
  });

  it("la exportación está desde Gold", () => {
    expect(puedeExportar("bronze")).toBe(false);
    expect(puedeExportar("silver")).toBe(false);
    expect(puedeExportar("gold")).toBe(true);
    expect(puedeExportar("diamond")).toBe(true);
  });

  it("ningún plan promete tokens ilimitados", () => {
    // "Ilimitado" sería un costo abierto contra la API de IA y, además,
    // imposible de aplicar. Decisión N-02.
    for (const p of PLANS) {
      expect(Number.isFinite(p.tokensDiarios)).toBe(true);
      expect(p.tokensDiarios).toBeGreaterThan(0);
    }
  });
});

describe("Fallback conservador — un plan desconocido nunca abre permisos", () => {
  it.each(PLANES_INVALIDOS)("%s cae en el cupo de Bronze", (plan) => {
    expect(getPlanEfectivo(plan).id).toBe("bronze");
    expect(getCupoPropiedades(plan)).toBe(10);
    expect(getCupoUsuarios(plan)).toBe(1);
    expect(getCupoTokensDiarios(plan)).toBe(3);
    expect(puedeExportar(plan)).toBe(false);
  });
});

describe("Precios en CLP", () => {
  it("desglosa neto, IVA y total con montos enteros", () => {
    // 0,25 UF con UF a $39.000 ⇒ neto 9.750, IVA 19 % = 1.853 (redondeado), total 11.603
    const d = desglosarPrecioClp(0.25, 39_000);
    expect(d.netoClp).toBe(9_750);
    expect(d.ivaClp).toBe(1_853);
    expect(d.totalClp).toBe(11_603);
    for (const v of Object.values(d)) expect(Number.isInteger(v)).toBe(true);
  });

  it("el total siempre es neto + IVA", () => {
    for (const plan of PLANS) {
      for (const ciclo of ["mensual", "anual"] as const) {
        const d = desglosarPrecioClp(precioUf(plan, ciclo), 38_500);
        expect(d.totalClp).toBe(d.netoClp + d.ivaClp);
      }
    }
  });

  it("usa la tasa de IVA de la constante única", () => {
    const d = desglosarPrecioClp(1, 100_000);
    expect(d.ivaClp).toBe(Math.round((100_000 * IVA_PCT) / 100));
  });
});

describe("verificarCupoPropiedades", () => {
  function txConCount(usadas: number) {
    return { propiedad: { count: vi.fn().mockResolvedValue(usadas) } } as unknown as TenantClient;
  }

  it("permite crear cuando está bajo el límite", async () => {
    const r = await verificarCupoPropiedades(txConCount(9), TENANT, "bronze");
    expect(r).toEqual({ permitido: true, usado: 9, max: 10 });
  });

  it("rechaza justo al alcanzar el límite", async () => {
    const r = await verificarCupoPropiedades(txConCount(10), TENANT, "bronze");
    expect(r.permitido).toBe(false);
  });

  it("rechaza si de algún modo ya está por sobre el límite (downgrade previo)", async () => {
    const r = await verificarCupoPropiedades(txConCount(40), TENANT, "silver");
    expect(r).toEqual({ permitido: false, usado: 40, max: 25 });
  });

  it("cuenta TODAS las propiedades del tenant, sin filtrar por estado", async () => {
    // Decisión N-05: borrador, disponible, reservada y arrendada ocupan cupo,
    // igual que dice el tooltip publicado.
    const count = vi.fn().mockResolvedValue(3);
    const tx = { propiedad: { count } } as unknown as TenantClient;
    await verificarCupoPropiedades(tx, TENANT, "gold");
    expect(count).toHaveBeenCalledWith({ where: { tenantId: TENANT } });
  });
});

describe("consumirTokenIa", () => {
  let queryRaw: ReturnType<typeof vi.fn>;
  let tx: TenantClient;

  beforeEach(() => {
    queryRaw = vi.fn();
    tx = { $queryRaw: queryRaw } as unknown as TenantClient;
  });

  it("descuenta y permite cuando queda cupo", async () => {
    queryRaw.mockResolvedValue([{ usados: 1 }]);
    const r = await consumirTokenIa(tx, TENANT, "bronze");
    expect(r).toEqual({ permitido: true, usado: 1, max: 3 });
  });

  it("rechaza cuando la sentencia no actualiza ninguna fila (cupo agotado)", async () => {
    // El WHERE del ON CONFLICT no calzó ⇒ ya estaba en el máximo.
    queryRaw.mockResolvedValue([]);
    const r = await consumirTokenIa(tx, TENANT, "bronze");
    expect(r).toEqual({ permitido: false, usado: 3, max: 3 });
  });

  it("descuenta contra el cupo del plan EFECTIVO, no del string recibido", async () => {
    // Un plan desconocido no queda sin límite: cae a Bronze y consume contra
    // ese cupo. Nota: la guarda `max <= 0` de plan-limits.ts es defensiva para
    // un futuro plan sin IA — hoy es inalcanzable porque los 4 planes tienen
    // cupo > 0 y el fallback es Bronze.
    queryRaw.mockResolvedValue([{ usados: 1 }]);
    const r = await consumirTokenIa(tx, TENANT, "Gratuito");
    expect(r).toEqual({ permitido: true, usado: 1, max: 3 });
  });

  it("respeta el cupo alto de Diamond sin volverlo ilimitado", async () => {
    queryRaw.mockResolvedValue([{ usados: 100 }]);
    const r = await consumirTokenIa(tx, TENANT, "diamond");
    expect(r).toEqual({ permitido: true, usado: 100, max: 100 });
  });

  it("hace el chequeo y el incremento en UNA sola sentencia (sin carrera)", async () => {
    queryRaw.mockResolvedValue([{ usados: 5 }]);
    await consumirTokenIa(tx, TENANT, "gold");
    // Leer-comparar-escribir en pasos separados dejaría que dos peticiones
    // simultáneas se pasen del cupo. Debe ser exactamente una consulta.
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("consultarConsumoIaHoy", () => {
  it("devuelve 0 usados cuando el tenant no consumió nada hoy", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as TenantClient;
    const r = await consultarConsumoIaHoy(tx, TENANT, "silver");
    expect(r).toEqual({ permitido: true, usado: 0, max: 10 });
  });

  it("refleja el consumo existente y marca sin cupo al llegar al máximo", async () => {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([{ usados: 10 }]) } as unknown as TenantClient;
    const r = await consultarConsumoIaHoy(tx, TENANT, "silver");
    expect(r).toEqual({ permitido: false, usado: 10, max: 10 });
  });
});
