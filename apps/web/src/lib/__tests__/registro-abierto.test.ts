import { describe, expect, it } from "vitest";
import { registroAbierto } from "../registro-abierto";

describe("registroAbierto", () => {
  it("en producción está cerrado por defecto", () => {
    expect(registroAbierto({ NODE_ENV: "production" })).toBe(false);
  });
  it("en desarrollo y pruebas está abierto por defecto", () => {
    expect(registroAbierto({ NODE_ENV: "development" })).toBe(true);
    expect(registroAbierto({ NODE_ENV: "test" })).toBe(true);
    expect(registroAbierto({})).toBe(true);
  });
  it("REGISTRO_ABIERTO=true lo abre en producción", () => {
    expect(registroAbierto({ NODE_ENV: "production", REGISTRO_ABIERTO: "true" })).toBe(true);
  });
  it("REGISTRO_ABIERTO=false lo cierra también en desarrollo", () => {
    expect(registroAbierto({ NODE_ENV: "development", REGISTRO_ABIERTO: "false" })).toBe(false);
  });
  it("cualquier otro valor no abre nada en producción", () => {
    for (const v of ["1", "TRUE", "yes", ""]) {
      expect(registroAbierto({ NODE_ENV: "production", REGISTRO_ABIERTO: v })).toBe(false);
    }
  });
});
