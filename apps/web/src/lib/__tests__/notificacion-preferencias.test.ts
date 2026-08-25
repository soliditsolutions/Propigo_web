/**
 * Preferencias de notificación — dominio.
 *
 * Lo que se prueba es la regla que decide si un correo sale o no. Los dos
 * errores posibles tienen costos muy distintos: enviarle a alguien que pidió
 * la baja es un incumplimiento (art. 28 B, Ley 19.496); dejar de enviarle a
 * quien nunca la pidió lo deja sin avisos de su propio arriendo. Ninguno es
 * aceptable, así que se fijan ambos bordes.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  puedeRecibir,
  describirPreferencia,
  calcularBajaHasta,
  firmarTokenBaja,
  verificarTokenBaja,
  DURACIONES,
  MAX_CORREOS_POR_DIA,
} from "../notificacion-preferencias";

const HOY = new Date("2026-08-19T12:00:00Z");

describe("puedeRecibir", () => {
  it("sin preferencia registrada, recibe", () => {
    // La ausencia de fila significa suscrito: nadie queda sin avisos porque
    // el alta se haya olvidado de crear el registro.
    expect(puedeRecibir(null, HOY)).toBe(true);
  });

  it("suscrito explícito, recibe", () => {
    expect(puedeRecibir({ suscrito: true, bajaHasta: null }, HOY)).toBe(true);
  });

  it("baja permanente, NO recibe", () => {
    expect(puedeRecibir({ suscrito: false, bajaHasta: null }, HOY)).toBe(false);
  });

  it("baja temporal vigente, NO recibe", () => {
    const futuro = new Date("2026-09-30T00:00:00Z");
    expect(puedeRecibir({ suscrito: false, bajaHasta: futuro }, HOY)).toBe(false);
  });

  it("baja temporal ya vencida, vuelve a recibir sin intervención", () => {
    const pasado = new Date("2026-07-01T00:00:00Z");
    expect(puedeRecibir({ suscrito: false, bajaHasta: pasado }, HOY)).toBe(true);
  });

  it("el mismo día del término todavía NO recibe", () => {
    // Se resuelve a favor de la persona: la pausa se respeta completa.
    const hoyMismo = new Date("2026-08-19T12:00:00Z");
    expect(puedeRecibir({ suscrito: false, bajaHasta: hoyMismo }, HOY)).toBe(false);
  });
});

describe("calcularBajaHasta", () => {
  it("permanente devuelve null", () => {
    expect(calcularBajaHasta("permanente", HOY)).toBeNull();
  });

  it.each([["1m", 30], ["3m", 90]])("%s suma %i días", (clave, dias) => {
    const hasta = calcularBajaHasta(clave, HOY)!;
    const diff = Math.round((hasta.getTime() - HOY.getTime()) / 86400000);
    expect(diff).toBe(dias);
  });

  it("lanza ante una duración desconocida en vez de asumir permanente", () => {
    // Asumir permanente silenciaría para siempre a quien pidió una pausa.
    expect(() => calcularBajaHasta("para-siempre-jamas", HOY)).toThrow(/desconocida/i);
  });

  it("todas las duraciones publicadas se pueden calcular", () => {
    for (const d of DURACIONES) {
      expect(() => calcularBajaHasta(d.clave, HOY)).not.toThrow();
    }
  });
});

describe("token de baja", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "x".repeat(48);
  });

  it("ida y vuelta: se firma y se verifica", async () => {
    const t = await firmarTokenBaja("persona-1", "tenant-1");
    const p = await verificarTokenBaja(t);
    expect(p?.personaId).toBe("persona-1");
    expect(p?.tenantId).toBe("tenant-1");
  });

  it("rechaza un token manipulado", async () => {
    const t = await firmarTokenBaja("persona-1", "tenant-1");
    const roto = t.slice(0, -3) + "abc";
    expect(await verificarTokenBaja(roto)).toBeNull();
  });

  it("rechaza basura", async () => {
    expect(await verificarTokenBaja("no-es-un-token")).toBeNull();
    expect(await verificarTokenBaja("")).toBeNull();
  });

  it("un token de baja NO sirve como sesión de portal", async () => {
    // Ámbitos separados por prefijo de secreto: si esto fallara, un enlace de
    // un correo archivado sería una llave al portal de la persona.
    const t = await firmarTokenBaja("persona-1", "tenant-1");
    const { verifyPortalToken } = await import("../portal-auth");
    expect(await verifyPortalToken(t)).toBeNull();
  });
});

describe("describirPreferencia", () => {
  it("distingue los tres estados", () => {
    expect(describirPreferencia(null, HOY)).toMatch(/recibes/i);
    expect(describirPreferencia({ suscrito: false, bajaHasta: null }, HOY)).toMatch(/baja/i);
    expect(describirPreferencia({ suscrito: false, bajaHasta: new Date("2026-09-30T00:00:00Z") }, HOY))
      .toMatch(/pausados hasta/i);
  });
});

describe("tope de volumen", () => {
  it("es un número bajo y explícito", () => {
    // El valor puede discutirse; que exista un tope, no.
    expect(MAX_CORREOS_POR_DIA).toBeGreaterThan(0);
    expect(MAX_CORREOS_POR_DIA).toBeLessThanOrEqual(5);
  });
});
