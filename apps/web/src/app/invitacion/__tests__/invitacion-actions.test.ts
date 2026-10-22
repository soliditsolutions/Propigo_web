/**
 * Tests: revalidación de cupo al aceptar invitación (ADR-0013, Fase E)
 *
 * Una invitación se crea cuando el tenant tenía cupo, pero puede aceptarse
 * días después — si el Manager bajó de plan mientras tanto, aceptarla sin
 * revisar el cupo actual dejaría al tenant con más usuarios activos de los
 * que su plan permite (el bypass reportado por el usuario). El fix revalida
 * getCupoUsuarios(tenant.plan) contra Manager + colaboradores activos justo
 * antes de crear el Usuario — si no hay cupo, la invitación queda intacta
 * (no se marca usadoEn) para poder reintentarse más tarde.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

vi.mock("@/lib/token", () => ({ hashToken: vi.fn(async () => "hashed-token") }));
vi.mock("@/lib/password", () => ({ hashPassword: vi.fn(async () => "hashed-password") }));
vi.mock("@/lib/password-strength", () => ({
  evaluatePassword: vi.fn(() => ({ passes: true })),
}));
vi.mock("@/lib/auth", () => ({
  signSession: vi.fn(async () => "signed-jwt"),
  setSessionCookie: vi.fn(async () => undefined),
}));

const mockInvitacionFindFirst = vi.fn();
const mockInvitacionUpdate    = vi.fn().mockResolvedValue({ count: 1 });
const mockTenantFindUnique    = vi.fn();
const mockUsuarioCount        = vi.fn();
const mockUsuarioCreate       = vi.fn().mockResolvedValue({
  id: "new-user-1", tenantId: "tenant-1", rol: "colaborador", nombre: "Nuevo", email: "nuevo@empresa.cl",
});
const mockQueryRaw = vi.fn();

// aceptarInvitacionAction corre las lecturas de cupo y la creación del
// Usuario dentro de withTenant() (ADR-0011): $transaction invoca el
// callback con un tx que expone $executeRaw (SET LOCAL) y los modelos —
// mismo patrón que el resto de la Fase D/E.
vi.mock("@/lib/db", () => {
  const models = {
    tenant:                { findUnique: mockTenantFindUnique },
    usuario:                { count: mockUsuarioCount, create: mockUsuarioCreate },
    invitacionColaborador: { findFirst: mockInvitacionFindFirst, updateMany: mockInvitacionUpdate },
  };
  return {
    prisma: {
      ...models,
      $queryRaw: mockQueryRaw,
      $transaction: vi.fn((cb: (tx: unknown) => unknown) =>
        cb({ $executeRaw: vi.fn().mockResolvedValue(undefined), ...models }),
      ),
    },
  };
});

const { aceptarInvitacionAction } = await import("../actions");

function formData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("token", overrides.token ?? "raw-token");
  fd.set("password", overrides.password ?? "una-contrasena-larga-y-segura");
  fd.set("consent", overrides.consent ?? "on");
  return fd;
}

const INVITACION_VALIDA = {
  id: "inv-1", invitadoPorId: "manager-1", nombre: "Nuevo Colaborador", email: "nuevo@empresa.cl",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInvitacionFindFirst.mockResolvedValue(INVITACION_VALIDA);
  mockUsuarioCreate.mockResolvedValue({
    id: "new-user-1", tenantId: "tenant-1", rol: "colaborador", nombre: "Nuevo", email: "nuevo@empresa.cl",
  });
  mockInvitacionUpdate.mockResolvedValue({ count: 1 });
  // Orden real de las dos $queryRaw: (1) resolver tenantId, (2) unicidad de email.
  mockQueryRaw
    .mockResolvedValueOnce([{ tenant_id: "tenant-1" }])
    .mockResolvedValueOnce([{ existe: false }]);
});

describe("aceptarInvitacionAction — revalidación de cupo (bypass de plan)", () => {
  it("rechaza si el plan actual ya está al límite solo con Manager + colaboradores activos (downgrade mientras la invitación seguía viva)", async () => {
    mockTenantFindUnique.mockResolvedValue({ plan: "gold" }); // max 5
    mockUsuarioCount.mockResolvedValue(5); // downgrade: 5 colaboradores activos → cupoUsado = 1(manager) + 5 = 6 >= 5

    const res = await aceptarInvitacionAction(null, formData());

    expect(res).toEqual({ error: expect.stringMatching(/cupo de usuarios.*ya está completo/i) });
    expect(mockUsuarioCreate).not.toHaveBeenCalled();
    expect(mockInvitacionUpdate).not.toHaveBeenCalled(); // la invitación queda intacta, se puede reintentar
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("permite aceptar cuando hay cupo disponible en el plan actual", async () => {
    mockTenantFindUnique.mockResolvedValue({ plan: "gold" }); // max 10
    mockUsuarioCount.mockResolvedValue(1); // cupoUsado = 1 + 1 = 2 < 10

    await aceptarInvitacionAction(null, formData());

    expect(mockUsuarioCreate).toHaveBeenCalledTimes(1);
    expect(mockInvitacionUpdate).toHaveBeenCalledWith({
      where: { id: "inv-1", usadoEn: null },
      data: expect.objectContaining({ usadoEn: expect.any(Date) }),
    });
    expect(mockRedirect).toHaveBeenCalledWith("/verificar-dispositivo");
  });

  it("un plan desconocido o 'Gratuito' cae en el cupo de Bronce (1) — rechaza si ya hay 0 colaboradores activos más el Manager", async () => {
    mockTenantFindUnique.mockResolvedValue({ plan: "Gratuito" });
    mockUsuarioCount.mockResolvedValue(0); // cupoUsado = 1(manager) + 0 = 1 >= max(Bronce)=1

    const res = await aceptarInvitacionAction(null, formData());

    expect(res).toEqual({ error: expect.stringMatching(/cupo de usuarios.*ya está completo/i) });
    expect(mockUsuarioCreate).not.toHaveBeenCalled();
  });

  it("permite aceptar la primera invitación de un tenant recién creado (0 colaboradores activos, plan con cupo >= 2)", async () => {
    mockTenantFindUnique.mockResolvedValue({ plan: "gold" }); // max 5 (Silver ya no admite subusuarios)
    mockUsuarioCount.mockResolvedValue(0); // cupoUsado = 1 + 0 = 1 < 5

    await aceptarInvitacionAction(null, formData());

    expect(mockUsuarioCreate).toHaveBeenCalledTimes(1);
  });
});

describe("aceptarInvitacionAction — validaciones existentes (regresión)", () => {
  it("rechaza sin token", async () => {
    const res = await aceptarInvitacionAction(null, formData({ token: "" }));
    expect(res).toEqual({ error: expect.stringMatching(/enlace de invitación inválido/i) });
    expect(mockInvitacionFindFirst).not.toHaveBeenCalled();
  });

  it("rechaza sin consentimiento", async () => {
    const res = await aceptarInvitacionAction(null, formData({ consent: "" }));
    expect(res).toEqual({ error: expect.stringMatching(/términos de uso/i) });
  });

  it("rechaza si la invitación no existe/expiró/ya se usó", async () => {
    mockInvitacionFindFirst.mockResolvedValue(null);
    const res = await aceptarInvitacionAction(null, formData());
    expect(res).toEqual({ error: expect.stringMatching(/expiró o ya se usó/i) });
    expect(mockTenantFindUnique).not.toHaveBeenCalled();
  });

  it("una segunda aceptación simultánea del mismo enlace no crea otra cuenta", async () => {
    mockTenantFindUnique.mockResolvedValue({ plan: "gold" });
    mockUsuarioCount.mockResolvedValue(0);
    mockInvitacionUpdate.mockResolvedValue({ count: 0 }); // la otra solicitud ya la consumió

    const res = await aceptarInvitacionAction(null, formData());

    expect(res).toEqual({ error: expect.any(String) });
    expect(mockUsuarioCreate).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
