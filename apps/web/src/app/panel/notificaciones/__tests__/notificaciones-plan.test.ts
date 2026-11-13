/**
 * Tests: el plan Gratuito solo envía por correo los recordatorios de pago.
 *
 * El resto de los avisos no se pierde ni se marca como enviado: queda
 * "pendiente" en el panel, y el envío informa cuántos quedaron sin salir.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindMany, mockCount, mockGroupBy, mockUpdate, mockEnviar } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockGroupBy: vi.fn(),
  mockUpdate: vi.fn(),
  mockEnviar: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getActor: vi.fn(),
  propiedadIdsVisibles: vi.fn(),
  marcarPeriodosAtrasados: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendNotificacionEmail: mockEnviar }));
vi.mock("@/lib/tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({
    notificacion: { findMany: mockFindMany, count: mockCount, groupBy: mockGroupBy, update: mockUpdate },
  }),
}));

const { enviarNotificacionesPendientes } = await import("../actions");

const tenant = (plan: string | null) => ({ id: "t1", nombre: "Corredora", plan }) as never;

const aviso = (tipo: string) => ({
  id: `n-${tipo}`, tipo, asunto: "Aviso", cuerpo: null, personaId: "p1", contratoId: null,
  persona: { id: "p1", nombre: "Ana", email: "ana@example.cl", preferenciaNotif: [] },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AUTH_SECRET", "a".repeat(32)); // firma el enlace de baja del correo
  mockGroupBy.mockResolvedValue([]);
  mockUpdate.mockResolvedValue({});
  mockEnviar.mockResolvedValue(undefined);
});

describe("enviarNotificacionesPendientes según el plan", () => {
  it("Gratuito: solo pide recordatorios de pago y cuenta los demás como limitados por plan", async () => {
    mockFindMany.mockImplementation(async (args: { select?: unknown; where: { tipo?: unknown } }) =>
      args.select ? [] : [aviso("recordatorio_vencimiento")]);
    mockCount.mockResolvedValue(4);

    const r = await enviarNotificacionesPendientes(tenant("Gratuito"));

    const lectura = mockFindMany.mock.calls.map((c) => c[0]).find((a) => !a.select);
    expect(lectura.where.tipo).toEqual({ in: ["recordatorio_vencimiento"] });
    expect(mockCount.mock.calls[0][0].where.tipo).toEqual({ notIn: ["recordatorio_vencimiento"] });
    expect(r).toMatchObject({ ok: true, enviadas: 1, limitadasPorPlan: 4 });
    expect(mockEnviar).toHaveBeenCalledTimes(1);
  });

  it("un plan pagado no filtra por tipo ni cuenta limitados", async () => {
    mockFindMany.mockImplementation(async (args: { select?: unknown }) =>
      args.select ? [] : [aviso("recordatorio_vencimiento"), aviso("comentario_corredor")]);

    const r = await enviarNotificacionesPendientes(tenant("silver"));

    const lectura = mockFindMany.mock.calls.map((c) => c[0]).find((a) => !a.select);
    expect(lectura.where).not.toHaveProperty("tipo");
    expect(mockCount).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, enviadas: 2, limitadasPorPlan: 0 });
  });
});
