/**
 * Tests: solicitarCambioContactoAction — re-autenticación con contraseña
 * (2026-07-31). Antes, el código de 6 dígitos al correo actual era la única
 * prueba de identidad para pedir un cambio de teléfono/correo — suficiente
 * para probar que la sesión sigue teniendo acceso a esa cuenta, pero no que
 * quien está frente al teclado ahora mismo es su dueño legítimo (ej. sesión
 * abierta y desatendida). Se agregó exigir la contraseña actual ANTES de
 * gastar un envío de código — el navegador de pruebas de esta sesión no
 * pudo verificar el flujo interactivamente (limitación de renderizado del
 * pane, no del código — ver notas de sesión), así que este test cubre el
 * gate directamente sobre el server action.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession:      mockGetSession,
  signSession:     vi.fn(async () => "signed-jwt"),
  setSessionCookie: vi.fn(async () => undefined),
}));

const mockVerifyPassword = vi.fn();
vi.mock("@/lib/password", () => ({
  verifyPassword: mockVerifyPassword,
  hashPassword:   vi.fn(async () => "hashed-password"),
}));

vi.mock("@/lib/password-strength", () => ({
  evaluatePassword: vi.fn(() => ({ passes: true, suggestion: "" })),
}));

const mockSendCambioContactoCodeEmail = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendCambioContactoCodeEmail: mockSendCambioContactoCodeEmail,
}));

vi.mock("@propigo/core", () => ({
  esRegionValida:         vi.fn(() => true),
  esComunaValidaEnRegion: vi.fn(() => true),
}));

vi.mock("@/lib/rut", () => ({
  validateRut:   vi.fn(() => true),
  canonicalRut:  vi.fn((r: string) => r),
}));

const mockUsuarioFindUnique = vi.fn();
// sesionActiva(): 1 = el usuario de la sesión sigue activo.
const mockUsuarioActivos    = vi.fn().mockResolvedValue(1);
const mockCodigoFindFirst   = vi.fn();
const mockCodigoCount       = vi.fn();
const mockCodigoDeleteMany  = vi.fn().mockResolvedValue({ count: 0 });
const mockCodigoCreate      = vi.fn().mockResolvedValue({ id: "codigo-1" });
const mockQueryRaw          = vi.fn();
// $transaction aquí es la forma "batch" (array de promesas ya construidas),
// no la forma callback — solicitarCambioContactoAction usa
// prisma.$transaction([deleteMany(...), create(...)]) directo (sin withTenant).
const mockTransaction = vi.fn((ops: Promise<unknown>[]) => Promise.all(ops));

vi.mock("@/lib/db", () => {
  const models = {
    usuario:              { findUnique: mockUsuarioFindUnique, count: mockUsuarioActivos },
    codigoCambioContacto: {
      findFirst:  mockCodigoFindFirst,
      count:      mockCodigoCount,
      deleteMany: mockCodigoDeleteMany,
      create:     mockCodigoCreate,
    },
  };
  return {
    prisma: {
      ...models,
      $queryRaw:     mockQueryRaw,
      $transaction:  mockTransaction,
    },
  };
});

// withTenant(): la verificación de contraseña y el chequeo de "ya es tu
// teléfono/correo actual" corren dentro de esto — el mock reusa el mismo
// mockUsuarioFindUnique que el resto del test controla con mockResolvedValueOnce.
vi.mock("@/lib/tenant-db", () => ({
  withTenant: vi.fn((_tenantId: string, fn: (tx: unknown) => unknown) =>
    fn({ usuario: { findUnique: mockUsuarioFindUnique, count: mockUsuarioActivos } }),
  ),
}));

const { solicitarCambioContactoAction, guardarPerfilAction } = await import("../actions");

const SESSION = {
  sub: "user-1", tenantId: "tenant-1", rol: "manager" as const,
  nombre: "Juan Actual", email: "actual@correo.cl", perfilCompleto: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(SESSION);
  mockUsuarioActivos.mockResolvedValue(1);
  mockCodigoFindFirst.mockResolvedValue(null);
  mockCodigoCount.mockResolvedValue(0);
});

describe("solicitarCambioContactoAction — re-autenticación con contraseña", () => {
  it("rechaza si no hay sesión", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await solicitarCambioContactoAction("telefono", "+56911112222", "cualquiera");
    expect(res.ok).toBe(false);
  });

  it("rechaza a un usuario desactivado aunque su JWT siga vigente", async () => {
    mockUsuarioActivos.mockResolvedValue(0);
    const res = await solicitarCambioContactoAction("telefono", "+56911112222", "cualquiera");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/sesión expirada/i);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockSendCambioContactoCodeEmail).not.toHaveBeenCalled();
  });

  it("rechaza si no se envía contraseña, sin siquiera consultar la BD", async () => {
    const res = await solicitarCambioContactoAction("telefono", "+56911112222", "");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/contraseña/i);
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockSendCambioContactoCodeEmail).not.toHaveBeenCalled();
  });

  it("rechaza si el usuario no tiene passwordHash configurado", async () => {
    mockUsuarioFindUnique.mockResolvedValueOnce({ passwordHash: null });
    const res = await solicitarCambioContactoAction("telefono", "+56911112222", "MiClave123!");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Contraseña incorrecta.");
  });

  it("rechaza si la contraseña es incorrecta y no envía el código", async () => {
    mockUsuarioFindUnique.mockResolvedValueOnce({ passwordHash: "hash-guardado" });
    mockVerifyPassword.mockResolvedValue(false);

    const res = await solicitarCambioContactoAction("email", "nuevo@correo.cl", "ClaveMala1!");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("Contraseña incorrecta.");
    expect(mockSendCambioContactoCodeEmail).not.toHaveBeenCalled();
  });

  it("con contraseña correcta, valida el nuevo teléfono y envía el código al correo ACTUAL", async () => {
    mockUsuarioFindUnique
      .mockResolvedValueOnce({ passwordHash: "hash-guardado" }) // verificación de contraseña
      .mockResolvedValueOnce({ telefono: "+56900000000" });     // "¿ya es tu teléfono actual?"
    mockVerifyPassword.mockResolvedValue(true);

    const res = await solicitarCambioContactoAction("telefono", "+56911112222", "ClaveBuena1!");

    expect(res.ok).toBe(true);
    expect(mockVerifyPassword).toHaveBeenCalledWith("ClaveBuena1!", "hash-guardado");
    // El código se envía al correo YA verificado de la sesión, nunca a un dato nuevo.
    expect(mockSendCambioContactoCodeEmail).toHaveBeenCalledWith(
      SESSION.email, SESSION.nombre, expect.any(String), "telefono", "+56911112222",
    );
  });

  it("con contraseña correcta pero email ya existente, rechaza sin haber gastado el chequeo de contraseña de más", async () => {
    mockUsuarioFindUnique.mockResolvedValueOnce({ passwordHash: "hash-guardado" });
    mockVerifyPassword.mockResolvedValue(true);
    mockQueryRaw.mockResolvedValue([{ existe: true }]);

    const res = await solicitarCambioContactoAction("email", "ocupado@correo.cl", "ClaveBuena1!");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ya existe una cuenta/i);
    expect(mockSendCambioContactoCodeEmail).not.toHaveBeenCalled();
  });
});

describe("solicitarCambioContactoAction — unicidad del correo (M-17)", () => {
  it("si no se puede verificar el correo nuevo, no envía el código (falla cerrado)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUsuarioFindUnique.mockResolvedValueOnce({ passwordHash: "hash-guardado" });
    mockVerifyPassword.mockResolvedValue(true);
    mockQueryRaw.mockRejectedValue(new Error("db caída"));

    const res = await solicitarCambioContactoAction("email", "nuevo@correo.cl", "ClaveBuena1!");

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/No pudimos verificar/);
    expect(mockSendCambioContactoCodeEmail).not.toHaveBeenCalled();
  });
});

describe("guardarPerfilAction — unicidad del RUT (M-17)", () => {
  it("si no se puede verificar el RUT al fijarlo, no lo guarda (falla cerrado)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockUsuarioFindUnique.mockResolvedValueOnce({ rut: null, fechaNacimiento: null, telefono: null });
    mockQueryRaw.mockRejectedValue(new Error("db caída"));
    const fd = new FormData();
    fd.set("rut", "12.345.678-5");

    const res = await guardarPerfilAction(null, fd);

    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/No pudimos verificar/) });
  });
});
