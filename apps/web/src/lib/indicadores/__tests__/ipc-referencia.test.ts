import { describe, expect, it } from "vitest";
import {
  mensajeIpcDesactualizado, mensajeIpcFaltante, mesesEntre, rezagoIpc, REZAGO_MAXIMO_MESES, sumarMeses,
} from "../ipc-referencia";

const m = (y: number, mes: number) => new Date(Date.UTC(y, mes - 1, 1));

describe("mesesEntre / sumarMeses", () => {
  it("cuenta meses a través del cambio de año", () => {
    expect(mesesEntre(m(2025, 11), m(2026, 2))).toBe(3);
    expect(mesesEntre(m(2026, 5), m(2026, 5))).toBe(0);
  });
  it("suma y resta meses cruzando el año", () => {
    expect(sumarMeses(m(2026, 1), -1)).toEqual(m(2025, 12));
    expect(sumarMeses(m(2025, 11), 3)).toEqual(m(2026, 2));
  });
});

describe("rezagoIpc", () => {
  it("0 cuando el IPC del mes del pago ya está", () => {
    expect(rezagoIpc(m(2026, 6), m(2026, 6))).toBe(0);
  });
  it("1 cuando está el del mes anterior (el caso normal)", () => {
    expect(rezagoIpc(m(2026, 5), m(2026, 6))).toBe(1);
  });
  it(`acepta hasta ${REZAGO_MAXIMO_MESES} y rechaza más`, () => {
    expect(rezagoIpc(m(2026, 4), m(2026, 6))).toBe(2);
    expect(rezagoIpc(m(2026, 3), m(2026, 6))).toBeNull();
  });
  it("null sin datos o con un IPC posterior al pago", () => {
    expect(rezagoIpc(null, m(2026, 6))).toBeNull();
    expect(rezagoIpc(m(2026, 7), m(2026, 6))).toBeNull();
  });
});

describe("mensajes", () => {
  it("nombran los meses en español", () => {
    expect(mensajeIpcFaltante([m(2025, 5)])).toMatch(/índice de mayo de 2025/);
    expect(mensajeIpcFaltante([m(2025, 5), m(2026, 5)])).toMatch(/mayo de 2025 y mayo de 2026/);
    expect(mensajeIpcDesactualizado(m(2026, 2), m(2026, 6))).toMatch(/febrero de 2026.*junio de 2026/);
    expect(mensajeIpcDesactualizado(null, m(2026, 6))).toMatch(/ningún IPC cargado/);
  });
});
