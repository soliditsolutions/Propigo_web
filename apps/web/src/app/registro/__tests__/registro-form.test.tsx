// @vitest-environment jsdom
/**
 * Tests: RegistroForm
 * — aria-invalid + aria-describedby en todos los campos (UI-C2)
 * — aria-live="polite" en PasswordStrengthMeter (UI-C5)
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

const mockUseActionState = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: mockUseActionState };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../actions", () => ({ registroAction: vi.fn() }));

const { RegistroForm } = await import("../registro-form");

const NO_ERROR = [null, vi.fn(), false] as const;

function clickSubmit() {
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta gratuita/i }));
}

describe("RegistroForm — estado inicial (sin errores)", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([...NO_ERROR]);
  });

  it("renderiza los seis campos requeridos", () => {
    render(<RegistroForm />);
    expect(screen.getByLabelText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByLabelText("RUT")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre de la corredora")).toBeInTheDocument();
    expect(screen.getByLabelText("RUT de la corredora")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("ningún input de texto tiene aria-invalid inicialmente", () => {
    render(<RegistroForm />);
    screen.getAllByRole("textbox").forEach((input) =>
      expect(input).not.toHaveAttribute("aria-invalid"),
    );
  });

  it("no hay mensajes role='alert' inicialmente", () => {
    render(<RegistroForm />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RegistroForm — errores de validación cliente (UI-C2)", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([...NO_ERROR]);
  });

  it("nombre tiene aria-invalid=true tras submit vacío", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("aria-invalid", "true");
  });

  it("#nombre-error existe con role='alert' tras submit vacío", () => {
    render(<RegistroForm />);
    clickSubmit();
    const el = document.getElementById("nombre-error");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("role", "alert");
  });

  it("nombre tiene aria-describedby='nombre-error' cuando hay error", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getByLabelText("Nombre completo"))
      .toHaveAttribute("aria-describedby", "nombre-error");
  });

  it("email tiene aria-invalid=true tras submit vacío", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
  });

  it("#email-error existe con role='alert'", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(document.getElementById("email-error")).toHaveAttribute("role", "alert");
  });

  it("email tiene aria-describedby='email-error'", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getByLabelText("Correo electrónico"))
      .toHaveAttribute("aria-describedby", "email-error");
  });

  it("empresa tiene aria-invalid=true tras submit vacío", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getByLabelText("Nombre de la corredora"))
      .toHaveAttribute("aria-invalid", "true");
  });

  it("#empresa-error existe con role='alert'", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(document.getElementById("empresa-error")).toHaveAttribute("role", "alert");
  });

  it("contraseña tiene aria-invalid=true tras submit vacío", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "true");
  });

  it("#password-error existe con role='alert'", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(document.getElementById("password-error")).toHaveAttribute("role", "alert");
  });

  it("consent tiene aria-invalid=true tras submit vacío", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("#consent-error existe con role='alert'", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(document.getElementById("consent-error")).toHaveAttribute("role", "alert");
  });

  it("aparecen al menos 5 alertas simultáneas (una por campo con error)", () => {
    render(<RegistroForm />);
    clickSubmit();
    expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(5);
  });
});

describe("RegistroForm — errores de servidor (UI-C2)", () => {
  it("con error server field='email', email tiene aria-invalid=true", () => {
    mockUseActionState.mockReturnValue([
      { error: "Este correo ya está registrado.", field: "email" },
      vi.fn(),
      false,
    ]);
    render(<RegistroForm />);
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
  });

  it("con error server field='nombre', nombre tiene aria-invalid=true", () => {
    mockUseActionState.mockReturnValue([
      { error: "Nombre inválido.", field: "nombre" },
      vi.fn(),
      false,
    ]);
    render(<RegistroForm />);
    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("RegistroForm — aria-live en medidor de contraseña (UI-C5)", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([...NO_ERROR]);
  });

  it("existe contenedor aria-live='polite' para el medidor de fuerza", () => {
    const { container } = render(<RegistroForm />);
    expect(container.querySelector("[aria-live='polite']")).toBeInTheDocument();
  });

  it("el contenedor aria-live tiene aria-atomic='true'", () => {
    const { container } = render(<RegistroForm />);
    expect(container.querySelector("[aria-live='polite']"))
      .toHaveAttribute("aria-atomic", "true");
  });
});

describe("RegistroForm — aria-describedby al hint cuando no hay error", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([...NO_ERROR]);
  });

  it("nombre apunta a nombre-hint cuando no hay error", () => {
    render(<RegistroForm />);
    expect(screen.getByLabelText("Nombre completo"))
      .toHaveAttribute("aria-describedby", "nombre-hint");
  });

  it("nombre-hint contiene texto sobre la cédula de identidad", () => {
    render(<RegistroForm />);
    expect(document.getElementById("nombre-hint")).toHaveTextContent(/cédula de identidad/i);
  });
});


// ── RUT de la corredora (rowMap legal, Grupo B: L-DT1 y L-DT2) ───────────────
//
// Antes el registro creaba el Tenant solo con nombre y plan: el RUT de la
// corredora —lo que la identifica ante el SII y va en cada documento que
// emite— no se pedía en ninguna parte. Ahora es obligatorio y único.
//
// El caso que estos tests cuidan es el del corredor independiente: para él la
// corredora ES él, y pedirle su RUT dos veces solo daría ocasión de tipearlo
// distinto entre un campo y otro.

function llenarFormulario() {
  fireEvent.change(screen.getByLabelText("Nombre completo"), {
    target: { value: "Juan García López" },
  });
  fireEvent.change(screen.getByLabelText("RUT"), { target: { value: "111111111" } });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), {
    target: { value: "juan@correo.cl" },
  });
  fireEvent.change(screen.getByLabelText("Nombre de la corredora"), {
    target: { value: "Corredora del Sur SpA" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "MiContraseñaMuyLargaYSegura123!" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("RegistroForm — RUT de la corredora", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([...NO_ERROR]);
  });

  it("por defecto opera como empresa y pide el RUT de la corredora", () => {
    render(<RegistroForm />);
    expect(screen.getByRole("radio", { name: /como empresa/i })).toBeChecked();
    expect(screen.getByLabelText("RUT de la corredora")).toBeInTheDocument();
  });

  it("el hint aclara que no es el RUT personal", () => {
    render(<RegistroForm />);
    expect(document.getElementById("rutEmpresa-hint")).toHaveTextContent(/no es el tuyo/i);
  });

  it("como persona natural el campo desaparece: no se pide el RUT dos veces", () => {
    render(<RegistroForm />);
    fireEvent.click(screen.getByRole("radio", { name: /como persona natural/i }));
    expect(screen.queryByLabelText("RUT de la corredora")).toBeNull();
  });

  it("valida el dígito verificador mientras se escribe", () => {
    render(<RegistroForm />);
    // 11.111.111-1 es válido mod-11, así que -2 no lo es.
    fireEvent.change(screen.getByLabelText("RUT de la corredora"), {
      target: { value: "111111112" },
    });
    expect(screen.getByText("RUT inválido")).toBeInTheDocument();
  });

  it("formatea con puntos y guión igual que el RUT personal", () => {
    render(<RegistroForm />);
    const input = screen.getByLabelText("RUT de la corredora") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "761234560" } });
    expect(input.value).toBe("76.123.456-0");
  });

  it("como empresa, no deja enviar sin el RUT de la corredora", () => {
    render(<RegistroForm />);
    llenarFormulario();
    clickSubmit();
    expect(screen.getByText(/Ingresa el RUT de tu corredora/i)).toBeInTheDocument();
  });

  it("como persona natural, el formulario avanza sin ese campo", () => {
    render(<RegistroForm />);
    fireEvent.click(screen.getByRole("radio", { name: /como persona natural/i }));
    llenarFormulario();
    clickSubmit();
    // Este es el punto: el corredor independiente no queda bloqueado por un
    // campo que para él es el mismo dato que ya entregó.
    expect(screen.queryByText(/Ingresa el RUT de tu corredora/i)).toBeNull();
  });
});
