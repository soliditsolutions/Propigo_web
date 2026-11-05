/**
 * Tests: los fallos de las acciones de Notificaciones llegan al usuario (M-05).
 *
 * Antes devolvían { ok: false } sin texto y la pantalla no mostraba nada: el
 * corredor creía que los avisos habían salido. Cada fallo trae ahora un
 * mensaje y queda en el log, salvo el rechazo por permisos, que es esperado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetActor, mockPropiedadIdsVisibles, mockLogError, mockFindFirst, mockUpdate, mockUpdateMany } = vi.hoisted(() => ({
  mockGetActor: vi.fn(),
  mockPropiedadIdsVisibles: vi.fn(),
  mockLogError: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getActor: mockGetActor,
  propiedadIdsVisibles: mockPropiedadIdsVisibles,
  marcarPeriodosAtrasados: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: mockLogError }));
vi.mock("@/lib/email", () => ({ sendNotificacionEmail: vi.fn() }));
vi.mock("@/lib/tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({
    notificacion: { findFirst: mockFindFirst, update: mockUpdate, updateMany: mockUpdateMany, findMany: vi.fn(async () => []) },
  }),
}));

const { marcarSimulada, simularEnvioMasivo, enviarNotificacionesPendientes } = await import("../actions");

const MANAGER     = { usuarioId: "u1", tenantId: "t1", rol: "manager" };
const COLABORADOR = { usuarioId: "u2", tenantId: "t1", rol: "colaborador" };

beforeEach(() => {
  vi.clearAllMocks();
  mockPropiedadIdsVisibles.mockResolvedValue(null);
});

describe("marcarSimulada", () => {
  it("si la base falla, devuelve un mensaje y registra el error", async () => {
    mockGetActor.mockResolvedValue(MANAGER);
    mockUpdate.mockRejectedValue(new Error("db caída"));
    const r = await marcarSimulada("n1");
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/No pudimos marcar el aviso/) });
    expect(mockLogError).toHaveBeenCalledWith("marcarSimulada", expect.any(Error));
  });

  it("un colaborador sin acceso recibe el motivo, sin ensuciar el log", async () => {
    mockGetActor.mockResolvedValue(COLABORADOR);
    mockFindFirst.mockResolvedValue({ contrato: { propiedad: { asignadoAId: "otro" } } });
    const r = await marcarSimulada("n1");
    expect(r).toEqual({ ok: false, error: "No tienes acceso a esta notificación." });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockLogError).not.toHaveBeenCalled();
  });
});

describe("envío masivo", () => {
  it("simularEnvioMasivo: un fallo trae mensaje y queda en el log", async () => {
    mockGetActor.mockRejectedValue(new Error("sin sesión"));
    const r = await simularEnvioMasivo();
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Siguen pendientes/) });
    expect(mockLogError).toHaveBeenCalledWith("simularEnvioMasivo", expect.any(Error));
  });

  it("enviarNotificacionesPendientes: un fallo trae mensaje", async () => {
    mockGetActor.mockRejectedValue(new Error("sin sesión"));
    const r = await enviarNotificacionesPendientes();
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/Siguen pendientes/) });
  });
});
