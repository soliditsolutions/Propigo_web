// @vitest-environment jsdom
/**
 * Datos de la corredora (M-23, M-25): todos los errores a la vez, cada uno
 * junto a su campo, y el de un campo desaparece al corregirlo.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";

const { mockGuardarDatos, mockGuardarCuenta, mockEliminar } = vi.hoisted(() => ({
  mockGuardarDatos:  vi.fn(),
  mockGuardarCuenta: vi.fn(),
  mockEliminar:      vi.fn(),
}));
vi.mock("../actions", () => ({
  guardarDatosCorredora:   mockGuardarDatos,
  guardarCuentaCorredora:  mockGuardarCuenta,
  eliminarCuentaCorredora: mockEliminar,
}));

const { CorredoraClient } = await import("../corredora-client");
const { ToastProvider } = await import("@/components/ui/toast");

const DATOS = { nombre: "Corredora Demo SpA", rut: "761234560", esPersonaJuridica: true, giro: "", direccion: "" };
const CUENTA_OK = {
  banco: "Banco de Chile", tipo: "corriente", numero: "0012345678",
  titular: "Corredora Demo SpA", rutTitular: "76.123.456-0", email: "pagos@demo.cl",
};

function montar(cuenta: typeof CUENTA_OK | null = CUENTA_OK) {
  render(<ToastProvider><CorredoraClient datos={DATOS} cuenta={cuenta} /></ToastProvider>);
}
const escribir = (label: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });

beforeEach(() => {
  mockGuardarDatos.mockReset();
  mockGuardarCuenta.mockReset();
  mockEliminar.mockReset();
});

describe("Cuenta bancaria de la corredora", () => {
  it("muestra todos los errores juntos, junto a su campo, sin llamar al servidor", () => {
    montar();
    escribir("RUT del titular", "76.123.456-9");
    escribir("Correo para el comprobante (opcional)", "no-es-correo");
    fireEvent.click(screen.getByRole("button", { name: "Guardar cuenta" }));

    const rut = screen.getByLabelText("RUT del titular");
    const correo = screen.getByLabelText("Correo para el comprobante (opcional)");
    expect(rut).toHaveAttribute("aria-invalid", "true");
    expect(correo).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(rut.getAttribute("aria-describedby")!)).toHaveTextContent(/dígito verificador/);
    expect(document.getElementById(correo.getAttribute("aria-describedby")!)).toHaveTextContent(/correo del titular/);
    expect(mockGuardarCuenta).not.toHaveBeenCalled();
  });

  it("el error de un campo desaparece al corregirlo; el del otro sigue", () => {
    montar();
    escribir("RUT del titular", "76.123.456-9");
    escribir("Correo para el comprobante (opcional)", "no-es-correo");
    fireEvent.click(screen.getByRole("button", { name: "Guardar cuenta" }));

    escribir("RUT del titular", "76.123.456-0");
    expect(screen.queryByText(/dígito verificador/)).toBeNull();
    expect(screen.getByLabelText("RUT del titular")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText(/correo del titular/)).toBeInTheDocument();
  });

  it("los errores por campo que devuelve el servidor se muestran igual, sin toast", async () => {
    mockGuardarCuenta.mockResolvedValue({
      ok: false, error: "Indica el nombre del banco.", campos: { banco: "Indica el nombre del banco." },
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cuenta" }));
    await waitFor(() => expect(screen.getByLabelText("Banco")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getAllByText("Indica el nombre del banco.")).toHaveLength(1);
  });

  it("un fallo sin campo (p. ej. la base) se avisa en un toast", async () => {
    mockGuardarCuenta.mockResolvedValue({ ok: false, error: "No se pudo guardar la cuenta bancaria. Intenta de nuevo." });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cuenta" }));
    expect(await screen.findByText("No se pudo guardar la cuenta bancaria. Intenta de nuevo.")).toBeInTheDocument();
  });
});

describe("Identificación y facturación", () => {
  it("un giro demasiado largo se marca en su campo y se limpia al editarlo", async () => {
    mockGuardarDatos.mockResolvedValue({
      ok: false, error: "El giro es demasiado largo (máximo 120 caracteres).",
      campos: { giro: "El giro es demasiado largo (máximo 120 caracteres)." },
    });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Guardar datos" }));
    await waitFor(() => expect(screen.getByLabelText("Giro")).toHaveAttribute("aria-invalid", "true"));
    escribir("Giro", "Corretaje");
    expect(screen.queryByText(/demasiado largo/)).toBeNull();
  });
});
