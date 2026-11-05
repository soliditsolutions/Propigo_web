/**
 * Tests: la foto de perfil explica por qué no se subió (M-16).
 *
 * Antes cualquier rechazo se descartaba en silencio y la foto simplemente no
 * cambiaba: el usuario no sabía si fue el formato, el tamaño o la red.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../actions", () => ({
  guardarPerfilAction: vi.fn(), cambiarPasswordAction: vi.fn(),
  solicitarCambioContactoAction: vi.fn(), confirmarCambioContactoAction: vi.fn(),
}));

const { validarFotoPerfil, mensajeFalloSubida } = await import("../perfil-form");

describe("validarFotoPerfil", () => {
  it("acepta JPG, PNG y WEBP de hasta 5 MB", () => {
    expect(validarFotoPerfil({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(validarFotoPerfil({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
    expect(validarFotoPerfil({ type: "image/webp", size: 10 })).toBeNull();
  });

  it("rechaza otros formatos con el motivo", () => {
    expect(validarFotoPerfil({ type: "application/x-msdownload", size: 10 })).toMatch(/JPG, PNG o WEBP/);
    expect(validarFotoPerfil({ type: "image/gif", size: 10 })).toMatch(/JPG, PNG o WEBP/);
    expect(validarFotoPerfil({ type: "", size: 10 })).toMatch(/JPG, PNG o WEBP/);
  });

  it("rechaza más de 5 MB con el límite en el mensaje", () => {
    expect(validarFotoPerfil({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});

describe("mensajeFalloSubida", () => {
  it("401 pide volver a iniciar sesión", () => {
    expect(mensajeFalloSubida(401, "No autorizado.")).toMatch(/sesión expiró/);
  });

  it("un 4xx muestra el motivo del servidor", () => {
    expect(mensajeFalloSubida(429, "Demasiados archivos subidos en poco tiempo.")).toBe("Demasiados archivos subidos en poco tiempo.");
  });

  it("un 5xx no expone el detalle interno", () => {
    expect(mensajeFalloSubida(500, "Error interno al procesar el archivo.")).toMatch(/No pudimos subir la foto/);
  });

  it("un 4xx sin motivo usa el mensaje genérico", () => {
    expect(mensajeFalloSubida(400)).toMatch(/No pudimos subir la foto/);
  });
});
