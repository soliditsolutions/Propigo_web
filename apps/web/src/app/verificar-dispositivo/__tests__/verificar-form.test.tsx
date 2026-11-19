// @vitest-environment jsdom
/**
 * Tests: VerificarForm — envío del código al entrar, espera del reenvío igual a
 * la del servidor, código incorrecto en el campo y fin de intentos.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

const { default: VerificarForm, enmascararCorreo, ESPERA_REENVIO_S } = await import("../verificar-form");

type Respuesta = { status: number; body: unknown };
let respuestas: Record<string, Respuesta>;
const fetchMock = vi.fn(async (url: string) => {
  const r = respuestas[url];
  return { ok: r.status < 400, status: r.status, json: async () => r.body } as Response;
});

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
beforeEach(() => {
  respuestas = { "/api/auth/dispositivo/enviar": { status: 200, body: { ok: true } } };
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  push.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

async function montar() {
  render(<VerificarForm email="maria@corredora.cl" />);
  await screen.findByText("ma***@corredora.cl");
}

function confirmarCon(respuesta: Respuesta, codigo = "123456") {
  respuestas["/api/auth/dispositivo/confirmar"] = respuesta;
  fireEvent.change(screen.getByLabelText("Código de verificación"), { target: { value: codigo } });
  fireEvent.click(screen.getByRole("button", { name: /^verificar$/i }));
}

describe("enmascararCorreo", () => {
  it("deja las dos primeras letras y el dominio", () => {
    expect(enmascararCorreo("maria@corredora.cl")).toBe("ma***@corredora.cl");
  });
});

describe("VerificarForm", () => {
  it("envía el código al entrar, una sola vez, y el reenvío espera lo mismo que el servidor", async () => {
    await montar();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ESPERA_REENVIO_S).toBe(60);
    expect(screen.getByRole("button", { name: /podrás pedir otro en 01:00/i })).toBeDisabled();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("solo deja verificar con los 6 dígitos y descarta lo que no es número", async () => {
    await montar();
    const input = screen.getByLabelText("Código de verificación") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12a3" } });
    expect(input.value).toBe("123");
    expect(screen.getByRole("button", { name: /^verificar$/i })).toBeDisabled();
  });

  it("un código incorrecto marca el campo y avisa los intentos que quedan", async () => {
    await montar();
    await act(async () => confirmarCon({ status: 400, body: { errorCode: "INCORRECTO", intentosRestantes: 2 } }));
    const input = screen.getByLabelText("Código de verificación");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("Ese código no coincide.");
    expect(screen.getByText("Te quedan 2 intentos")).toBeInTheDocument();
  });

  it("sin intentos oculta el campo y ofrece pedir un código nuevo", async () => {
    await montar();
    await act(async () => confirmarCon({ status: 429, body: { errorCode: "AGOTADO" } }));
    expect(screen.queryByLabelText("Código de verificación")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("Se acabaron los intentos");
    expect(screen.getByRole("button", { name: /podrás pedir otro/i })).toBeDisabled();
  });

  it("el código correcto lleva al panel", async () => {
    await montar();
    await act(async () => confirmarCon({ status: 200, body: { ok: true } }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/panel"));
  });
});
