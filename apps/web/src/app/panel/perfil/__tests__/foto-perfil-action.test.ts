/**
 * Tests: la foto de perfil se guarda apenas se sube, sin depender del resto del
 * formulario, y solo acepta URLs que entregó /api/upload?type=perfil.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { esFotoPerfilValida } from "@/lib/foto-perfil";

const mockGetSession = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSession:       mockGetSession,
  signSession:      vi.fn(),
  setSessionCookie: vi.fn(),
}));
vi.mock("@/lib/email", () => ({ sendCambioContactoCodeEmail: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const mockActivos = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/tenant-db", () => ({
  withTenant: vi.fn((_t: string, fn: (tx: unknown) => unknown) =>
    fn({ usuario: { count: mockActivos, update: mockUpdate } })),
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));

const { guardarFotoPerfilAction } = await import("../actions");

const URL_OK = "/uploads/perfil/0f8fad5b-d9cb-469f-a165-70867728950e.jpg";

describe("esFotoPerfilValida", () => {
  it("acepta lo que entrega la subida de perfil", () => {
    for (const ext of ["jpg", "jpeg", "png", "webp", "gif"]) {
      expect(esFotoPerfilValida(`/uploads/perfil/0f8fad5b-d9cb-469f-a165-70867728950e.${ext}`)).toBe(true);
    }
  });

  it("rechaza URLs externas, otras carpetas, rutas que salen y esquemas", () => {
    for (const url of [
      "", "//otro-sitio.cl/x.png", "https://otro-sitio.cl/x.png", "javascript:alert(1)",
      "/uploads/propiedades/0f8fad5b-d9cb-469f-a165-70867728950e.jpg",
      "/uploads/perfil/../documentos/0f8fad5b-d9cb-469f-a165-70867728950e.jpg",
      "/uploads/perfil/0f8fad5b-d9cb-469f-a165-70867728950e.svg",
      `${URL_OK}?x=1`,
    ]) {
      expect(esFotoPerfilValida(url), url).toBe(false);
    }
  });
});

describe("guardarFotoPerfilAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ sub: "user-1", tenantId: "tenant-1" });
    mockActivos.mockResolvedValue(1);
    mockUpdate.mockResolvedValue({});
  });

  it("guarda la foto del usuario de la sesión y refresca los avatares del panel", async () => {
    await expect(guardarFotoPerfilAction(URL_OK)).resolves.toEqual({ ok: true });
    expect(mockUpdate).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { fotoPerfil: URL_OK } });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/panel", "layout");
  });

  it("no guarda una URL que no salió de la subida", async () => {
    const r = await guardarFotoPerfilAction("//otro-sitio.cl/x.png");
    expect(r.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sin sesión activa no guarda", async () => {
    mockActivos.mockResolvedValue(0);
    const r = await guardarFotoPerfilAction(URL_OK);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/sesión expiró/) });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("si la base falla avisa y no refresca", async () => {
    mockUpdate.mockRejectedValue(new Error("db caída"));
    const r = await guardarFotoPerfilAction(URL_OK);
    expect(r.ok).toBe(false);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
