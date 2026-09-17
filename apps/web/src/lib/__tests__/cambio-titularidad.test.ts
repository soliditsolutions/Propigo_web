import { describe, it, expect } from "vitest";
import { construirAvisoCambioTitularidad } from "../cambio-titularidad";

describe("construirAvisoCambioTitularidad", () => {
  it("nombra la dirección y al nuevo propietario con su RUT formateado", () => {
    const { asunto, cuerpo } = construirAvisoCambioTitularidad({
      direccion: "Los Aromos 1234",
      propietarioNuevoNombre: "Juan Nuevo Dueño",
      propietarioNuevoRut: "111111111",
      fechaEfecto: new Date("2026-09-16T12:00:00Z"),
    });
    expect(asunto).toContain("Los Aromos 1234");
    expect(cuerpo).toContain("Juan Nuevo Dueño");
    expect(cuerpo).toContain("11.111.111-1");
  });

  it("aclara que el contrato vigente no se ve alterado por el cambio", () => {
    const { cuerpo } = construirAvisoCambioTitularidad({
      direccion: "Los Aromos 1234",
      propietarioNuevoNombre: "Juan Nuevo Dueño",
      propietarioNuevoRut: "111111111",
      fechaEfecto: new Date("2026-09-16T12:00:00Z"),
    });
    expect(cuerpo).toMatch(/no se ven alteradas/i);
  });
});
