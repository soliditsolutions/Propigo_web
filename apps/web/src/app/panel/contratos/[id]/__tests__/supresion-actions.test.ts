import { beforeEach, describe, expect, it, vi } from "vitest";

const getActor = vi.hoisted(() => vi.fn());
const anonimizar = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }) }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/lib/queries", () => ({ getActor }));
vi.mock("@/lib/tenant-db", () => ({ withTenant: async (_id: string, fn: (tx: unknown) => unknown) => fn({}) }));
vi.mock("@/lib/supresion-persona", () => ({ anonimizarPersona: anonimizar }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const { anonimizarPersonaAction, PALABRA_CONFIRMACION } = await import("../supresion-actions");

const manager = { usuarioId: "u1", tenantId: "t1", rol: "manager" };

beforeEach(() => {
  vi.clearAllMocks();
  getActor.mockResolvedValue(manager);
  anonimizar.mockResolvedValue({ ok: true, borrados: { avisos: 2 }, conservado: ["x"] });
});

describe("anonimizarPersonaAction", () => {
  it("exige la palabra de confirmación y no toca nada sin ella", async () => {
    for (const texto of ["", "anonimizar ya", "SI"]) {
      const r = await anonimizarPersonaAction("p1", texto);
      expect(r.ok).toBe(false);
    }
    expect(anonimizar).not.toHaveBeenCalled();
    expect(getActor).not.toHaveBeenCalled();
  });

  it("acepta la palabra con espacios alrededor y pasa actor, tenant e IP", async () => {
    const r = await anonimizarPersonaAction("p1", `  ${PALABRA_CONFIRMACION} `);
    expect(r).toEqual({ ok: true, borrados: { avisos: 2 }, conservado: ["x"] });
    expect(anonimizar).toHaveBeenCalledWith({}, { tenantId: "t1", personaId: "p1", actorId: "u1", ip: "203.0.113.5" });
  });

  it("un Colaborador no puede", async () => {
    getActor.mockResolvedValue({ ...manager, rol: "colaborador" });
    const r = await anonimizarPersonaAction("p1", PALABRA_CONFIRMACION);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/Manager/) });
    expect(anonimizar).not.toHaveBeenCalled();
  });

  it("devuelve el motivo cuando la persona no se puede anonimizar", async () => {
    anonimizar.mockResolvedValue({ ok: false, motivo: "Tiene un contrato vigente." });
    expect(await anonimizarPersonaAction("p1", PALABRA_CONFIRMACION)).toEqual({ ok: false, error: "Tiene un contrato vigente." });
  });

  it("un fallo inesperado no se expone", async () => {
    anonimizar.mockRejectedValue(new Error('violates foreign key constraint "voucher_arrendatario_id_fkey"'));
    const r = await anonimizarPersonaAction("p1", PALABRA_CONFIRMACION);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/foreign key|voucher/);
  });
});
