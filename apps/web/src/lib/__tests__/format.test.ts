/**
 * Tests: plural() y cantidad() — concordancia de número en la copy.
 *
 * Motivación: erradicar el "día(s)" de la interfaz (guía de estilo editorial
 * §4). El caso crítico es n = 1, que es donde el paréntesis se hacía visible.
 */
import { describe, it, expect } from "vitest";
import { plural, cantidad } from "../format";

describe("plural()", () => {
  it("usa el singular con exactamente 1", () => {
    expect(plural(1, "día", "días")).toBe("día");
  });

  it("usa el plural con 0", () => {
    // En español el cero lleva plural: "0 días", no "0 día".
    expect(plural(0, "día", "días")).toBe("días");
  });

  it("usa el plural con más de 1", () => {
    expect(plural(2, "día", "días")).toBe("días");
    expect(plural(37, "día", "días")).toBe("días");
  });

  it("añade -s cuando no se pasa forma plural", () => {
    expect(plural(1, "pieza")).toBe("pieza");
    expect(plural(3, "pieza")).toBe("piezas");
  });

  it("respeta plurales irregulares vía el tercer argumento", () => {
    expect(plural(3, "mes", "meses")).toBe("meses");
    expect(plural(3, "propiedad", "propiedades")).toBe("propiedades");
    expect(plural(3, "error", "errores")).toBe("errores");
  });
});

describe("cantidad()", () => {
  it("concuerda el singular sin dejar rastro de '(s)'", () => {
    expect(cantidad(1, "día", "días")).toBe("1 día");
    expect(cantidad(1, "mes", "meses")).toBe("1 mes");
  });

  it("concuerda el plural con 0 y con más de 1", () => {
    expect(cantidad(0, "día", "días")).toBe("0 días");
    expect(cantidad(5, "día", "días")).toBe("5 días");
  });

  it("cubre los sustantivos que hoy aparecen con paréntesis en la copy", () => {
    expect(cantidad(1, "período", "períodos")).toBe("1 período");
    expect(cantidad(2, "período", "períodos")).toBe("2 períodos");
    expect(cantidad(1, "atraso", "atrasos")).toBe("1 atraso");
    expect(cantidad(1, "contrato", "contratos")).toBe("1 contrato");
    expect(cantidad(1, "recordatorio", "recordatorios")).toBe("1 recordatorio");
    expect(cantidad(1, "documento", "documentos")).toBe("1 documento");
  });

  it("nunca produce la forma con paréntesis", () => {
    for (const n of [0, 1, 2, 10]) {
      expect(cantidad(n, "día", "días")).not.toContain("(");
    }
  });
});
