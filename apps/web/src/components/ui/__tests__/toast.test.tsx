// @vitest-environment jsdom
/**
 * Tests: toasts — tiempo por tipo, pausa con mouse/foco, sin duplicados y
 * avisos con acción que no se cierran solos (M-04 / M-11 / M-23 de la
 * auditoría de mensajes 2026-11).
 */
import { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast, DURACION_MS, type ToastType, type ToastOpciones } from "@/components/ui/toast";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

let mostrar: (m: string, t?: ToastType, o?: ToastOpciones) => void;
function Captura() {
  const { show } = useToast();
  useEffect(() => {
    mostrar = show;
  }, [show]);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  render(<ToastProvider><Captura /></ToastProvider>);
});
afterEach(() => vi.useRealTimers());

const avance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe("toasts", () => {
  it("un error dura más que un éxito", () => {
    expect(DURACION_MS.error).toBeGreaterThan(DURACION_MS.success);
    act(() => { mostrar("Guardado", "success"); mostrar("Falló", "error"); });
    avance(DURACION_MS.success + 10);
    expect(screen.queryByText("Guardado")).toBeNull();
    expect(screen.getByText("Falló")).toBeTruthy();
    avance(DURACION_MS.error);
    expect(screen.queryByText("Falló")).toBeNull();
  });

  it("un toast nuevo no reinicia el tiempo de los anteriores", () => {
    act(() => mostrar("Primero", "info"));
    avance(DURACION_MS.info - 1000);
    act(() => mostrar("Segundo", "info"));
    avance(1010);
    expect(screen.queryByText("Primero")).toBeNull();
    expect(screen.getByText("Segundo")).toBeTruthy();
  });

  it("se pausa con el mouse encima y retoma el tiempo restante al salir", () => {
    act(() => mostrar("Pausable", "info"));
    avance(3000);
    const tarjeta = screen.getByRole("status");
    fireEvent.mouseEnter(tarjeta);
    avance(60_000);
    expect(screen.getByText("Pausable")).toBeTruthy();
    fireEvent.mouseLeave(tarjeta);
    avance(DURACION_MS.info - 3000 - 50);
    expect(screen.getByText("Pausable")).toBeTruthy();
    avance(100);
    expect(screen.queryByText("Pausable")).toBeNull();
  });

  it("se pausa mientras el foco está dentro (teclado)", () => {
    act(() => mostrar("Con foco", "error"));
    fireEvent.focus(screen.getByRole("button", { name: "Cerrar notificación" }));
    avance(DURACION_MS.error * 3);
    expect(screen.getByText("Con foco")).toBeTruthy();
  });

  it("el mismo aviso repetido no se apila", () => {
    act(() => { mostrar("Código incorrecto", "error"); mostrar("Código incorrecto", "error"); mostrar("Código incorrecto", "error"); });
    expect(screen.getAllByText("Código incorrecto")).toHaveLength(1);
  });

  it("un aviso con acción no se cierra solo y muestra el enlace", () => {
    act(() => mostrar("Tu sesión expiró.", "error", { accion: { texto: "Iniciar sesión", href: "/login" } }));
    avance(DURACION_MS.error * 10);
    expect(screen.getByText("Tu sesión expiró.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/login");
  });

  it("el botón de cerrar lo quita", () => {
    act(() => mostrar("Cerrable", "warning"));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.queryByText("Cerrable")).toBeNull();
  });

  it("los errores se anuncian como alerta y el resto como estado", () => {
    act(() => { mostrar("Error X", "error"); mostrar("Info Y", "info"); });
    expect(screen.getByRole("alert").textContent).toContain("Error X");
    expect(screen.getByRole("status").textContent).toContain("Info Y");
  });
});
