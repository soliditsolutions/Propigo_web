// @vitest-environment jsdom
/**
 * Errores del portal en un solo canal (M-23): el mensaje queda bajo el campo,
 * sin toast duplicado, y el último fallo deja solo el panel de intentos
 * agotados, sin avisos anteriores a la vista.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter:       () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("id=7d1f6e2a-1b2c-4d3e-8f90-123456789abc"),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/public/Logo", () => ({ Logo: () => <span>Logo</span> }));

import VerificarPage from "../page";

const fetchMock = vi.fn();

function respuesta(body: unknown, status = 400) {
  return { ok: status < 400, status, json: async () => body } as Response;
}

async function enviar(codigo = "123456") {
  fireEvent.change(screen.getByLabelText("Código de 6 dígitos"), { target: { value: codigo } });
  fireEvent.click(screen.getByRole("button", { name: "Verificar código" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("Portal · verificar código", () => {
  it("el error se muestra una sola vez, bajo el campo", async () => {
    fetchMock.mockResolvedValue(respuesta({ ok: false, errorCode: "INCORRECTO", intentosRestantes: 2, error: "Código incorrecto. Te quedan 2 intentos." }));
    render(<VerificarPage />);
    await enviar();
    await waitFor(() => expect(screen.getAllByText("Código incorrecto. Te quedan 2 intentos.")).toHaveLength(1));
    expect(screen.getByText("Código incorrecto. Te quedan 2 intentos.")).toHaveAttribute("role", "alert");
  });

  it("al agotar, no quedan a la vista los avisos de intentos anteriores", async () => {
    fetchMock
      .mockResolvedValueOnce(respuesta({ ok: false, errorCode: "INCORRECTO", intentosRestantes: 1, error: "Código incorrecto. Te queda 1 intento." }))
      .mockResolvedValueOnce(respuesta({ ok: false, errorCode: "AGOTADO", intentosRestantes: 0, error: "Has agotado los intentos. Solicita un nuevo código." }));
    render(<VerificarPage />);
    await enviar();
    await screen.findByText("Código incorrecto. Te queda 1 intento.");
    await enviar();
    await screen.findByText(/Intentos agotados/);
    expect(screen.queryByText(/Te queda/)).toBeNull();
    expect(screen.getByRole("link", { name: /Solicitar nuevo código/ })).toHaveAttribute("href", "/portal");
  });

  it("si el servidor responde sin JSON, lo dice: no culpa a la conexión", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError("x"); } } as unknown as Response);
    render(<VerificarPage />);
    await enviar();
    expect(await screen.findByRole("alert")).toHaveTextContent("problema de nuestro lado");
  });

  it("sin red, avisa del problema de conexión", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<VerificarPage />);
    await enviar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Error de conexión");
  });
});
