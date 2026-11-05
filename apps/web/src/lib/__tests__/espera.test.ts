import { describe, it, expect } from "vitest";
import { textoEspera } from "../espera";

describe("textoEspera (Retry-After → palabras)", () => {
  it("segundos", () => {
    expect(textoEspera("45")).toBe("45 segundos");
    expect(textoEspera("1")).toBe("un momento");
    expect(textoEspera("0")).toBe("un momento");
  });

  it("redondea a minutos hacia arriba", () => {
    expect(textoEspera("60")).toBe("1 minuto");
    expect(textoEspera("61")).toBe("2 minutos");
    expect(textoEspera("600")).toBe("10 minutos");
  });

  it("acepta una fecha HTTP", () => {
    const ahora = Date.parse("2026-11-05T12:00:00Z");
    expect(textoEspera("Thu, 05 Nov 2026 12:00:30 GMT", ahora)).toBe("30 segundos");
    expect(textoEspera("Thu, 05 Nov 2026 11:59:00 GMT", ahora)).toBe("un momento");
  });

  it("sin cabecera o ilegible: plazo genérico", () => {
    expect(textoEspera(null)).toBe("unos minutos");
    expect(textoEspera("")).toBe("unos minutos");
    expect(textoEspera("mañana")).toBe("unos minutos");
    expect(textoEspera("-5")).toBe("unos minutos");
  });
});
