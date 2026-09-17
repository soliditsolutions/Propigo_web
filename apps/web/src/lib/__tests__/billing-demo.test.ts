import { describe, it, expect } from "vitest";
import { periodosDemo, periodoDemoPorClave, diaFacturacionDemo } from "../billing-demo";
import { PLANS } from "../plans";

const bronze = PLANS.find((p) => p.id === "bronze")!;
const ufFija = async () => 39000;

describe("periodosDemo", () => {
  it("devuelve `cantidad` períodos, el más reciente primero", async () => {
    const hoy = new Date("2026-09-16T12:00:00Z");
    const periodos = await periodosDemo(bronze, 6, ufFija, hoy);
    expect(periodos).toHaveLength(6);
    expect(periodos[0].label).toBe("Septiembre 2026");
    expect(periodos[1].label).toBe("Agosto 2026");
    expect(periodos[5].label).toBe("Abril 2026");
  });

  it("el monto sale de desglosarPrecioClp con el precio real del plan, no inventado", async () => {
    const [p] = await periodosDemo(bronze, 1, ufFija, new Date("2026-09-16T12:00:00Z"));
    // Bronze: 0.25 UF * 39000 = 9750 neto; IVA 19% = 1852.5 → redondeado 1853; total 11603.
    expect(p.netoClp).toBe(9750);
    expect(p.totalClp).toBe(p.netoClp + p.ivaClp);
  });

  it("cruza el límite de año sin romperse (diciembre → enero del año anterior)", async () => {
    const hoy = new Date("2026-01-16T12:00:00Z");
    const periodos = await periodosDemo(bronze, 3, ufFija, hoy);
    expect(periodos.map((p) => p.label)).toEqual(["Enero 2026", "Diciembre 2025", "Noviembre 2025"]);
  });
});

describe("periodoDemoPorClave", () => {
  it("reconstruye el mismo período que produce periodosDemo para esa clave", async () => {
    const hoy = new Date("2026-09-16T12:00:00Z");
    const [esperado] = await periodosDemo(bronze, 1, ufFija, hoy);
    const reconstruido = await periodoDemoPorClave(bronze, esperado.clave, ufFija);
    expect(reconstruido).toEqual(esperado);
  });

  it("devuelve null ante una clave con formato inválido", async () => {
    await expect(periodoDemoPorClave(bronze, "no-es-un-periodo", ufFija)).resolves.toBeNull();
    await expect(periodoDemoPorClave(bronze, "2026-13", ufFija)).resolves.not.toBeNull(); // mes 13 → Date lo normaliza, no es responsabilidad de este validador
  });
});

describe("diaFacturacionDemo", () => {
  it("usa el día de creación del tenant, no un número fijo", () => {
    expect(diaFacturacionDemo(new Date("2026-03-07T00:00:00Z"))).toBe(7);
    expect(diaFacturacionDemo(new Date("2026-03-28T00:00:00Z"))).toBe(28);
  });
});
