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

import { redirect } from "next/navigation";
import { logError } from "@/lib/logger";
import { guardarCuentaCorredora, guardarDatosCorredora, eliminarCuentaCorredora } from "../actions";

beforeEach(() => {
  vi.mocked(logError).mockClear();
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

describe("sin sesión", () => {
  // getActor() señala la sesión caída con redirect(); si el catch de la acción
  // lo tragaba, el usuario leía "No se pudieron guardar los datos" y seguía en
  // una página que ya no podía usar.
  it("deja pasar el redirect al login en vez de responder un error genérico", async () => {
    mockGetActor.mockImplementation(async () => redirect("/login"));
    await expect(guardarDatosCorredora({ esPersonaJuridica: true, giro: "", direccion: "" }))
      .rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    await expect(eliminarCuentaCorredora()).rejects.toMatchObject({ digest: expect.stringContaining("/login") });
    expect(logError).not.toHaveBeenCalled();
  });

  it("un fallo real sigue respondiendo el error y queda en el log", async () => {
    mockGetActor.mockRejectedValue(new Error("base caída"));
    const r = await eliminarCuentaCorredora();
    expect(r).toEqual({ ok: false, error: "No se pudo eliminar la cuenta bancaria." });
    expect(logError).toHaveBeenCalled();
  });
});
