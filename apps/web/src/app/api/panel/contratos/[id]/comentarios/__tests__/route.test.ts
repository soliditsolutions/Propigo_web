/**
 * POST /api/panel/contratos/[id]/comentarios — alcance del colaborador, baja
 * del arrendatario (aviso opcional) y sin correo duplicado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", async () => ({
  getActor: mockGetActor,
  alcanceContrato: (a: { rol: string; usuarioId: string }) =>
    a.rol === "manager" ? {} : { propiedad: { asignadoAId: a.usuarioId } },
}));
const mockEnviar = vi.fn();
vi.mock("@/lib/email", () => ({ sendComentarioCorredorEmail: mockEnviar }));
vi.mock("@/lib/notificacion-preferencias", async (orig) => ({
  ...(await orig<typeof import("@/lib/notificacion-preferencias")>()),
  firmarTokenBaja: async () => "token-baja",
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const mockContratoFind = vi.fn();
const mockNotifUpdate = vi.fn();
vi.mock("@/lib/tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({
    contrato:           { findFirst: mockContratoFind },
    usuario:            { findFirst: async () => ({ nombre: "María" }) },
    comentarioCorredor: { create: async () => ({ id: "c1" }) },
    documento:          { updateMany: vi.fn() },
    notificacion:       { create: async () => ({ id: "n1" }), update: mockNotifUpdate },
  }),
}));

const { POST } = await import("../route");

const ID = "11111111-1111-4111-8111-111111111111";
const enviar = () => POST(
  new Request(`http://x/api/panel/contratos/${ID}/comentarios`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texto: "Hola" }),
  }) as never,
  { params: Promise.resolve({ id: ID }) },
);
const contrato = (pref: unknown) => ({
  id: ID, tenantId: "t1", arrendatarioId: "p1",
  propiedad: { direccion: "Calle 1" },
  arrendatario: { nombre: "Ana", email: "ana@x.cl", preferenciaNotif: pref ? [pref] : [] },
});

describe("POST comentarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActor.mockResolvedValue({ tenantId: "t1", rol: "manager", usuarioId: "u-m" });
  });

  it("envía una vez, con enlace de baja, y marca la notificación como enviada", async () => {
    mockContratoFind.mockResolvedValue(contrato(null));
    expect((await enviar()).status).toBe(200);
    expect(mockEnviar).toHaveBeenCalledTimes(1);
    expect(mockEnviar.mock.calls[0][0].urlBaja).toContain("/no-molestar?t=token-baja");
    expect(mockNotifUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "n1" }, data: expect.objectContaining({ estado: "enviada" }),
    }));
  });

  it("con baja vigente no envía y deja la notificación al despachador", async () => {
    mockContratoFind.mockResolvedValue(contrato({ suscrito: false, bajaHasta: null, alcance: "solo_opcionales" }));
    expect((await enviar()).status).toBe(200);
    expect(mockEnviar).not.toHaveBeenCalled();
    expect(mockNotifUpdate).not.toHaveBeenCalled();
  });

  it("si el envío falla, la notificación queda pendiente para el cron", async () => {
    mockContratoFind.mockResolvedValue(contrato(null));
    mockEnviar.mockRejectedValueOnce(new Error("Resend caído"));
    expect((await enviar()).status).toBe(200);
    expect(mockNotifUpdate).not.toHaveBeenCalled();
  });

  it("el colaborador solo busca contratos de propiedades asignadas a él", async () => {
    mockGetActor.mockResolvedValue({ tenantId: "t1", rol: "colaborador", usuarioId: "u-colab" });
    mockContratoFind.mockResolvedValue(null);
    expect((await enviar()).status).toBe(404);
    expect(mockContratoFind.mock.calls[0][0].where).toMatchObject({ propiedad: { asignadoAId: "u-colab" } });
  });

  it("401 si getActor falla", async () => {
    mockGetActor.mockRejectedValue(new Error("NEXT_REDIRECT"));
    expect((await enviar()).status).toBe(401);
  });
});
