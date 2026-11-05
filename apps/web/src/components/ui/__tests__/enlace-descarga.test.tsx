// @vitest-environment jsdom
/**
 * Descargas que avisan si fallan: el error del servidor aparece en un toast
 * (no como JSON crudo en una página en blanco) y el archivo se guarda con el
 * nombre que da el servidor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { EnlaceDescarga } from "../enlace-descarga";
import { ToastProvider } from "../toast";
import { nombreDeDisposicion } from "@/lib/descarga";

const fetchMock = vi.fn();
let clicDescarga: { download: string; href: string } | null;

beforeEach(() => {
  fetchMock.mockReset();
  clicDescarga = null;
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicDescarga = { download: this.download, href: this.getAttribute("href") ?? "" };
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

function montar(login?: "/login" | "/portal") {
  render(
    <ToastProvider>
      <EnlaceDescarga href="/api/panel/vouchers/v1/pdf" login={login} icono={<span data-testid="icono" />}>PDF</EnlaceDescarga>
    </ToastProvider>,
  );
  return screen.getByRole("link", { name: /PDF/ });
}

describe("EnlaceDescarga", () => {
  it("con éxito guarda el archivo con el nombre del servidor", async () => {
    fetchMock.mockResolvedValue(new Response(new Blob(["%PDF"]), {
      status: 200,
      headers: { "content-disposition": "attachment; filename*=UTF-8''comprobante-%C3%B1and%C3%BA.pdf" },
    }));
    fireEvent.click(montar());
    await waitFor(() => expect(clicDescarga).toEqual({ download: "comprobante-ñandú.pdf", href: "blob:x" }));
  });

  it("sesión expirada: avisa con un acceso para iniciar sesión, sin salir de la página", async () => {
    fetchMock.mockResolvedValue(json(401, { error: "No autorizado." }));
    fireEvent.click(montar("/portal"));
    expect(await screen.findByText(/Tu sesión expiró/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute("href", "/portal");
    expect(clicDescarga).toBeNull();
  });

  it("muestra el motivo exacto que da el servidor", async () => {
    fetchMock.mockResolvedValue(json(409, { error: "Este comprobante es anterior al formato PDF y no puede regenerarse." }));
    fireEvent.click(montar());
    expect(await screen.findByText("Este comprobante es anterior al formato PDF y no puede regenerarse.")).toBeInTheDocument();
  });

  it("un fallo sin JSON (502 del proxy) se dice como problema nuestro", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    fireEvent.click(montar());
    expect(await screen.findByText(/problema de nuestro lado/)).toBeInTheDocument();
  });

  it("sin red avisa de la conexión", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    fireEvent.click(montar());
    expect(await screen.findByText(/Sin conexión/)).toBeInTheDocument();
  });

  it("Ctrl+clic se deja al navegador (abre la descarga en otra pestaña)", () => {
    fireEvent.click(montar(), { ctrlKey: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mientras prepara el archivo, cambia solo el ícono y avisa a lectores de pantalla", async () => {
    let resolver!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>((r) => { resolver = r; }));
    const enlace = montar();
    fireEvent.click(enlace);
    await waitFor(() => expect(enlace).toHaveAttribute("aria-busy", "true"));
    expect(screen.queryByTestId("icono")).toBeNull();
    expect(screen.getByText("Preparando la descarga…")).toBeInTheDocument();
    fireEvent.click(enlace); // doble clic no lanza otra descarga
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolver(json(404, { error: "Comprobante no encontrado." }));
    expect(await screen.findByText("Comprobante no encontrado.")).toBeInTheDocument();
  });
});

describe("nombreDeDisposicion", () => {
  it("prefiere filename* y decodifica UTF-8", () => {
    expect(nombreDeDisposicion(`attachment; filename="a.pdf"; filename*=UTF-8''b%20%C3%A1.pdf`)).toBe("b á.pdf");
  });
  it("acepta filename con y sin comillas", () => {
    expect(nombreDeDisposicion(`attachment; filename="proyecciones-2026-11-05.csv"`)).toBe("proyecciones-2026-11-05.csv");
    expect(nombreDeDisposicion(`attachment; filename=datos.json`)).toBe("datos.json");
  });
  it("descarta rutas y nombres vacíos", () => {
    expect(nombreDeDisposicion(`attachment; filename="../../etc/passwd"`)).toBe("passwd");
    expect(nombreDeDisposicion(`attachment; filename=".."`)).toBeNull();
    expect(nombreDeDisposicion(null)).toBeNull();
    expect(nombreDeDisposicion("attachment")).toBeNull();
  });
  it("codificación rota: cae al nombre simple", () => {
    expect(nombreDeDisposicion(`attachment; filename*=UTF-8''%E0%A4%A; filename="ok.pdf"`)).toBe("ok.pdf");
  });
});
