import { describe, expect, it } from "vitest";
import { registroAbierto } from "../registro-abierto";

describe("registroAbierto", () => {
  it("está abierto por defecto, también en producción", () => {
    expect(registroAbierto({ NODE_ENV: "production" })).toBe(true);
    expect(registroAbierto({ NODE_ENV: "development" })).toBe(true);
    expect(registroAbierto({})).toBe(true);
  });
  it("REGISTRO_ABIERTO=false lo cierra, en producción y en desarrollo", () => {
    expect(registroAbierto({ NODE_ENV: "production", REGISTRO_ABIERTO: "false" })).toBe(false);
    expect(registroAbierto({ NODE_ENV: "development", REGISTRO_ABIERTO: "false" })).toBe(false);
  });
  it("un valor mal escrito no cierra el registro", () => {
    for (const v of ["0", "FALSE", "no", ""]) {
      expect(registroAbierto({ NODE_ENV: "production", REGISTRO_ABIERTO: v })).toBe(true);
    }
  });
});
