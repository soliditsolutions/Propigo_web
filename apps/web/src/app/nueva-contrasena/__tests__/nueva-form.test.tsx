// @vitest-environment jsdom
/**
 * Tests: NuevaContrasenaForm y EnlaceInvalido — estructura de textos, token
 * oculto, error del servidor como alerta y salida a pedir otro enlace.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import React from "react";

const mockUseActionState = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: mockUseActionState };
});
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    <a href={href} className={className}>{children}</a>,
}));
vi.mock("../actions", () => ({ nuevaContrasenaAction: vi.fn() }));

const { NuevaContrasenaForm, EnlaceInvalido } = await import("../nueva-form");

describe("NuevaContrasenaForm", () => {
  it("lleva el token oculto, un solo h1 y el medidor se anuncia sin interrumpir", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    const { container } = render(<NuevaContrasenaForm token="abc" />);
    expect(container.querySelector<HTMLInputElement>('input[name="token"]')?.value).toBe("abc");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByLabelText("Contraseña nueva")).toHaveAttribute("autocomplete", "new-password");
    expect(container.querySelector('[aria-live="polite"]')).toHaveAttribute("aria-atomic", "true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("un error del servidor se muestra como alerta", () => {
    mockUseActionState.mockReturnValue([{ error: "El enlace expiró o ya se usó. Solicita uno nuevo." }, vi.fn(), false]);
    render(<NuevaContrasenaForm token="abc" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/expiró o ya se usó/);
  });
});

describe("EnlaceInvalido", () => {
  it("explica el motivo y ofrece pedir otro enlace", () => {
    render(<EnlaceInvalido mensaje="Venció." />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Este enlace ya no sirve");
    expect(screen.getByText("Venció.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pedir un enlace nuevo/i })).toHaveAttribute("href", "/recuperar-contrasena");
  });
});
