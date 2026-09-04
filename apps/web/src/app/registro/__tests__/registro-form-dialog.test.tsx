// @vitest-environment jsdom
/**
 * Tests: RegistroForm — CarnetModal → Dialog (Lote 4: UI-C7)
 *
 * Verifica que el modal de verificación de identidad se implementa con
 * Dialog de @base-ui/react, que delega automáticamente: role="dialog",
 * aria-modal="true", aria-labelledby→DialogTitle y focus trap.
 *
 * Estrategia de mock: reemplazamos @/components/ui/dialog con equivalentes
 * HTML semánticos para poder probar el árbol sin depender de los internals
 * de @base-ui en jsdom.
 */
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUseActionState = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: mockUseActionState };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children?: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../actions", () => ({ registroAction: vi.fn() }));

// evaluatePassword: siempre retorna contraseña muy fuerte para que no bloquee el submit
vi.mock("@/lib/password-strength", () => ({
  PASSWORD_MIN_LENGTH: 8,
  evaluatePassword: () => ({
    score:      4,
    label:      "Muy fuerte",
    color:      "#16a34a",
    suggestion: "",
    passes:     true,
  }),
  checkRequisitos: () => ({
    minLength:      true,
    hasLetter:      true,
    hasDigit:       true,
    hasSpecial:     true,
    noPersonalInfo: true,
    notCommon:      true,
  }),
}));

// Mock del sistema Dialog: semántica HTML equivalente a lo que genera @base-ui/react.
// Dialog gestiona open/closed; DialogContent provee role+aria-modal;
// DialogTitle, DialogDescription y DialogClose son wrappers de contenido.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange?: (v: boolean) => void;
    children?: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),

  DialogContent: ({
    children,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se excluye de `rest` para que no se spreadee al DOM
    showCloseButton: _showClose,
    ...rest
  }: {
    children?: React.ReactNode;
    showCloseButton?: boolean;
    className?: string;
    style?: React.CSSProperties;
    [k: string]: unknown;
  }) => (
    <div role="dialog" aria-modal="true" {...rest}>
      {children}
    </div>
  ),

  DialogTitle: ({
    children,
    className,
    style,
  }: {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <h2 className={className} style={style}>
      {children}
    </h2>
  ),

  DialogDescription: ({
    children,
    className,
    style,
  }: {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }) => (
    <p className={className} style={style}>
      {children}
    </p>
  ),

  DialogClose: ({
    children,
    "aria-label": ariaLabel,
    className,
    style,
    ...rest
  }: {
    children?: React.ReactNode;
    "aria-label"?: string;
    className?: string;
    style?: React.CSSProperties;
    [k: string]: unknown;
  }) => (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      style={style}
      {...rest}
    >
      {children}
    </button>
  ),
}));

// Importación dinámica DESPUÉS de todos los vi.mock()
const { RegistroForm } = await import("../registro-form");

// ── Helper ───────────────────────────────────────────────────────────────────

// 11.111.111-1 es un RUT chileno válido (verificado con algoritmo módulo 11).
// Enviamos "111111111" raw: handleRutChange lo formatea a "11.111.111-1".
function abrirModal() {
  fireEvent.change(screen.getByLabelText(/nombre completo/i), {
    target: { value: "Juan García López" },
  });
  fireEvent.change(screen.getByLabelText(/^rut$/i), {
    target: { value: "111111111" },
  });
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
    target: { value: "juan@correo.cl" },
  });
  fireEvent.change(screen.getByLabelText(/nombre de la corredora/i), {
    target: { value: "Corredora del Sur SpA" },
  });
  // Desde el Grupo B del rowMap legal el RUT de la corredora es obligatorio:
  // sin él la validación del cliente no deja abrir el modal. 76.123.456-0 es
  // válido mod-11 y distinto del RUT personal de más arriba.
  fireEvent.change(screen.getByLabelText(/rut de la corredora/i), {
    target: { value: "761234560" },
  });
  // Label exacto "Contraseña" para no colisionar con aria-label="Mostrar contraseña" del ojo
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "MiContraseñaMuyLargaYSegura123!" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta gratuita/i }));
}

// ── Suite de tests ───────────────────────────────────────────────────────────

describe("CarnetModal Dialog (UI-C7) — visibilidad", () => {
  it("no hay role='dialog' antes de enviar el formulario", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("el dialog aparece tras enviar el formulario con datos válidos", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("CarnetModal Dialog (UI-C7) — atributos ARIA", () => {
  it("el dialog tiene aria-modal='true'", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("DialogTitle renderiza el encabezado 'Verificación de identidad'", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(
      screen.getByRole("heading", { name: /verificación de identidad/i }),
    ).toBeInTheDocument();
  });

  it("DialogDescription renderiza 'Requerida para crear tu cuenta'", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(screen.getByText(/requerida para crear tu cuenta/i)).toBeInTheDocument();
  });
});

describe("CarnetModal Dialog (UI-C7) — controles accesibles", () => {
  it("el botón de cierre tiene aria-label='Cerrar modal de verificación'", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(
      screen.getByRole("button", { name: /cerrar modal de verificación/i }),
    ).toBeInTheDocument();
  });

  it("el input de archivo tiene aria-label='Subir imagen del carnet de identidad'", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(
      screen.getByLabelText(/subir imagen del carnet de identidad/i),
    ).toBeInTheDocument();
  });

  it("el botón 'Verificar y crear cuenta' está deshabilitado sin archivo", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(
      screen.getByRole("button", { name: /verificar y crear cuenta/i }),
    ).toBeDisabled();
  });

  it("el botón 'Cancelar' está visible en el dialog", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();
    expect(screen.getByRole("button", { name: /^cancelar$/i })).toBeInTheDocument();
  });
});

describe("CarnetModal Dialog (UI-C7) — validación de archivo", () => {
  it("muestra role='alert' al subir un tipo de archivo no permitido (PDF)", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();

    const input = screen.getByLabelText(/subir imagen del carnet de identidad/i);
    const pdfFile = new File(["contenido"], "carnet.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [pdfFile] } });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/solo se aceptan imágenes/i);
  });

  it("muestra role='alert' al subir un archivo que supera los 5 MB", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();

    const input = screen.getByLabelText(/subir imagen del carnet de identidad/i);
    const bigFile = new File(["x"], "carnet.jpg", { type: "image/jpeg" });
    // Sobreescribimos size para simular un archivo de 6 MB sin crear el buffer
    Object.defineProperty(bigFile, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/no puede superar los 5 mb/i);
  });

  it("no hay role='alert' al subir un JPG válido (< 5 MB)", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();

    const input = screen.getByLabelText(/subir imagen del carnet de identidad/i);

    // jsdom no implementa FileReader.readAsDataURL; silenciamos el error
    const originalReadAsDataURL = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = vi.fn();

    const jpgFile = new File(["imagen"], "carnet.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [jpgFile] } });

    expect(screen.queryByRole("alert")).toBeNull();

    FileReader.prototype.readAsDataURL = originalReadAsDataURL;
  });

  it("el botón 'Verificar y crear cuenta' sigue deshabilitado con archivo pero sin marcar el consentimiento IA", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();

    const input = screen.getByLabelText(/subir imagen del carnet de identidad/i);
    FileReader.prototype.readAsDataURL = vi.fn();
    const jpgFile = new File(["imagen"], "carnet.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [jpgFile] } });

    expect(
      screen.getByRole("button", { name: /verificar y crear cuenta/i }),
    ).toBeDisabled();
  });

  it("el botón 'Verificar y crear cuenta' se habilita tras cargar un archivo válido y marcar el consentimiento IA", () => {
    mockUseActionState.mockReturnValue([null, vi.fn(), false]);
    render(<RegistroForm />);
    abrirModal();

    const input = screen.getByLabelText(/subir imagen del carnet de identidad/i);

    FileReader.prototype.readAsDataURL = vi.fn();

    const jpgFile = new File(["imagen"], "carnet.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [jpgFile] } });

    // Único checkbox visible en el dialog en este punto: el de consentimiento IA
    // (el consentimiento general de T&C ya se marcó en abrirModal(), en el form externo).
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("checkbox"));

    expect(
      screen.getByRole("button", { name: /verificar y crear cuenta/i }),
    ).not.toBeDisabled();

    FileReader.prototype.readAsDataURL = FileReader.prototype.readAsDataURL;
  });
});
