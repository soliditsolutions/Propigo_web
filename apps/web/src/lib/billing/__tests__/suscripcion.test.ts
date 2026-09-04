/**
 * Suscripción — helpers puros del alta (sin base ni pasarela).
 *
 * El caso que más importa acá es la vigencia: el acceso al panel lo decide la
 * FECHA pagada, no el string del plan. Un error en `suscripcionVigente` deja
 * entrar a quien no pagó, o expulsa a quien sí.
 */
import { describe, it, expect } from "vitest";
import {
  esPlanValido, etiquetaPeriodo, periodoHasta, montoSuscripcion,
  claveCobroSuscripcion, suscripcionVigente,
} from "../suscripcion";
import { IVA_PCT } from "@/lib/plans";

describe("esPlanValido", () => {
  it("acepta los cuatro planes reales", () => {
    for (const p of ["bronze", "silver", "gold", "diamond"]) {
      expect(esPlanValido(p), p).toBe(true);
    }
  });
  it("rechaza el tier gratuito y cualquier valor desconocido", () => {
    for (const p of ["Gratuito", "", "enterprise", "GOLD", " gold "]) {
      expect(esPlanValido(p), p).toBe(false);
    }
  });
});

describe("etiquetaPeriodo", () => {
  it("da 'YYYY-MM' en UTC con mes de dos dígitos", () => {
    expect(etiquetaPeriodo(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01");
    expect(etiquetaPeriodo(new Date("2026-12-31T23:00:00Z"))).toBe("2026-12");
  });
});

describe("periodoHasta", () => {
  it("mensual suma un mes de calendario", () => {
    expect(periodoHasta("mensual", new Date("2026-01-15T00:00:00Z")).toISOString())
      .toBe("2026-02-15T00:00:00.000Z");
  });
  it("anual suma doce meses", () => {
    expect(periodoHasta("anual", new Date("2026-01-15T00:00:00Z")).toISOString())
      .toBe("2027-01-15T00:00:00.000Z");
  });
  it("ancla al último día cuando el mes destino no tiene ese día", () => {
    // 31 de enero + 1 mes no es 31 de febrero: se ancla al 28.
    expect(periodoHasta("mensual", new Date("2026-01-31T00:00:00Z")).toISOString())
      .toBe("2026-02-28T00:00:00.000Z");
  });
});

describe("montoSuscripcion", () => {
  it("desglosa neto, IVA y total desde la UF del plan", () => {
    // bronze mensual = 0,25 UF; UF a 39.000 ⇒ neto 9.750, IVA 19% = 1.853, total 11.603.
    const m = montoSuscripcion("bronze", "mensual", 39_000);
    expect(m.montoUf).toBe(0.25);
    expect(m.ufAplicada).toBe(39_000);
    expect(m.netoClp).toBe(9_750);
    expect(m.ivaClp).toBe(Math.round((9_750 * IVA_PCT) / 100));
    expect(m.totalClp).toBe(m.netoClp + m.ivaClp);
  });
  it("el anual cuesta más que el mensual del mismo plan", () => {
    const men = montoSuscripcion("gold", "mensual", 39_000);
    const anu = montoSuscripcion("gold", "anual", 39_000);
    expect(anu.totalClp).toBeGreaterThan(men.totalClp);
  });
});

describe("claveCobroSuscripcion", () => {
  it("es determinista por tenant y período", () => {
    expect(claveCobroSuscripcion("t1", "2026-09")).toBe("sub_t1_2026-09");
    // Misma clave dos veces = mismo string ⇒ el índice único evita el doble cobro.
    expect(claveCobroSuscripcion("t1", "2026-09"))
      .toBe(claveCobroSuscripcion("t1", "2026-09"));
    // Distinto período, distinta clave.
    expect(claveCobroSuscripcion("t1", "2026-10"))
      .not.toBe(claveCobroSuscripcion("t1", "2026-09"));
  });
});

describe("suscripcionVigente", () => {
  const AHORA = new Date("2026-09-15T00:00:00Z");
  const futuro = new Date("2026-10-01T00:00:00Z");
  const pasado = new Date("2026-09-01T00:00:00Z");

  it("sin suscripción, no hay acceso", () => {
    expect(suscripcionVigente(null, AHORA)).toBe(false);
  });
  it("activa y dentro del período: acceso", () => {
    expect(suscripcionVigente({ estado: "activa", periodoActualHasta: futuro }, AHORA)).toBe(true);
  });
  it("activa pero con el período ya vencido: sin acceso", () => {
    // Es el caso de la renovación que no se cobró: el estado sigue "activa"
    // pero la fecha manda.
    expect(suscripcionVigente({ estado: "activa", periodoActualHasta: pasado }, AHORA)).toBe(false);
  });
  it("cancelada sigue dando acceso hasta el fin del período pagado (D-05)", () => {
    expect(suscripcionVigente({ estado: "cancelada", periodoActualHasta: futuro }, AHORA)).toBe(true);
  });
  it("suspendida o expirada: sin acceso aunque la fecha fuera futura", () => {
    expect(suscripcionVigente({ estado: "suspendida", periodoActualHasta: futuro }, AHORA)).toBe(false);
    expect(suscripcionVigente({ estado: "expirada", periodoActualHasta: futuro }, AHORA)).toBe(false);
  });
  it("pago_pendiente (en gracia) conserva acceso mientras el período no venza", () => {
    expect(suscripcionVigente({ estado: "pago_pendiente", periodoActualHasta: futuro }, AHORA)).toBe(true);
  });
});
