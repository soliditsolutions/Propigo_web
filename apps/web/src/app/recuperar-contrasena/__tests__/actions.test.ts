/**
 * recuperarAction — tope de envíos.
 *
 * Cada solicitud válida manda un correo: sin tope, cualquiera podía inundar de
 * correos de recuperación una dirección ajena. El tope no debe cambiar la
 * respuesta (siempre `{ sent: true }`), o revelaría qué correos tienen cuenta.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQueryRaw = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    resetToken: { deleteMany: vi.fn(), create: vi.fn() },
  },
}));
const mockEnviar = vi.fn();
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: mockEnviar }));
vi.mock("@/lib/token", () => ({
  generateResetToken: () => "token-crudo",
  hashToken: async () => "token-hash",
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
let ipActual = "203.0.113.1";
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => (n === "x-forwarded-for" ? ipActual : null) }),
}));

const { recuperarAction } = await import("../actions");

const pedir = (email: string) => {
  const fd = new FormData();
  fd.set("email", email);
  return recuperarAction(null, fd);
};

describe("recuperarAction — tope de envíos", () => {
  beforeEach(() => {
    mockEnviar.mockReset();
    mockQueryRaw.mockResolvedValue([{ id: "usuario-1" }]);
  });

  it("corta en 3 correos por dirección y responde igual al cuarto", async () => {
    ipActual = "203.0.113.10";
    for (let i = 0; i < 3; i++) expect(await pedir("victima@x.cl")).toEqual({ sent: true });
    expect(await pedir("victima@x.cl")).toEqual({ sent: true });
    expect(mockEnviar).toHaveBeenCalledTimes(3);
  }, 20_000);

  it("el tope por dirección no afecta a otra dirección", async () => {
    ipActual = "203.0.113.11";
    await pedir("otra@x.cl");
    expect(mockEnviar).toHaveBeenCalledWith("otra@x.cl", "token-crudo");
  }, 20_000);

  it("una misma IP no puede barrer más de 10 direcciones en la ventana", async () => {
    ipActual = "203.0.113.12";
    for (let i = 0; i < 11; i++) expect(await pedir(`cuenta${i}@x.cl`)).toEqual({ sent: true });
    expect(mockEnviar).toHaveBeenCalledTimes(10);
  }, 20_000);
});
