// @vitest-environment jsdom
/**
 * Tests: RecuperarForm — aviso genérico tras enviar (anti-enumeración) y
 * reenvío con espera, para no disparar correos seguidos.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const mockUseActionState = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: mockUseActionState };
});
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../actions", () => ({ recuperarAction: vi.fn() }));

const { RecuperarForm } = await import("../recuperar-form");

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("RecuperarForm", () => {
  it("un error del servidor se muestra como alerta", () => {
    mockUseActionState.mockReturnValue([{ error: "Ingresa un correo electrónico válido." }, vi.fn(), false]);
    render(<RecuperarForm />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresa un correo electrónico válido.");
  });

  it("tras enviar avisa sin confirmar si la cuenta existe, y el reenvío espera 45 segundos", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    const vista = render(<RecuperarForm />);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "maria@x.cl" } });

    mockUseActionState.mockReturnValue([{ sent: true }, vi.fn(), false]);
    vista.rerender(<RecuperarForm />);

    expect(screen.getByRole("status")).toHaveTextContent(/si ese correo tiene una cuenta/i);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Revisa tu correo");
    // El reenvío vuelve a mandar el mismo correo, sin pedirlo de nuevo.
    expect(document.querySelector<HTMLInputElement>('input[name="email"]')?.value).toBe("maria@x.cl");

    const boton = screen.getByRole("button", { name: /podrás pedir otro/i });
    expect(boton).toBeDisabled();
    act(() => { vi.advanceTimersByTime(45_000); });
    expect(screen.getByRole("button", { name: /enviar otro enlace/i })).toBeEnabled();
  });
});
