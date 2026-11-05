/**
 * /api/auth/dispositivos — un fallo de la base responde JSON, no un 500 vacío (M-19).
 *
 * El cliente muestra el error según el código; un cuerpo HTML se leía como
 * "error de red" y el fallo no quedaba en el log.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSesion, mockFindMany, mockDeleteMany, mockFindUnique, mockDelete, mockLogError } = vi.hoisted(() => ({
  mockSesion: vi.fn(),
  mockFindMany: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockDelete: vi.fn(),
  mockLogError: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getVerifiedSession: mockSesion,
  clearSessionCookie: vi.fn(),
  clearDeviceCookie: vi.fn(),
  DEVICE_COOKIE_NAME: "pgo_device",
}));
vi.mock("@/lib/db", () => ({
  prisma: { dispositivoConfiable: { findMany: mockFindMany, deleteMany: mockDeleteMany, findUnique: mockFindUnique, delete: mockDelete } },
}));
vi.mock("@/lib/logger", () => ({ logError: mockLogError }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

const lista = await import("../route");
const uno = await import("../[id]/route");

const ID = "11111111-1111-4111-8111-111111111111";
const eliminarUno = () => uno.DELETE({} as never, { params: Promise.resolve({ id: ID }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockSesion.mockResolvedValue({ sub: "u1" });
});

describe("GET /api/auth/dispositivos", () => {
  it("lista los dispositivos de la sesión", async () => {
    mockFindMany.mockResolvedValue([{ id: "d1" }]);
    const r = await lista.GET();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ dispositivos: [{ id: "d1" }] });
  });

  it("sin sesión responde 401", async () => {
    mockSesion.mockResolvedValue(null);
    expect((await lista.GET()).status).toBe(401);
  });

  it("si la base falla responde 500 con JSON y lo registra", async () => {
    mockFindMany.mockRejectedValue(new Error("db caída"));
    const r = await lista.GET();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: expect.stringMatching(/No pudimos cargar/) });
    expect(mockLogError).toHaveBeenCalledWith("dispositivos/listar", expect.any(Error));
  });
});

describe("DELETE /api/auth/dispositivos", () => {
  it("si la base falla responde 500 con JSON y lo registra", async () => {
    mockDeleteMany.mockRejectedValue(new Error("db caída"));
    const r = await lista.DELETE();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: expect.stringMatching(/No pudimos eliminar los dispositivos/) });
    expect(mockLogError).toHaveBeenCalledWith("dispositivos/eliminar-todos", expect.any(Error));
  });
});

describe("DELETE /api/auth/dispositivos/[id]", () => {
  it("un dispositivo de otro usuario responde 404", async () => {
    mockFindUnique.mockResolvedValue({ usuarioId: "otro", tokenHash: "x" });
    const r = await eliminarUno();
    expect(r.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("elimina uno propio que no es el actual sin pedir volver a entrar", async () => {
    mockFindUnique.mockResolvedValue({ usuarioId: "u1", tokenHash: "otro-hash" });
    const r = await eliminarUno();
    expect(await r.json()).toEqual({ ok: true, relogin: false });
  });

  it("si la base falla responde 500 con JSON y lo registra", async () => {
    mockFindUnique.mockRejectedValue(new Error("db caída"));
    const r = await eliminarUno();
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: expect.stringMatching(/No pudimos eliminar el dispositivo/) });
    expect(mockLogError).toHaveBeenCalledWith("dispositivos/eliminar", expect.any(Error));
  });
});
