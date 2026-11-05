/**
 * getActor(): a dónde manda cuando no hay sesión válida.
 *
 * Usuario desactivado: en una Server Action se borran las cookies y se va
 * directo a /login (antes el router del cliente quedaba en /api/auth/logout);
 * en un Server Component, donde borrar cookies lanza, pasa por la ruta de
 * logout, la única que puede limpiarlas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetSession, mockClearSession, mockClearDevice, mockFindUnique } = vi.hoisted(() => ({
  mockGetSession:   vi.fn(),
  mockClearSession: vi.fn(),
  mockClearDevice:  vi.fn(),
  mockFindUnique:   vi.fn(),
}));

vi.mock("../auth", () => ({
  getSession:         mockGetSession,
  clearSessionCookie: mockClearSession,
  clearDeviceCookie:  mockClearDevice,
}));
vi.mock("../db", () => ({ prisma: {} }));
vi.mock("../tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({ usuario: { findUnique: mockFindUnique } }),
}));
vi.mock("../plans", () => ({ getCupoPropiedades: vi.fn(), getPlanEfectivo: vi.fn() }));
vi.mock("../plan-limits", () => ({ consultarConsumoIaHoy: vi.fn() }));

import { getActor } from "../queries";

const destino = (p: Promise<unknown>) =>
  p.then(() => "sin redirect", (e: { digest?: string }) => e.digest?.split(";")[2] ?? String(e));

beforeEach(() => {
  mockGetSession.mockReset();
  mockClearSession.mockReset();
  mockClearDevice.mockReset();
  mockFindUnique.mockReset();
  mockGetSession.mockResolvedValue({ sub: "u1", tenantId: "t1" });
});

describe("getActor", () => {
  it("sin sesión → /login", async () => {
    mockGetSession.mockResolvedValue(null);
    expect(await destino(getActor())).toBe("/login");
  });

  it("usuario desactivado en una Server Action: borra ambas cookies y va a /login", async () => {
    mockFindUnique.mockResolvedValue({ id: "u1", tenantId: "t1", rol: "manager", desactivadoEn: new Date(), tenant: {} });
    mockClearSession.mockResolvedValue(undefined);
    mockClearDevice.mockResolvedValue(undefined);
    expect(await destino(getActor())).toBe("/login");
    expect(mockClearSession).toHaveBeenCalled();
    expect(mockClearDevice).toHaveBeenCalled();
  });

  it("usuario desactivado en un Server Component (cookies de solo lectura) → /api/auth/logout", async () => {
    mockFindUnique.mockResolvedValue({ id: "u1", tenantId: "t1", rol: "manager", desactivadoEn: new Date(), tenant: {} });
    mockClearSession.mockRejectedValue(new Error("Cookies can only be modified in a Server Action or Route Handler."));
    expect(await destino(getActor())).toBe("/api/auth/logout");
  });

  it("usuario que ya no existe → mismo trato que desactivado", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockClearSession.mockResolvedValue(undefined);
    mockClearDevice.mockResolvedValue(undefined);
    expect(await destino(getActor())).toBe("/login");
  });

  it("usuario activo → devuelve el actor", async () => {
    mockFindUnique.mockResolvedValue({ id: "u1", tenantId: "t1", rol: "manager", desactivadoEn: null, tenant: { id: "t1" } });
    await expect(getActor()).resolves.toMatchObject({ usuarioId: "u1", tenantId: "t1" });
    expect(mockClearSession).not.toHaveBeenCalled();
  });
});
