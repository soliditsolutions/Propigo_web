// @vitest-environment jsdom
/**
 * Tests: Dispositivos distingue "no hay dispositivos" de "no pudimos saberlo" (M-07).
 *
 * Antes un 401 o un 500 dejaban la lista vacía con "No hay dispositivos
 * registrados": el usuario podía creer que nadie más tenía acceso a su cuenta.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

const { DispositivosSection } = await import("../dispositivos-section");

const DISPOSITIVO = {
  id: "d1", nombre: "Chrome en Windows", ipCreacion: "203.0.113.5",
  lastSeenAt: "2026-11-01T12:00:00Z", createdAt: "2026-10-01T12:00:00Z",
};
const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("navigator", { ...navigator, onLine: true });
  push.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe("DispositivosSection — carga", () => {
  it("lista los dispositivos cuando la API responde", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { dispositivos: [DISPOSITIVO] }));
    render(<DispositivosSection />);
    expect(await screen.findByText("Chrome en Windows")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar el dispositivo Chrome en Windows" })).toBeInTheDocument();
  });

  it("con la lista vacía de verdad dice que no hay dispositivos", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { dispositivos: [] }));
    render(<DispositivosSection />);
    expect(await screen.findByText("No hay dispositivos registrados.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un 500 muestra el error con Reintentar y no dice que no hay dispositivos", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>error</html>", { status: 500 }));
    render(<DispositivosSection />);
    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(/No pudimos cargar tus dispositivos/);
    expect(screen.queryByText("No hay dispositivos registrados.")).not.toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(json(200, { dispositivos: [DISPOSITIVO] }));
    fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
    expect(await screen.findByText("Chrome en Windows")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un 401 pide volver a iniciar sesión, sin Reintentar", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: "No autenticado" }));
    render(<DispositivosSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Tu sesión expiró/);
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: /Reintentar/ })).not.toBeInTheDocument();
  });

  it("sin conexión lo dice y ofrece reintentar", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<DispositivosSection />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/sin conexión/);
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
  });
});

describe("DispositivosSection — eliminar", () => {
  it("un 500 con HTML da un mensaje claro y conserva la lista", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { dispositivos: [DISPOSITIVO] }));
    render(<DispositivosSection />);
    await screen.findByText("Chrome en Windows");

    fetchMock.mockResolvedValueOnce(new Response("<html>error</html>", { status: 500 }));
    fireEvent.click(screen.getByRole("button", { name: /Eliminar el dispositivo/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos eliminar el dispositivo/);
    expect(screen.getByText("Chrome en Windows")).toBeInTheDocument();
  });

  it("un 404 con motivo propio lo muestra tal cual", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { dispositivos: [DISPOSITIVO] }));
    render(<DispositivosSection />);
    await screen.findByText("Chrome en Windows");

    fetchMock.mockResolvedValueOnce(json(404, { error: "Dispositivo no encontrado." }));
    fireEvent.click(screen.getByRole("button", { name: /Eliminar el dispositivo/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dispositivo no encontrado.");
  });

  it("si la API pide volver a ingresar, va al login", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { dispositivos: [DISPOSITIVO] }));
    render(<DispositivosSection />);
    await screen.findByText("Chrome en Windows");

    fetchMock.mockResolvedValueOnce(json(200, { ok: true, relogin: true }));
    fireEvent.click(screen.getByRole("button", { name: /Eliminar el dispositivo/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
