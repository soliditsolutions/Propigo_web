import { describe, expect, it } from "vitest";
import { mensajeIpcFaltante } from "../ipc-faltante";

describe("mensajeIpcFaltante", () => {
  it("nombra un mes en español", () => {
    expect(mensajeIpcFaltante([new Date(Date.UTC(2026, 5, 1))])).toMatch(/índice de junio de 2026\./);
  });
  it("une dos meses con «y»", () => {
    expect(mensajeIpcFaltante([new Date(Date.UTC(2025, 5, 1)), new Date(Date.UTC(2026, 5, 1))]))
      .toMatch(/junio de 2025 y junio de 2026/);
  });
});
