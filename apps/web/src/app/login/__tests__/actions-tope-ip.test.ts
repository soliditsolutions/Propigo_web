/**
 * loginAction — tope por IP antes de buscar la cuenta.
 *
 * El conteo por IP en BD solo corre cuando el correo existe; sin este tope,
 * probar miles de correos inexistentes (credential stuffing) no tenía freno.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
let ipActual = "203.0.113.20";
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => (n === "x-forwarded-for" ? ipActual : null) }),
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));
const mockQueryRaw = vi.fn(async () => []); // ningún correo existe
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mockQueryRaw } }));
vi.mock("@/lib/tenant-db", () => ({ withTenant: vi.fn() }));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn(async () => false) }));
vi.mock("@/lib/auth", () => ({ signSession: vi.fn(), setSessionCookie: vi.fn(), DEVICE_COOKIE_NAME: "pgo_device" }));

const { loginAction } = await import("../actions");

const intentar = (email: string) => {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", "clave-cualquiera");
  return loginAction(null, fd);
};

describe("loginAction — tope por IP con correos inexistentes", () => {
  it("tras 30 intentos desde una IP, el 31 se corta sin consultar la base", async () => {
    for (let i = 0; i < 30; i++) {
      const r = await intentar(`noexiste${i}@x.cl`);
      expect(r?.error).not.toMatch(/Demasiados intentos/);
    }
    const llamadas = mockQueryRaw.mock.calls.length;
    const r = await intentar("noexiste-final@x.cl");
    expect(r?.error).toMatch(/Demasiados intentos desde tu red/);
    expect(mockQueryRaw.mock.calls.length).toBe(llamadas);
  });

  it("otra IP no queda afectada", async () => {
    ipActual = "203.0.113.21";
    const r = await intentar("noexiste@x.cl");
    expect(r?.error).not.toMatch(/Demasiados intentos/);
  });
});
