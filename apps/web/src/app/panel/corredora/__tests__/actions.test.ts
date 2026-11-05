/**
 * Acciones de Datos de la corredora (M-25): la validación devuelve todos los
 * errores por campo y no toca la base.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetActor, mockWithTenant } = vi.hoisted(() => ({
  mockGetActor:   vi.fn(),
  mockWithTenant: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({ getActor: mockGetActor }));
vi.mock("@/lib/tenant-db", () => ({ withTenant: mockWithTenant }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { guardarCuentaCorredora, guardarDatosCorredora } from "../actions";

beforeEach(() => {
  mockGetActor.mockReset();
  mockWithTenant.mockReset();
  mockGetActor.mockResolvedValue({ rol: "manager", tenantId: "t1" });
});

describe("guardarCuentaCorredora", () => {
  it("devuelve cada error en su campo y no escribe", async () => {
    const r = await guardarCuentaCorredora({
      banco: "Banco de Chile", tipo: "corriente", numero: "0012345678",
      titular: "Corredora Demo SpA", rutTitular: "76123456-9", email: "no-es-correo",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.campos ?? {})).toEqual(["rutTitular", "email"]);
    expect(r.error).toBe(r.campos?.rutTitular);
    expect(mockWithTenant).not.toHaveBeenCalled();
  });
});

describe("guardarDatosCorredora", () => {
  it("giro y dirección demasiado largos se informan juntos", async () => {
    const r = await guardarDatosCorredora({ esPersonaJuridica: true, giro: "x".repeat(121), direccion: "y".repeat(201) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.campos ?? {})).toEqual(["giro", "direccion"]);
    expect(mockWithTenant).not.toHaveBeenCalled();
  });
});
