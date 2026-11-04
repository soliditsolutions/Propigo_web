/**
 * Tests: solicitarCambioPlanAction — P-B6 (solicitud de upgrade/downgrade) y
 * P-B7 (gate de downgrade, D-05).
 *
 * Lo que se cuida: que el argumento del cliente no se use sin validar (plan
 * inexistente, modalidad inventada), que solo el Manager pueda pedir el
 * cambio, que el gate se evalúe en el servidor con el uso real aunque la UI
 * diga otra cosa, y que el correo a soporte lleve la diferencia del mes
 * completo solo en el upgrade inmediato.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActor    = vi.fn();
const mockGetUsoCupos = vi.fn();
const mockGetUfCLP    = vi.fn();
vi.mock("@/lib/queries", () => ({
  getActor:    mockGetActor,
  getUsoCupos: mockGetUsoCupos,
  getUfCLP:    mockGetUfCLP,
}));

const mockFindUnique = vi.fn();
vi.mock("@/lib/tenant-db", () => ({
  withTenant: vi.fn((_t: string, fn: (tx: unknown) => unknown) => fn({ usuario: { findUnique: mockFindUnique } })),
}));

const mockSend = vi.fn();
vi.mock("@/lib/email", () => ({ sendSolicitudCambioPlanEmail: mockSend }));

const { solicitarCambioPlanAction } = await import("../plan-actions");

let n = 0;
function actor(plan: string, rol: "manager" | "colaborador" = "manager") {
  // Tenant distinto por test: el rate limit es en memoria y por tenant.
  n += 1;
  return { usuarioId: `u-${n}`, tenantId: `t-${n}`, rol, tenant: { nombre: "Corredora Uno", plan } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue({ nombre: "Ana Manager", email: "ana@corredora.cl" });
  mockGetUfCLP.mockResolvedValue(40_000);
  mockSend.mockResolvedValue(undefined);
});

describe("validación de la entrada", () => {
  it("rechaza a un Colaborador", async () => {
    mockGetActor.mockResolvedValue(actor("silver", "colaborador"));
    const r = await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "inmediato" });
    expect(r.ok).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("rechaza un plan inexistente y el mismo plan", async () => {
    mockGetActor.mockResolvedValue(actor("silver"));
    expect((await solicitarCambioPlanAction({ destinoId: "platino" })).ok).toBe(false);
    expect((await solicitarCambioPlanAction({ destinoId: "silver" })).ok).toBe(false);
    // Forma inesperada desde el cliente: no debe reventar.
    expect((await solicitarCambioPlanAction(null as unknown as { destinoId: string })).ok).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("exige una modalidad válida en el upgrade", async () => {
    mockGetActor.mockResolvedValue(actor("silver"));
    expect((await solicitarCambioPlanAction({ destinoId: "gold" })).ok).toBe(false);
    expect((await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "gratis" })).ok).toBe(false);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("upgrade (D-18)", () => {
  it("inmediato: envía la diferencia del mes completo en UF y en CLP con IVA", async () => {
    mockGetActor.mockResolvedValue(actor("silver"));
    const r = await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "inmediato" });
    expect(r).toEqual({ ok: true, tipo: "upgrade", planDestino: "Gold" });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      tipo: "upgrade", modalidad: "inmediato", planOrigen: "Silver", planDestino: "Gold",
      emailManager: "ana@corredora.cl",
      diferenciaUf: 0.4,
      // 0.4 UF × 40.000 = 16.000 neto + 19 % IVA = 19.040
      diferenciaTotalClp: 19_040,
    }));
  });

  it("al próximo ciclo: sin diferencia que cobrar", async () => {
    mockGetActor.mockResolvedValue(actor("bronze"));
    await solicitarCambioPlanAction({ destinoId: "diamond", modalidad: "proximo_ciclo" });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ modalidad: "proximo_ciclo", diferenciaUf: null, diferenciaTotalClp: null }));
    expect(mockGetUfCLP).not.toHaveBeenCalled();
  });

  it("sin valor UF igual envía la solicitud, solo con el monto en UF", async () => {
    mockGetActor.mockResolvedValue(actor("silver"));
    mockGetUfCLP.mockRejectedValue(new Error("sin UF"));
    const r = await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "inmediato" });
    expect(r.ok).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ diferenciaUf: 0.4, diferenciaTotalClp: null }));
  });

  it("no evalúa el gate de cupos al subir", async () => {
    mockGetActor.mockResolvedValue(actor("silver"));
    await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "proximo_ciclo" });
    expect(mockGetUsoCupos).not.toHaveBeenCalled();
  });
});

describe("downgrade (D-05, gate P-B7)", () => {
  it("bloquea si la cuenta no cabe y devuelve qué sobra", async () => {
    mockGetActor.mockResolvedValue(actor("gold"));
    mockGetUsoCupos.mockResolvedValue({ propiedades: 30, usuarios: 3 });
    const r = await solicitarCambioPlanAction({ destinoId: "silver" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.excedentes).toEqual([
      { recurso: "propiedades", uso: 30, max: 25, sobran: 5 },
      { recurso: "usuarios",    uso: 3,  max: 1,  sobran: 2 },
    ]);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("deja bajar justo en el límite e ignora la modalidad", async () => {
    mockGetActor.mockResolvedValue(actor("gold"));
    mockGetUsoCupos.mockResolvedValue({ propiedades: 25, usuarios: 1 });
    const r = await solicitarCambioPlanAction({ destinoId: "silver", modalidad: "inmediato" });
    expect(r).toEqual({ ok: true, tipo: "downgrade", planDestino: "Silver" });
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ tipo: "downgrade", modalidad: null, diferenciaUf: null }));
  });
});

describe("envío", () => {
  it("limita a 3 solicitudes por hora por cuenta", async () => {
    const a = actor("silver");
    mockGetActor.mockResolvedValue(a);
    for (let i = 0; i < 3; i++) {
      expect((await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "proximo_ciclo" })).ok).toBe(true);
    }
    const r = await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "proximo_ciclo" });
    expect(r.ok).toBe(false);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("un rechazo por validación no consume cupo de envío", async () => {
    mockGetActor.mockResolvedValue(actor("silver"));
    for (let i = 0; i < 5; i++) await solicitarCambioPlanAction({ destinoId: "gold" });
    expect((await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "inmediato" })).ok).toBe(true);
  });

  it("si el correo falla, informa el error sin decir que se envió", async () => {
    mockGetActor.mockResolvedValue(actor("silver"));
    mockSend.mockRejectedValue(new Error("EMAIL_PROVIDER_NOT_CONFIGURED"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await solicitarCambioPlanAction({ destinoId: "gold", modalidad: "proximo_ciclo" });
    expect(r.ok).toBe(false);
  });
});
