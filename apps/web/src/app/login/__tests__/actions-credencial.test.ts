/**
 * loginAction — qué señal recibe el formulario según el tipo de fallo (M-03, M-08).
 *
 * Solo un rechazo de credenciales vacía la contraseña; una falla de la base no
 * es culpa del usuario y no debe borrar lo que escribió ni culpar a su red.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => (n === "x-forwarded-for" ? "203.0.113.40" : null) }),
  cookies: async () => ({ get: () => undefined, set: vi.fn() }),
}));
const mockQueryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mockQueryRaw } }));
vi.mock("@/lib/tenant-db", () => ({ withTenant: vi.fn() }));
vi.mock("@/lib/password", () => ({ verifyPassword: vi.fn(async () => false) }));
vi.mock("@/lib/auth", () => ({ signSession: vi.fn(), setSessionCookie: vi.fn(), DEVICE_COOKIE_NAME: "pgo_device" }));

const { loginAction } = await import("../actions");

function intentar() {
  const fd = new FormData();
  fd.set("email", "alguien@x.cl");
  fd.set("password", "clave-cualquiera");
  return loginAction(null, fd);
}

// Con llaves: si el callback devuelve el mock, Vitest lo invoca como limpieza.
beforeEach(() => { mockQueryRaw.mockReset(); });

describe("loginAction — señal de credencial rechazada", () => {
  it("correo inexistente: marca credencialRechazada", async () => {
    mockQueryRaw.mockResolvedValue([]);
    const r = await intentar();
    expect(r).toMatchObject({ error: "Correo o contraseña incorrectos.", credencialRechazada: true });
  });

  it("falla de la base: mensaje de problema nuestro, sin culpar a la red ni vaciar la contraseña", async () => {
    mockQueryRaw.mockRejectedValue(new Error("ECONNREFUSED"));
    const r = await intentar();
    expect(r?.error).toMatch(/problema de nuestro lado/);
    expect(r?.error).not.toMatch(/conexión/);
    expect(r?.credencialRechazada).toBeUndefined();
  });
});
