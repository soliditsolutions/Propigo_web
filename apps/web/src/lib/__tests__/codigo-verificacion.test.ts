import { describe, it, expect } from "vitest";
import { generarCodigo, hashCodigo } from "../codigo-verificacion";

describe("generarCodigo", () => {
  it("siempre entrega 6 dígitos, con ceros a la izquierda si hace falta", () => {
    for (let i = 0; i < 200; i++) {
      const c = generarCodigo();
      expect(c).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashCodigo", () => {
  it("es determinista para el mismo código", () => {
    expect(hashCodigo("123456")).toBe(hashCodigo("123456"));
  });
  it("dos códigos distintos hashean distinto", () => {
    expect(hashCodigo("123456")).not.toBe(hashCodigo("654321"));
  });
  it("nunca devuelve el código en claro", () => {
    expect(hashCodigo("123456")).not.toContain("123456");
    expect(hashCodigo("123456")).toHaveLength(64); // sha256 hex
  });
});
