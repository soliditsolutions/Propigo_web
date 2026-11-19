// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatoReloj, Aviso, Campo } from "../campos";
import { saludoSegunHora, T } from "../textos";
import { Mail } from "lucide-react";
import { luzDesdePuntero } from "../luz";

describe("saludoSegunHora", () => {
  it("cambia en los bordes de la mañana, la tarde y la noche", () => {
    expect(saludoSegunHora(4)).toBe("Buenas noches.");
    expect(saludoSegunHora(5)).toBe("Buenos días.");
    expect(saludoSegunHora(11)).toBe("Buenos días.");
    expect(saludoSegunHora(12)).toBe("Buenas tardes.");
    expect(saludoSegunHora(19)).toBe("Buenas tardes.");
    expect(saludoSegunHora(20)).toBe("Buenas noches.");
    expect(saludoSegunHora(0)).toBe("Buenas noches.");
  });
});

describe("formatoReloj", () => {
  it("da minutos y segundos con dos dígitos", () => {
    expect(formatoReloj(300)).toBe("05:00");
    expect(formatoReloj(61)).toBe("01:01");
    expect(formatoReloj(0)).toBe("00:00");
  });
});

describe("luzDesdePuntero", () => {
  const caja = { left: 100, top: 50, width: 200, height: 100 };

  it("el centro da 50 % y desplazamiento cero", () => {
    expect(luzDesdePuntero(200, 100, caja)).toEqual({ gx: 50, gy: 50, px: 0, py: 0 });
  });

  it("las esquinas dan los extremos y fuera de la caja se acota", () => {
    expect(luzDesdePuntero(100, 50, caja)).toEqual({ gx: 0, gy: 0, px: -1, py: -1 });
    expect(luzDesdePuntero(900, 900, caja)).toEqual({ gx: 100, gy: 100, px: 1, py: 1 });
  });

  it("una caja sin tamaño no divide por cero", () => {
    expect(luzDesdePuntero(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ gx: 50, gy: 50, px: 0, py: 0 });
  });
});

describe("textos de acceso", () => {
  it("las tarjetas flotantes no traen cifras: son funciones, no datos inventados", () => {
    expect(JSON.stringify(T.destellos.login)).not.toMatch(/\$|\d/);
  });

  it("el plan Gratuito sale de PLAN_GRATUITO, no de un texto aparte", () => {
    expect(T.planGratuito.detalle).toBe("1 propiedad · 1 usuario · sin tarjeta");
  });

  it("no usa exclamaciones ni emojis (voz confirmada)", () => {
    const todo = JSON.stringify(T);
    expect(todo).not.toMatch(/[¡!]/);
    expect(todo).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("Campo", () => {
  it("asocia la etiqueta, la ayuda y el error con el input", () => {
    render(<Campo id="c1" etiqueta="Correo" icono={Mail} ayuda="Ayuda" error="Falla" defaultValue="x" />);
    const input = screen.getByLabelText("Correo");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("c1-error");
    expect(screen.getByRole("alert").textContent).toContain("Falla");
  });

  it("sin error muestra la ayuda y no marca el campo como inválido", () => {
    render(<Campo id="c2" etiqueta="Correo" icono={Mail} ayuda="Ayuda útil" />);
    expect(screen.getByLabelText("Correo").getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByText("Ayuda útil")).toBeTruthy();
  });
});

describe("Aviso", () => {
  it("un error se anuncia como alerta y los demás como estado", () => {
    const { rerender } = render(<Aviso variante="error">Mal</Aviso>);
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(<Aviso variante="ok">Bien</Aviso>);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("ruta de vista previa", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("en producción no existe (404)", async () => {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
    vi.doMock("@/app/preview-acceso/preview-acceso", () => ({ PreviewAcceso: () => null }));
    vi.stubEnv("NODE_ENV", "production");
    const { default: Pagina } = await import("@/app/preview-acceso/page");
    await expect(Pagina({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
