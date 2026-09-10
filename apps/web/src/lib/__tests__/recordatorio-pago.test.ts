/**
 * Cuerpo del recordatorio de pago (L-CM7).
 */
import { describe, it, expect } from "vitest";
import { construirCuerpoRecordatorio, CIERRE_SI_YA_PAGASTE } from "../recordatorio-pago";

const cuenta = {
  banco: "Banco de Chile", tipo: "corriente", numero: "0012345678",
  titular: "Corredora Demo SpA", rutTitular: "76123456-0", email: null,
};
const venc = new Date("2026-09-05T00:00:00Z");

describe("construirCuerpoRecordatorio", () => {
  it("siempre incluye la fecha de vencimiento y el cierre 'si ya pagaste'", () => {
    const cuerpo = construirCuerpoRecordatorio({ fechaVencimiento: venc, cuentaCorredora: null });
    expect(cuerpo).toMatch(/vence el 05 de septiembre de 2026/);
    expect(cuerpo).toContain(CIERRE_SI_YA_PAGASTE);
  });

  it("sin cuenta cargada, no inventa datos de transferencia", () => {
    const cuerpo = construirCuerpoRecordatorio({ fechaVencimiento: venc, cuentaCorredora: null });
    expect(cuerpo).not.toMatch(/transferir/i);
    expect(cuerpo).not.toMatch(/N° de cuenta/);
  });

  it("con cuenta cargada, agrega el bloque de transferencia", () => {
    const cuerpo = construirCuerpoRecordatorio({ fechaVencimiento: venc, cuentaCorredora: cuenta });
    expect(cuerpo).toMatch(/Datos para transferir:/);
    expect(cuerpo).toContain("Banco: Banco de Chile");
    expect(cuerpo).toContain("N° de cuenta: 0012345678");
    expect(cuerpo).toContain("Titular: Corredora Demo SpA");
  });

  it("el cierre 'si ya pagaste' va al final, después de los datos de transferencia", () => {
    const cuerpo = construirCuerpoRecordatorio({ fechaVencimiento: venc, cuentaCorredora: cuenta });
    expect(cuerpo.trimEnd().endsWith(CIERRE_SI_YA_PAGASTE)).toBe(true);
  });
});
