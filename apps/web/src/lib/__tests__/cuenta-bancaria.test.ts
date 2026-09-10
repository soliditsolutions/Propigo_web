/**
 * Cuenta bancaria de destino (L-DT5/6/7).
 *
 * El riesgo que se vigila: una cuenta mal cargada desvía plata. El validador
 * debe rechazar RUT inválido y número sospechoso, pero aceptar los formatos
 * reales (número con guiones, CuentaRUT).
 */
import { describe, it, expect } from "vitest";
import {
  validarCuentaBancaria, normalizarNumeroCuenta, bloqueTransferencia,
  cuentaParaMostrar, TIPOS_CUENTA,
} from "../cuenta-bancaria";

const base = {
  banco: "Banco de Chile",
  tipo: "corriente",
  numero: "00-123-45678-90",
  titular: "Corredora Demo SpA",
  rutTitular: "76123456-0",
  email: "pagos@corredorademo.cl",
};

describe("validarCuentaBancaria", () => {
  it("acepta una cuenta completa y bien formada", () => {
    expect(validarCuentaBancaria(base)).toBeNull();
  });

  it("acepta sin correo (es opcional)", () => {
    expect(validarCuentaBancaria({ ...base, email: "" })).toBeNull();
    expect(validarCuentaBancaria({ ...base, email: null })).toBeNull();
  });

  it("rechaza banco vacío", () => {
    expect(validarCuentaBancaria({ ...base, banco: "" })).toMatch(/nombre del banco/i);
  });

  it("rechaza un tipo fuera del enum", () => {
    expect(validarCuentaBancaria({ ...base, tipo: "linea_credito" })).toMatch(/tipo de cuenta/i);
  });

  it("acepta los cuatro tipos válidos", () => {
    for (const t of TIPOS_CUENTA) {
      expect(validarCuentaBancaria({ ...base, tipo: t }), t).toBeNull();
    }
  });

  it("rechaza número vacío o demasiado corto", () => {
    expect(validarCuentaBancaria({ ...base, numero: "" })).toMatch(/obligatorio/i);
    expect(validarCuentaBancaria({ ...base, numero: "12" })).toMatch(/incompleto/i);
  });

  it("rechaza RUT del titular inválido", () => {
    expect(validarCuentaBancaria({ ...base, rutTitular: "76123456-9" })).toMatch(/dígito verificador/i);
    expect(validarCuentaBancaria({ ...base, rutTitular: "" })).toMatch(/obligatorio/i);
  });

  it("rechaza correo con formato inválido", () => {
    expect(validarCuentaBancaria({ ...base, email: "no-es-correo" })).toMatch(/correo/i);
  });

  it("rechaza titular vacío", () => {
    expect(validarCuentaBancaria({ ...base, titular: "" })).toMatch(/titular/i);
  });
});

describe("normalizarNumeroCuenta", () => {
  it("deja solo los dígitos", () => {
    expect(normalizarNumeroCuenta("00-123-45678-90")).toBe("001234567890");
    expect(normalizarNumeroCuenta("1234 5678")).toBe("12345678");
  });
});

describe("cuentaParaMostrar", () => {
  it("traduce el tipo a etiqueta legible y limpia el número", () => {
    const c = cuentaParaMostrar({ ...base, tipo: "cuenta_rut", numero: "12.345.678-9" });
    expect(c.tipoEtiqueta).toBe("CuentaRUT");
    expect(c.numero).toBe("123456789");
  });
});

describe("bloqueTransferencia", () => {
  it("arma un bloque de texto plano con una línea por dato", () => {
    const bloque = bloqueTransferencia(base);
    expect(bloque).toContain("Banco: Banco de Chile");
    expect(bloque).toContain("Tipo: Cuenta corriente");
    expect(bloque).toContain("N° de cuenta: 001234567890");
    expect(bloque).toContain("Titular: Corredora Demo SpA");
    expect(bloque).toContain("RUT: 76123456-0");
    expect(bloque).toContain("Enviar comprobante a: pagos@corredorademo.cl");
    expect(bloque).not.toMatch(/<[a-z]/i); // sin HTML
  });

  it("omite la línea del correo si no hay", () => {
    expect(bloqueTransferencia({ ...base, email: "" })).not.toMatch(/comprobante/i);
  });
});
