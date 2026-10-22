/**
 * nuevaContrasenaAction — el enlace de recuperación es de un solo uso, también
 * ante dos envíos simultáneos (el consumo del token es atómico).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/token", () => ({ hashToken: async () => "hash" }));
vi.mock("@/lib/password", () => ({ hashPassword: async () => "nuevo-hash" }));
vi.mock("@/lib/password-strength", () => ({ evaluatePassword: () => ({ passes: true }) }));

const mockQueryRaw = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    resetToken: { findFirst: async () => ({ id: "rt-1", usuarioId: "u-1" }) },
    $queryRaw: mockQueryRaw,
  },
}));
const mockConsumir = vi.fn();
const mockActualizarUsuario = vi.fn();
vi.mock("@/lib/tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({
    resetToken: { updateMany: mockConsumir },
    usuario:    { update: mockActualizarUsuario },
  }),
}));

const { nuevaContrasenaAction } = await import("../actions");

const enviar = () => {
  const fd = new FormData();
  fd.set("token", "token-crudo");
  fd.set("password", "Una-Clave-Larga-2026!");
  return nuevaContrasenaAction(null, fd);
};

describe("nuevaContrasenaAction — consumo atómico del token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRaw
      .mockResolvedValueOnce([{ nombre: "Ana", email: "a@x.cl", rut: null }])
      .mockResolvedValueOnce([{ tenant_id: "t1" }]);
  });

  it("cambia la contraseña y consume el token solo si seguía sin usar", async () => {
    mockConsumir.mockResolvedValue({ count: 1 });
    await enviar();
    expect(mockConsumir).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "rt-1", usadoEn: null } }));
    expect(mockActualizarUsuario).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/login?reset=1");
  });

  it("si otro envío ya consumió el token, no vuelve a cambiar la contraseña", async () => {
    mockConsumir.mockResolvedValue({ count: 0 });
    const r = await enviar();
    expect(r).toEqual({ error: expect.any(String) });
    expect(mockActualizarUsuario).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
