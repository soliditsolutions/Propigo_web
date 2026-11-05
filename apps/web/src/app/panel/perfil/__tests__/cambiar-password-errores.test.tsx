// @vitest-environment jsdom
/**
 * Seguridad · cambiar contraseña (M-23): el error de un campo deja de verse
 * en cuanto el usuario lo corrige, y un envío nuevo vuelve a mostrarlo.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

const { mockCambiar } = vi.hoisted(() => ({ mockCambiar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../actions", () => ({
  cambiarPasswordAction:         mockCambiar,
  guardarPerfilAction:           vi.fn(),
  solicitarCambioContactoAction: vi.fn(),
  confirmarCambioContactoAction: vi.fn(),
}));

const { CambiarPasswordSection } = await import("../perfil-form");
const { ToastProvider } = await import("@/components/ui/toast");

const NUEVA = "Xq7!vRm2#pLw9";

function llenarYEnviar(actual: string) {
  fireEvent.change(screen.getByLabelText("Contraseña actual"), { target: { value: actual } });
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: NUEVA } });
  fireEvent.change(screen.getByLabelText("Confirmar nueva contraseña"), { target: { value: NUEVA } });
  fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña|Actualizar contraseña/ }));
}

beforeEach(() => { mockCambiar.mockReset(); });

describe("CambiarPasswordSection — errores que se corrigen", () => {
  it("el error de la contraseña actual desaparece al editarla y vuelve con un envío nuevo", async () => {
    // Objeto nuevo por llamada, como una respuesta real del servidor.
    mockCambiar.mockImplementation(async () => ({ ok: false, field: "passwordActual", error: "La contraseña actual es incorrecta." }));
    render(<ToastProvider><CambiarPasswordSection nombre="María" email="maria@test.cl" /></ToastProvider>);

    llenarYEnviar("mala");
    const alerta = await screen.findByText("La contraseña actual es incorrecta.");
    const campo = screen.getByLabelText("Contraseña actual");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(campo.getAttribute("aria-describedby")).toBe(alerta.id);

    fireEvent.input(campo, { target: { value: "otra" } });
    expect(screen.queryByText("La contraseña actual es incorrecta.")).toBeNull();
    expect(campo).not.toHaveAttribute("aria-invalid");

    fireEvent.click(screen.getByRole("button", { name: /Cambiar contraseña|Actualizar contraseña/ }));
    await waitFor(() => expect(mockCambiar).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("La contraseña actual es incorrecta.")).toBeInTheDocument();
  });

  it("editar otro campo no oculta el error del que sigue mal", async () => {
    mockCambiar.mockResolvedValue({ ok: false, field: "passwordConfirm", error: "Las contraseñas nuevas no coinciden." });
    render(<ToastProvider><CambiarPasswordSection nombre="María" email="maria@test.cl" /></ToastProvider>);

    llenarYEnviar("buena");
    await screen.findByText("Las contraseñas nuevas no coinciden.");
    fireEvent.input(screen.getByLabelText("Contraseña actual"), { target: { value: "otra" } });
    expect(screen.getByText("Las contraseñas nuevas no coinciden.")).toBeInTheDocument();
  });
});
