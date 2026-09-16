import { describe, it, expect } from "vitest";
import {
  normalizarValorRectificacion,
  validarValorRectificacion,
  correoDeVerificacion,
  esCampoRectificable,
} from "../rectificacion-persona";

describe("esCampoRectificable", () => {
  it("acepta exactamente 'email' y 'telefono'", () => {
    expect(esCampoRectificable("email")).toBe(true);
    expect(esCampoRectificable("telefono")).toBe(true);
  });
  it("rechaza cualquier otro valor — el que no calce no debe caer por defecto en ninguna rama", () => {
    expect(esCampoRectificable("rut")).toBe(false);
    expect(esCampoRectificable("nombre")).toBe(false);
    expect(esCampoRectificable("")).toBe(false);
    expect(esCampoRectificable(null)).toBe(false);
    expect(esCampoRectificable(undefined)).toBe(false);
    expect(esCampoRectificable(123)).toBe(false);
  });
});

describe("normalizarValorRectificacion", () => {
  it("el correo se recorta y pasa a minúsculas", () => {
    expect(normalizarValorRectificacion("email", "  Nuevo@Correo.CL  ")).toBe("nuevo@correo.cl");
  });
  it("el teléfono solo se recorta", () => {
    expect(normalizarValorRectificacion("telefono", "  +56 9 1234 5678  ")).toBe("+56 9 1234 5678");
  });
});

describe("validarValorRectificacion", () => {
  it("acepta un correo válido", () => {
    expect(validarValorRectificacion("email", "persona@ejemplo.cl")).toBeNull();
  });
  it("rechaza un correo sin arroba ni dominio", () => {
    expect(validarValorRectificacion("email", "no-es-correo")).toMatch(/no es válido/i);
    expect(validarValorRectificacion("email", "persona@")).toMatch(/no es válido/i);
  });
  it("acepta un teléfono con formato chileno", () => {
    expect(validarValorRectificacion("telefono", "+56 9 1234 5678")).toBeNull();
  });
  it("rechaza un teléfono demasiado corto o con letras", () => {
    expect(validarValorRectificacion("telefono", "123")).toMatch(/inválido/i);
    expect(validarValorRectificacion("telefono", "abc-def-ghij")).toMatch(/inválido/i);
  });
});

describe("correoDeVerificacion", () => {
  it("cambio de email: el código va al correo NUEVO", () => {
    const r = correoDeVerificacion("email", "nuevo@correo.cl", "viejo@correo.cl");
    expect(r).toEqual({ correo: "nuevo@correo.cl", error: null });
  });
  it("cambio de email sin correo previo: igual va al nuevo", () => {
    const r = correoDeVerificacion("email", "nuevo@correo.cl", null);
    expect(r).toEqual({ correo: "nuevo@correo.cl", error: null });
  });
  it("cambio de teléfono: el código va al correo ACTUAL (no hay SMS)", () => {
    const r = correoDeVerificacion("telefono", "+56911112222", "actual@correo.cl");
    expect(r).toEqual({ correo: "actual@correo.cl", error: null });
  });
  it("cambio de teléfono sin correo registrado: se rechaza, no se aplica a ciegas", () => {
    const r = correoDeVerificacion("telefono", "+56911112222", null);
    expect(r.correo).toBeNull();
    expect(r.error).toMatch(/no podemos verificar/i);
  });
});
