/**
 * Tests: lib/email — Resend no lanza cuando rechaza un envío, devuelve
 * `{ error }`. Antes ese correo pasaba por enviado; ahora es una excepción
 * que el llamador maneja (y que deja pendiente una consulta del marketplace).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const { sendContactoCorredorEmail } = await import("@/lib/email");

const datos = {
  emailCorredor: "c@x.cl", nombreCorredor: "C", tituloPub: "Depto",
  nombre: "Ana", apellido: "P", telefono: "+56911111111", email: "a@x.cl",
  titulo: "Hola", descripcion: "Mensaje de prueba", viaEmail: true, viaTelefono: false,
};

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("RESEND_API_KEY", "re_prueba");
  send.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("envío con Resend", () => {
  it("un rechazo de la API se convierte en excepción", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", statusCode: 403, message: "domain not verified" }, headers: null });
    await expect(sendContactoCorredorEmail(datos)).rejects.toThrow(/EMAIL_RECHAZADO: validation_error \(403\)/);
  });

  it("un envío aceptado no lanza", async () => {
    send.mockResolvedValue({ data: { id: "e-1" }, error: null, headers: null });
    await expect(sendContactoCorredorEmail(datos)).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "c@x.cl", replyTo: "a@x.cl" }));
  });

  it("sin API key sigue lanzando EMAIL_PROVIDER_NOT_CONFIGURED", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(sendContactoCorredorEmail(datos)).rejects.toThrow("EMAIL_PROVIDER_NOT_CONFIGURED");
  });
});
