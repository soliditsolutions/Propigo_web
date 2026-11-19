// @vitest-environment jsdom
/**
 * Tests: RegistroForm en tres pasos (quién eres, tu corredora, cédula).
 * — errores asociados a cada campo (aria-invalid + aria-describedby + role="alert")
 * — un error del servidor lleva al paso del campo que lo causó
 * — la foto de la cédula se valida en el cliente y viaja en el FormData
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";

const mockUseActionState = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useActionState: mockUseActionState };
});

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("../actions", () => ({ registroAction: vi.fn() }));

const { RegistroForm, PASO_DEL_CAMPO } = await import("../registro-form");

const CLAVE_VALIDA = "Ventana-Azul-2026!";

beforeAll(() => {
  // jsdom no trae ResizeObserver (PanelAnimado) ni URL.createObjectURL (vista previa de la foto).
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  URL.createObjectURL = vi.fn(() => "blob:foto");
  URL.revokeObjectURL = vi.fn();
});
afterAll(() => vi.unstubAllGlobals());

let formAction: ReturnType<typeof vi.fn>;
beforeEach(() => {
  formAction = vi.fn();
  mockUseActionState.mockReturnValue([null, formAction, false]);
});

const continuar = () => fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
const crear = () => fireEvent.click(screen.getByRole("button", { name: /crear mi cuenta/i }));
const titulo = () => screen.getByRole("heading", { level: 1 }).textContent;

function llenarPaso1() {
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "María José Pérez" } });
  fireEvent.change(screen.getByLabelText("RUT"), { target: { value: "111111111" } });
  fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "maria@corredora.cl" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: CLAVE_VALIDA } });
}

function irAlPaso3({ natural = false } = {}) {
  llenarPaso1();
  continuar();
  fireEvent.change(screen.getByLabelText("Nombre de la corredora"), { target: { value: "Corredora del Sur SpA" } });
  if (natural) fireEvent.click(screen.getByRole("radio", { name: /como persona natural/i }));
  else fireEvent.change(screen.getByLabelText("RUT de la corredora"), { target: { value: "761234560" } });
  continuar();
}

const archivo = (tipo: string, bytes = 1024) =>
  new File([new Uint8Array(bytes)], tipo === "application/pdf" ? "cedula.pdf" : "cedula.jpg", { type: tipo });

function subir(f: File) {
  fireEvent.change(screen.getByLabelText("Subir la foto de tu cédula"), { target: { files: [f] } });
}

describe("RegistroForm — paso 1: quién eres", () => {
  it("empieza en el paso 1 con sus cuatro campos y sin errores", () => {
    render(<RegistroForm />);
    expect(titulo()).toBe("Cuéntanos quién eres");
    for (const etiqueta of ["Nombre completo", "RUT", "Correo electrónico", "Contraseña"]) {
      expect(screen.getByLabelText(etiqueta)).not.toHaveAttribute("aria-invalid");
    }
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("continuar en blanco marca cada campo con su error y no avanza", () => {
    render(<RegistroForm />);
    continuar();
    for (const [etiqueta, id] of [
      ["Nombre completo", "nombre"], ["RUT", "rut"], ["Correo electrónico", "reg-email"], ["Contraseña", "reg-password"],
    ]) {
      const input = screen.getByLabelText(etiqueta);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input.getAttribute("aria-describedby")).toContain(`${id}-error`);
      expect(document.getElementById(`${id}-error`)).toHaveAttribute("role", "alert");
    }
    expect(titulo()).toBe("Cuéntanos quién eres");
  });

  it("el nombre explica que va tal como en la cédula", () => {
    render(<RegistroForm />);
    expect(screen.getByLabelText("Nombre completo").getAttribute("aria-describedby")).toBe("nombre-ayuda");
    expect(document.getElementById("nombre-ayuda")).toHaveTextContent(/cédula/i);
  });

  it("el medidor de la contraseña se anuncia sin interrumpir", () => {
    const { container } = render(<RegistroForm />);
    const vivo = container.querySelector('[aria-live="polite"]');
    expect(vivo).not.toBeNull();
    expect(vivo).toHaveAttribute("aria-atomic", "true");
  });

  it("un RUT completo con dígito verificador errado se avisa mientras se escribe", () => {
    render(<RegistroForm />);
    fireEvent.change(screen.getByLabelText("RUT"), { target: { value: "111111112" } });
    expect(screen.getByLabelText("RUT")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("RegistroForm — paso 2: tu corredora", () => {
  it("por defecto opera como empresa y pide el RUT de la corredora, aclarando que no es el propio", () => {
    render(<RegistroForm />);
    llenarPaso1();
    continuar();
    expect(titulo()).toBe("Ahora, tu corredora");
    expect(screen.getByRole("radio", { name: /como empresa/i })).toBeChecked();
    expect(document.getElementById("rutEmpresa-ayuda")).toHaveTextContent(/no es el tuyo/i);
  });

  it("formatea el RUT de la corredora con puntos y guion", () => {
    render(<RegistroForm />);
    llenarPaso1();
    continuar();
    const input = screen.getByLabelText("RUT de la corredora") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "761234560" } });
    expect(input.value).toBe("76.123.456-0");
  });

  it("como empresa no avanza sin el RUT de la corredora", () => {
    render(<RegistroForm />);
    llenarPaso1();
    continuar();
    fireEvent.change(screen.getByLabelText("Nombre de la corredora"), { target: { value: "Corredora del Sur SpA" } });
    continuar();
    expect(screen.getByLabelText("RUT de la corredora")).toHaveAttribute("aria-invalid", "true");
    expect(titulo()).toBe("Ahora, tu corredora");
  });

  it("como persona natural el campo desaparece y avanza sin él", () => {
    render(<RegistroForm />);
    irAlPaso3({ natural: true });
    expect(titulo()).toBe("Verifica que eres tú");
  });

  it("volver atrás conserva lo escrito", () => {
    render(<RegistroForm />);
    llenarPaso1();
    continuar();
    fireEvent.click(screen.getByRole("button", { name: /atrás/i }));
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue("maria@corredora.cl");
  });
});

describe("RegistroForm — paso 3: cédula y consentimientos", () => {
  it("rechaza un archivo que no es imagen y uno de más de 5 MB", () => {
    render(<RegistroForm />);
    irAlPaso3();
    subir(archivo("application/pdf"));
    expect(screen.getByRole("alert")).toHaveTextContent(/JPG, PNG o WEBP/);
    subir(archivo("image/jpeg", 5 * 1024 * 1024 + 1));
    expect(screen.getByRole("alert")).toHaveTextContent(/más de 5 MB/);
  });

  it("una foto válida muestra su vista previa y se puede cambiar", () => {
    render(<RegistroForm />);
    irAlPaso3();
    subir(archivo("image/jpeg"));
    expect(screen.getByRole("img", { name: /vista previa de tu cédula/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cambiar la foto/i }));
    expect(screen.getByLabelText("Subir la foto de tu cédula")).toBeInTheDocument();
  });

  it("sin foto ni consentimientos no envía y marca los tres", () => {
    render(<RegistroForm />);
    irAlPaso3();
    crear();
    expect(document.getElementById("reg-carnet-error")).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/Workers AI/)).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("consent")).toHaveAttribute("aria-invalid", "true");
    expect(formAction).not.toHaveBeenCalled();
  });

  it("los consentimientos nunca vienen marcados (Ley 21.719)", () => {
    render(<RegistroForm />);
    irAlPaso3();
    expect(screen.getByLabelText(/Workers AI/)).not.toBeChecked();
    expect(document.getElementById("consent")).not.toBeChecked();
  });

  it("con todo listo envía un FormData con los datos de los tres pasos y la foto", () => {
    render(<RegistroForm />);
    irAlPaso3();
    subir(archivo("image/jpeg"));
    fireEvent.click(screen.getByLabelText(/Workers AI/));
    fireEvent.click(document.getElementById("consent")!);
    crear();
    expect(formAction).toHaveBeenCalledTimes(1);
    const fd = formAction.mock.calls[0][0] as FormData;
    expect(fd.get("nombre")).toBe("María José Pérez");
    expect(fd.get("rut")).toBe("11.111.111-1");
    expect(fd.get("email")).toBe("maria@corredora.cl");
    expect(fd.get("password")).toBe(CLAVE_VALIDA);
    expect(fd.get("empresa")).toBe("Corredora del Sur SpA");
    expect(fd.get("esPersonaJuridica")).toBe("juridica");
    expect(fd.get("rutEmpresa")).toBe("76.123.456-0");
    expect(fd.get("consent")).toBe("1");
    expect(fd.get("consentIa")).toBe("on");
    expect((fd.get("carnet") as File).type).toBe("image/jpeg");
  });
});

describe("RegistroForm — errores del servidor", () => {
  function conRespuesta(respuesta: { error: string; field?: string }, preparar: () => void) {
    const vista = render(<RegistroForm />);
    preparar();
    mockUseActionState.mockReturnValue([respuesta, formAction, false]);
    act(() => vista.rerender(<RegistroForm />));
  }

  it("un correo ya registrado vuelve al paso 1 con el error en el correo", () => {
    conRespuesta({ error: "Ya existe una cuenta con este correo electrónico.", field: "email" }, () => irAlPaso3());
    expect(titulo()).toBe("Cuéntanos quién eres");
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
  });

  it("un problema con la foto se queda en el paso 3 y lo explica", () => {
    conRespuesta({ error: "No pudimos leer la cédula.", field: "carnet" }, () => irAlPaso3());
    expect(titulo()).toBe("Verifica que eres tú");
    expect(document.getElementById("reg-carnet-error")).toHaveTextContent("No pudimos leer la cédula.");
  });

  it("un error general se muestra en el último paso", () => {
    conRespuesta({ error: "No pudimos crear la cuenta." }, () => irAlPaso3());
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos crear la cuenta.");
  });

  it("cada campo con el que responde el servidor tiene un paso asignado", () => {
    const fuente = readFileSync(join(__dirname, "..", "actions.ts"), "utf8");
    const campos = new Set([...fuente.matchAll(/field:[^,}\n]*/g)].flatMap((m) => [...m[0].matchAll(/"(\w+)"/g)].map((x) => x[1])));
    expect(campos.size).toBeGreaterThan(5);
    for (const c of campos) expect(PASO_DEL_CAMPO[c], c).toBeTypeOf("number");
  });
});
