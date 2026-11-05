/**
 * actorDeRuta: separa "sin sesión" de "falló el servidor" en las rutas API (M-17).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect, notFound } from "next/navigation";

const { mockGetActor, mockLogError } = vi.hoisted(() => ({ mockGetActor: vi.fn(), mockLogError: vi.fn() }));
vi.mock("@/lib/queries", () => ({ getActor: mockGetActor }));
vi.mock("@/lib/logger", () => ({ logError: mockLogError }));

const { actorDeRuta } = await import("../actor-ruta");
const { NextResponse } = await import("next/server");

beforeEach(() => vi.clearAllMocks());

describe("actorDeRuta", () => {
  it("devuelve el actor cuando hay sesión", async () => {
    const actor = { usuarioId: "u1", tenantId: "t1", rol: "manager" };
    mockGetActor.mockResolvedValue(actor);
    expect(await actorDeRuta("x")).toBe(actor);
  });

  it("sin sesión (redirect de getActor) responde 401 sin ensuciar el log", async () => {
    mockGetActor.mockImplementation(async () => redirect("/login"));
    const r = await actorDeRuta("x");
    expect(r).toBeInstanceOf(NextResponse);
    expect((r as Response).status).toBe(401);
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it("cualquier control de Next (p. ej. notFound) también se trata como sin acceso", async () => {
    mockGetActor.mockImplementation(async () => notFound());
    expect(((await actorDeRuta("x")) as Response).status).toBe(401);
  });

  it("un fallo de la base responde 503 y queda en el log con su contexto", async () => {
    mockGetActor.mockRejectedValue(new Error("ECONNREFUSED"));
    const r = (await actorDeRuta("vouchers/pdf")) as Response;
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: expect.stringMatching(/Servicio no disponible/) });
    expect(mockLogError).toHaveBeenCalledWith("vouchers/pdf", expect.any(Error));
  });
});
