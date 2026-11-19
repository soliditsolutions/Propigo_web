// @vitest-environment jsdom
/**
 * Tests: LoginForm — aria-invalid + aria-describedby (UI-C2)
 * WCAG 1.3.1 / 4.1.2: los inputs deben comunicar estado de error a AT.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { ToastProvider } from "@/components/ui/toast";

// vi.hoisted garantiza que mockUseActionState esté disponible cuando
// vi.mock() construye el módulo falso de 'react' (antes del cuerpo del módulo).
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

vi.mock("../actions", () => ({
  loginAction: vi.fn(),
}));

// Importar el componente DESPUÉS de declarar los mocks
const { LoginForm } = await import("../login-form");

const NO_ERROR = [null, vi.fn(), false] as const;

// LoginForm llama a useToast() para mostrar errores/éxito de reset como
// notificación — requiere <ToastProvider> como ancestro (igual que el
// layout raíz real). Sin este wrapper, useToast() lanza.
function renderLoginForm(props: React.ComponentProps<typeof LoginForm> = {}) {
  return render(
    <ToastProvider>
      <LoginForm {...props} />
    </ToastProvider>,
  );
}

describe("LoginForm — estado inicial (sin errores)", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([...NO_ERROR]);
  });

  it("renderiza email y contraseña", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("input email NO tiene aria-invalid inicialmente", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Correo electrónico")).not.toHaveAttribute("aria-invalid");
  });

  it("input password NO tiene aria-invalid inicialmente", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Contraseña")).not.toHaveAttribute("aria-invalid");
  });

  it("no hay mensajes role='alert' inicialmente", () => {
    renderLoginForm();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("LoginForm — error de campo email (UI-C2)", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([
      { error: "Correo electrónico inválido.", field: "email" },
      vi.fn(),
      false,
    ]);
  });

  it("input email tiene aria-invalid=true", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
  });

  it("input email tiene aria-describedby='email-error'", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Correo electrónico"))
      .toHaveAttribute("aria-describedby", "email-error");
  });

  it("existe un elemento #email-error con role='alert'", () => {
    renderLoginForm();
    const el = document.getElementById("email-error");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("role", "alert");
  });

  it("el mensaje de error es visible", () => {
    renderLoginForm();
    expect(screen.getByRole("alert")).toHaveTextContent("Correo electrónico inválido.");
  });

  it("input password NO tiene aria-invalid cuando el error es de email", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Contraseña")).not.toHaveAttribute("aria-invalid");
  });
});

describe("LoginForm — error general de credenciales (UI-C2)", () => {
  beforeEach(() => {
    // Sin field → va a la contraseña (credenciales incorrectas)
    mockUseActionState.mockReturnValue([
      { error: "Credenciales incorrectas.", field: undefined },
      vi.fn(),
      false,
    ]);
  });

  it("input password tiene aria-invalid=true", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "true");
  });

  it("input password tiene aria-describedby='password-error'", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Contraseña"))
      .toHaveAttribute("aria-describedby", "password-error");
  });

  it("existe #password-error con role='alert'", () => {
    renderLoginForm();
    const el = document.getElementById("password-error");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("role", "alert");
  });

  it("input email NO tiene aria-invalid", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Correo electrónico")).not.toHaveAttribute("aria-invalid");
  });
});

describe("LoginForm — banner de éxito post-reset", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([...NO_ERROR]);
  });

  it("muestra banner role='status' cuando resetSuccess=true", () => {
    renderLoginForm({ resetSuccess: true });
    expect(screen.getByRole("status")).toHaveTextContent("Contraseña actualizada");
  });

  it("no muestra banner de éxito por defecto", () => {
    renderLoginForm();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

// ── Nuevos tests: bloqueo escalonado ────────────────────────────────────────

describe("LoginForm — advertencia progresiva (2° intento fallido)", () => {
  it("NO muestra advertencia en el 1° intento fallido", () => {
    mockUseActionState.mockReturnValue([
      { error: "Email o contraseña incorrectos.", attempts: 1 },
      vi.fn(), false,
    ]);
    renderLoginForm();
    expect(screen.queryByText(/quedan/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/5 minutos/i)).not.toBeInTheDocument();
  });

  it("muestra advertencia con role='alert' a partir del 2° intento", () => {
    mockUseActionState.mockReturnValue([
      { error: "Email o contraseña incorrectos.", attempts: 2 },
      vi.fn(), false,
    ]);
    renderLoginForm();
    // Debe haber al menos 2 alerts: el del campo contraseña + el de advertencia
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(2);
  });

  it("la advertencia menciona espera de 5 minutos en el 3° intento", () => {
    mockUseActionState.mockReturnValue([
      { error: "Email o contraseña incorrectos.", attempts: 2 },
      vi.fn(), false,
    ]);
    renderLoginForm();
    expect(screen.getByText(/5 minutos/i)).toBeInTheDocument();
  });

  it("la advertencia menciona 1 hora en el 4° intento", () => {
    mockUseActionState.mockReturnValue([
      { error: "Email o contraseña incorrectos.", attempts: 2 },
      vi.fn(), false,
    ]);
    renderLoginForm();
    expect(screen.getByText(/1 hora/i)).toBeInTheDocument();
  });

  it("la advertencia menciona bloqueo de cuenta en el 5° intento", () => {
    mockUseActionState.mockReturnValue([
      { error: "Email o contraseña incorrectos.", attempts: 2 },
      vi.fn(), false,
    ]);
    renderLoginForm();
    expect(screen.getByText(/cuenta bloqueada/i)).toBeInTheDocument();
  });

  it("muestra cuántos intentos quedan (3 restantes cuando attempts=2)", () => {
    mockUseActionState.mockReturnValue([
      { error: "Email o contraseña incorrectos.", attempts: 2 },
      vi.fn(), false,
    ]);
    renderLoginForm();
    expect(screen.getByText(/quedan 3 intentos/i)).toBeInTheDocument();
  });

  it("el formulario sigue habilitado con advertencia (sin bloqueo)", () => {
    mockUseActionState.mockReturnValue([
      { error: "Email o contraseña incorrectos.", attempts: 2 },
      vi.fn(), false,
    ]);
    renderLoginForm();
    expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled();
  });
});

describe("LoginForm — bloqueo temporal 5 minutos (3° intento)", () => {
  const LOCKED_UNTIL = Date.now() + 5 * 60_000; // 5 min desde ahora

  beforeEach(() => {
    mockUseActionState.mockReturnValue([
      { error: "Tu cuenta está bloqueada temporalmente.", lockedUntil: LOCKED_UNTIL, attempts: 3 },
      vi.fn(), false,
    ]);
  });

  it("muestra panel de bloqueo con role='alert'", () => {
    renderLoginForm();
    const alerts = screen.getAllByRole("alert");
    const lockAlert = alerts.find((el) => /pausa/i.test(el.textContent ?? ""));
    expect(lockAlert).toBeInTheDocument();
  });

  it("el panel indica bloqueo de 5 minutos", () => {
    renderLoginForm();
    expect(screen.getByText(/en pausa 5 minutos/i)).toBeInTheDocument();
  });

  it("muestra enlace para cambiar contraseña", () => {
    renderLoginForm();
    const link = screen.getByRole("link", { name: /crear una contraseña nueva/i });
    expect(link).toHaveAttribute("href", "/recuperar-contrasena");
  });

  it("el botón de submit está deshabilitado durante el bloqueo", () => {
    renderLoginForm();
    expect(screen.getByRole("button", { name: /cuenta en pausa/i })).toBeDisabled();
  });

  it("los inputs de email y contraseña están deshabilitados", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Correo electrónico")).toBeDisabled();
    expect(screen.getByLabelText("Contraseña")).toBeDisabled();
  });

  it("avisa que el siguiente intento causará bloqueo de 1 hora", () => {
    renderLoginForm();
    expect(screen.getByText(/próximo intento falla, la pausa será de 1 hora/i)).toBeInTheDocument();
  });

  it("NO muestra error de contraseña (pwdError) durante el bloqueo", () => {
    renderLoginForm();
    expect(document.getElementById("password-error")).not.toBeInTheDocument();
  });
});

describe("LoginForm — bloqueo temporal 1 hora (4° intento)", () => {
  const LOCKED_UNTIL = Date.now() + 60 * 60_000;

  beforeEach(() => {
    mockUseActionState.mockReturnValue([
      { error: "Tu cuenta está bloqueada temporalmente.", lockedUntil: LOCKED_UNTIL, attempts: 4 },
      vi.fn(), false,
    ]);
  });

  it("el panel indica bloqueo de 1 hora", () => {
    renderLoginForm();
    expect(screen.getByText(/en pausa 1 hora/i)).toBeInTheDocument();
  });

  it("avisa que el siguiente intento bloqueará permanentemente", () => {
    renderLoginForm();
    expect(screen.getByText(/bloqueamos la cuenta y tendrás que crear una contraseña nueva/i)).toBeInTheDocument();
  });

  it("muestra enlace para cambiar contraseña", () => {
    renderLoginForm();
    const link = screen.getByRole("link", { name: /crear una contraseña nueva/i });
    expect(link).toBeInTheDocument();
  });

  it("el botón está deshabilitado", () => {
    renderLoginForm();
    expect(screen.getByRole("button", { name: /cuenta en pausa/i })).toBeDisabled();
  });
});

describe("LoginForm — bloqueo permanente (5° intento)", () => {
  beforeEach(() => {
    mockUseActionState.mockReturnValue([
      { error: "Tu cuenta ha sido bloqueada por seguridad.", blocked: true, attempts: 5 },
      vi.fn(), false,
    ]);
  });

  it("muestra panel de bloqueo permanente con role='alert'", () => {
    renderLoginForm();
    const alerts = screen.getAllByRole("alert");
    const blockAlert = alerts.find((el) => /bloqueamos tu cuenta para protegerla/i.test(el.textContent ?? ""));
    expect(blockAlert).toBeInTheDocument();
  });

  it("muestra botón/enlace para solicitar cambio de contraseña", () => {
    renderLoginForm();
    const link = screen.getByRole("link", { name: /crear una contraseña nueva/i });
    expect(link).toHaveAttribute("href", "/recuperar-contrasena");
  });

  it("el botón de submit está deshabilitado y muestra 'Cuenta bloqueada'", () => {
    renderLoginForm();
    const submitBtn = screen.getByRole("button", { name: /cuenta bloqueada$/i });
    expect(submitBtn).toBeDisabled();
  });

  it("los inputs están deshabilitados", () => {
    renderLoginForm();
    expect(screen.getByLabelText("Correo electrónico")).toBeDisabled();
    expect(screen.getByLabelText("Contraseña")).toBeDisabled();
  });

  it("NO muestra el panel de advertencia progresiva (reemplazado por bloqueo)", () => {
    renderLoginForm();
    expect(screen.queryByText(/quedan/i)).not.toBeInTheDocument();
  });

  it("NO muestra error de contraseña en el input", () => {
    renderLoginForm();
    expect(document.getElementById("password-error")).not.toBeInTheDocument();
  });
});
