/**
 * GET /api/salud — el chequeo de despliegue debe fallar si no hay base,
 * y nunca filtrar el error (puede traer host, usuario o rutas internas).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQueryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mockQueryRaw } }));
const mockLogError = vi.fn();
vi.mock("@/lib/logger", () => ({ logError: mockLogError }));

const { GET } = await import("../route");

describe("GET /api/salud", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 sin caché cuando la base responde", async () => {
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ estado: "ok" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("503 sin detalle del error cuando la base no responde", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connect ECONNREFUSED db.interno:5432 usuario propigo_app"));
    const res = await GET();
    expect(res.status).toBe(503);
    const cuerpo = JSON.stringify(await res.json());
    expect(cuerpo).not.toMatch(/ECONNREFUSED|db\.interno|propigo_app/);
    expect(mockLogError).toHaveBeenCalledWith("salud", expect.any(Error));
  });
});
