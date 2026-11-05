// @vitest-environment jsdom
/**
 * Tests: LoginForm conserva lo escrito tras un envío (M-03). React 19 reinicia
 * los campos no controlados después de cada acción; aquí son controlados y
 * solo la contraseña se vacía, y solo cuando el servidor la rechazó.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ToastProvider } from "@/components/ui/toast";

const mockUseActionState = vi.hoisted(() => vi.fn());
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: mockUseActionState };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../actions", () => ({ loginAction: vi.fn() }));

const { LoginForm } = await import("../login-form");

function montarYEscribir() {
  mockUseActionState.mockReturnValue([null, vi.fn(), false]);
  const vista = render(<ToastProvider><LoginForm /></ToastProvider>);
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "maria@x.cl" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Secreta1!" } });
  return vista;
}

function nuevoEstado(vista: ReturnType<typeof render>, estado: unknown) {
  mockUseActionState.mockReturnValue([estado, vi.fn(), false]);
  vista.rerender(<ToastProvider><LoginForm /></ToastProvider>);
}

describe("LoginForm — conserva los campos (M-03)", () => {
  it("credencial rechazada: mantiene el correo y vacía la contraseña", () => {
    const vista = montarYEscribir();
    nuevoEstado(vista, { error: "Correo o contraseña incorrectos.", credencialRechazada: true });
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("maria@x.cl");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });

  it("error del servidor o de red: mantiene correo y contraseña", () => {
    const vista = montarYEscribir();
    nuevoEstado(vista, { error: "No pudimos completar la acción por un problema de nuestro lado." });
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("maria@x.cl");
    expect(screen.getByLabelText("Contraseña")).toHaveValue("Secreta1!");
  });

  it("un segundo rechazo con el mismo mensaje vuelve a vaciar la contraseña", () => {
    const vista = montarYEscribir();
    nuevoEstado(vista, { error: "Correo o contraseña incorrectos.", credencialRechazada: true });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Otra2!" } });
    nuevoEstado(vista, { error: "Correo o contraseña incorrectos.", credencialRechazada: true });
    expect(screen.getByLabelText("Contraseña")).toHaveValue("");
  });
});
