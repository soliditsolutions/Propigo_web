// @vitest-environment jsdom
/**
 * Portal · pedir código (M-09): un 429 muestra el plazo que da el servidor en
 * vez de "intenta nuevamente", y un fallo nuestro no se presenta como de red.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/public/Logo", () => ({ Logo: () => <span>Logo</span> }));
vi.mock("@/components/public/TerminosAviso", () => ({ TerminosAviso: () => null }));
vi.mock("@/images/backgrounds/001_Consulta.png", () => ({ default: { src: "x.png", width: 1, height: 1 } }));

const { default: PortalPage } = await import("../page");
const { ToastProvider } = await import("@/components/ui/toast");

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); push.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); });

function pedir() {
  render(<ToastProvider><PortalPage /></ToastProvider>);
  fireEvent.change(screen.getByPlaceholderText("12.345.678-9"), { target: { value: "16444555-0" } });
  fireEvent.submit(screen.getByPlaceholderText("12.345.678-9").closest("form")!);
}

describe("Portal · pedir código", () => {
  it("un 429 muestra cuánto esperar", async () => {
    fetchMock.mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ ok: false, error: "Hiciste demasiadas solicitudes seguidas. Vuelve a intentarlo en 45 segundos." }),
    });
    pedir();
    expect(await screen.findByText(/Vuelve a intentarlo en 45 segundos/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("un fallo del servidor no culpa a la conexión", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new SyntaxError("html"); } });
    pedir();
    expect(await screen.findByText(/problema de nuestro lado/)).toBeInTheDocument();
  });

  it("con respuesta válida va a verificar", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, otpId: "abc" }) });
    pedir();
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/portal/verificar?id=abc"));
  });
});
