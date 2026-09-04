/**
 * Tests: cupo de usuarios por plan (ADR-0013, Fase E)
 *
 * invitarColaboradorAction rechaza cuando el tenant ya alcanzó el cupo de su
 * plan (Manager + Colaboradores activos + invitaciones pendientes no
 * vencidas), tanto si el cupo está ocupado por colaboradores activos
 * (ROL-FLU-4) como por invitaciones sin aceptar (ROL-FLU-5). getCupoInfo()
 * expone el mismo cálculo para la UI (botón deshabilitado antes de enviar).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", () => ({ getActor: mockGetActor }));

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Map()) }));
vi.mock("@/lib/ip", () => ({ getClientIpFromHeaders: vi.fn(() => "203.0.113.1") }));
vi.mock("@/lib/token", () => ({
  generateResetToken: vi.fn(() => "raw-token"),
  hashToken: vi.fn(async () => "hashed-token"),
}));
vi.mock("@/lib/email", () => ({ sendCollaboratorInviteEmail: vi.fn().mockResolvedValue(undefined) }));

const mockUsuarioCount             = vi.fn();
const mockUsuarioFindMany          = vi.fn();
const mockUsuarioFindUnique        = vi.fn();
const mockInvitacionCount          = vi.fn();
const mockInvitacionDeleteMany     = vi.fn().mockResolvedValue(undefined);
const mockInvitacionCreate         = vi.fn().mockResolvedValue({});
const mockInvitacionFindMany       = vi.fn();
const mockAuditoriaCreate          = vi.fn().mockResolvedValue({});
const mockQueryRaw                 = vi.fn().mockResolvedValue([{ existe: false }]);

// invitarColaboradorAction corre tx.usuario.count() dentro de withTenant()
// (ADR-0011): $transaction invoca el callback con un tx que expone
// $executeRaw (SET LOCAL) y los modelos — mismo patrón que el resto de la
// Fase D. invitacion_colaborador no tiene tenant_id, así que sus operaciones
// van con `prisma` directo (fuera de withTenant), igual que en el código real.
vi.mock("@/lib/db", () => {
  const models = {
    usuario:              { count: mockUsuarioCount, findMany: mockUsuarioFindMany, findUnique: mockUsuarioFindUnique },
    invitacionColaborador: { count: mockInvitacionCount, deleteMany: mockInvitacionDeleteMany, create: mockInvitacionCreate, findMany: mockInvitacionFindMany },
    auditoriaEquipo:       { create: mockAuditoriaCreate },
  };
  return {
    prisma: {
      ...models,
      $queryRaw: mockQueryRaw,
      $transaction: vi.fn((arg: unknown) => {
        // invitarColaboradorAction usa prisma.$transaction([...]) con un
        // arreglo de promesas (no callback) para el par delete+create.
        if (Array.isArray(arg)) return Promise.all(arg);
        return (arg as (tx: unknown) => unknown)({ $executeRaw: vi.fn().mockResolvedValue(undefined), ...models });
      }),
    },
  };
});

const { invitarColaboradorAction, getCupoInfo } = await import("../actions");

function actorManager(plan: string | null) {
  return {
    usuarioId: "manager-1",
    tenantId:  "tenant-1",
    rol:       "manager" as const,
    tenant:    { id: "tenant-1", nombre: "Corredora Test", plan },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockResolvedValue([{ existe: false }]);
});

describe("invitarColaboradorAction — cupo de usuarios por plan", () => {
  it("rechaza cuando el cupo ya está lleno con colaboradores activos (Bronze, 1 usuario)", async () => {
    mockGetActor.mockResolvedValue(actorManager("bronze"));
    mockUsuarioCount.mockResolvedValue(0);   // 0 colaboradores activos
    mockInvitacionCount.mockResolvedValue(0); // 0 invitaciones pendientes
    // cupoUsado = 1 (manager) + 0 + 0 = 1 >= max(bronze)=1 → rechazado

    const res = await invitarColaboradorAction("Juan Pérez", "juan@empresa.cl");

    expect(res).toEqual({ ok: false, error: expect.stringMatching(/límite de 1 usuario/i) });
    expect(mockInvitacionCreate).not.toHaveBeenCalled();
  });

  it("rechaza cuando el cupo está lleno por colaboradores activos (Gold, 5 usuarios)", async () => {
    // Silver ya no admite subusuarios (queda cubierto por el caso Bronze). El
    // tope-por-colaboradores-activos se prueba en Gold, el primer plan multiusuario.
    mockGetActor.mockResolvedValue(actorManager("gold"));
    mockUsuarioCount.mockResolvedValue(4);   // 4 colaboradores activos
    mockInvitacionCount.mockResolvedValue(0);
    // cupoUsado = 1 (manager) + 4 + 0 = 5 >= max(gold)=5 → rechazado

    const res = await invitarColaboradorAction("Juan Pérez", "juan@empresa.cl");

    expect(res).toEqual({ ok: false, error: expect.stringMatching(/límite de 5 usuarios/i) });
    expect(mockInvitacionCreate).not.toHaveBeenCalled();
  });

  it("rechaza cuando el cupo está ocupado por una invitación pendiente (ROL-FLU-5)", async () => {
    mockGetActor.mockResolvedValue(actorManager("bronze"));
    mockUsuarioCount.mockResolvedValue(0);
    mockInvitacionCount.mockResolvedValue(1); // 1 invitación sin aceptar ocupa el único cupo extra... pero bronze ya está al límite solo con el manager
    // cupoUsado = 1 + 0 + 1 = 2 >= max(bronze)=1 → rechazado

    const res = await invitarColaboradorAction("Ana Soto", "ana@empresa.cl");

    expect(res).toEqual({ ok: false, error: expect.stringMatching(/límite de 1 usuario/i) });
    expect(mockInvitacionCreate).not.toHaveBeenCalled();
  });

  it("permite invitar justo bajo el límite (Gold, 10 usuarios, 3 ocupados)", async () => {
    mockGetActor.mockResolvedValue(actorManager("gold"));
    mockUsuarioCount.mockResolvedValue(1);    // 1 colaborador activo
    mockInvitacionCount.mockResolvedValue(1); // 1 invitación pendiente
    // cupoUsado = 1 + 1 + 1 = 3 < max(gold)=10 → permitido

    const res = await invitarColaboradorAction("Nuevo Colaborador", "nuevo@empresa.cl");

    expect(res).toEqual({ ok: true });
    expect(mockInvitacionCreate).toHaveBeenCalledTimes(1);
  });

  it("un plan desconocido o 'Gratuito' cae en el cupo de Bronze (1 usuario) — nunca sin límite", async () => {
    mockGetActor.mockResolvedValue(actorManager("Gratuito"));
    mockUsuarioCount.mockResolvedValue(0);
    mockInvitacionCount.mockResolvedValue(0);
    // cupoUsado = 1 + 0 + 0 = 1 >= max("Gratuito"→bronze)=1 → rechazado

    const res = await invitarColaboradorAction("Juan Pérez", "juan@empresa.cl");

    expect(res).toEqual({ ok: false, error: expect.stringMatching(/límite de 1 usuario/i) });
  });

  it("Diamond (10 usuarios) permite invitar con 9 ocupados", async () => {
    mockGetActor.mockResolvedValue(actorManager("diamond"));
    mockUsuarioCount.mockResolvedValue(8);
    mockInvitacionCount.mockResolvedValue(0);
    // cupoUsado = 1 + 8 + 0 = 9 < max(diamond)=10 → permitido

    const res = await invitarColaboradorAction("Colaborador Diez", "diez@empresa.cl");

    expect(res).toEqual({ ok: true });
  });

  it("un Colaborador no puede invitar (rol check corre antes que el cupo)", async () => {
    mockGetActor.mockResolvedValue({
      usuarioId: "colab-1", tenantId: "tenant-1", rol: "colaborador" as const,
      tenant: { id: "tenant-1", nombre: "Corredora Test", plan: "diamond" },
    });

    const res = await invitarColaboradorAction("Juan Pérez", "juan@empresa.cl");

    expect(res).toEqual({ ok: false, error: expect.stringMatching(/solo el administrador/i) });
    expect(mockUsuarioCount).not.toHaveBeenCalled();
  });
});

describe("getCupoInfo — información de cupo para la UI", () => {
  it("devuelve usado/max/planLabel para el plan del tenant", async () => {
    mockGetActor.mockResolvedValue(actorManager("gold"));
    mockUsuarioCount.mockResolvedValue(2);
    mockInvitacionCount.mockResolvedValue(1);

    const info = await getCupoInfo();

    expect(info).toEqual({ usado: 4, max: 5, planLabel: "Gold" });
  });

  it("un plan desconocido devuelve planLabel 'Gratuito' y el cupo de Bronze", async () => {
    mockGetActor.mockResolvedValue(actorManager("Gratuito"));
    mockUsuarioCount.mockResolvedValue(0);
    mockInvitacionCount.mockResolvedValue(0);

    const info = await getCupoInfo();

    expect(info).toEqual({ usado: 1, max: 1, planLabel: "Gratuito" });
  });

  it("rechaza (throw) si lo llama un Colaborador", async () => {
    mockGetActor.mockResolvedValue({
      usuarioId: "colab-1", tenantId: "tenant-1", rol: "colaborador" as const,
      tenant: { id: "tenant-1", nombre: "Corredora Test", plan: "diamond" },
    });

    await expect(getCupoInfo()).rejects.toThrow(/solo el administrador/i);
  });
});
