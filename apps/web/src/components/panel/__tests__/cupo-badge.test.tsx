// @vitest-environment jsdom
/**
 * Tests: CupoBadge — el indicador de consumo de cupo (P-B0.5 del rowMap).
 *
 * Lo que importa acá no es el markup sino los umbrales: el badge existe para
 * avisar ANTES de la pared, así que el estado ámbar tiene que aparecer a
 * tiempo y el rojo exactamente al llegar al tope, ni antes ni después.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import { CupoBadge } from "../ui";

/** El color de fondo es lo que distingue los tres estados. */
function fondoDe(usado: number, max: number): string {
  const { container } = render(<CupoBadge usado={usado} max={max} unidad="propiedades" />);
  return (container.firstChild as HTMLElement).style.background;
}

const NORMAL = "var(--pgo-surface-2)";
const CERCA  = "var(--pgo-warning-lt)";
const LLENO  = "var(--pgo-danger-lt)";

describe("CupoBadge", () => {
  it("muestra el consumo y el plan cuando se le pasa", () => {
    render(<CupoBadge usado={18} max={25} unidad="propiedades" planLabel="Silver" />);
    expect(screen.getByText(/18 \/ 25/)).toBeTruthy();
    expect(screen.getByText(/plan Silver/)).toBeTruthy();
  });

  it("omite el plan cuando no se pasa", () => {
    render(<CupoBadge usado={7} max={10} unidad="revisiones con IA hoy" />);
    expect(screen.queryByText(/plan/)).toBeNull();
  });

  it("está neutro mientras queda holgura", () => {
    expect(fondoDe(0, 25)).toBe(NORMAL);
    expect(fondoDe(19, 25)).toBe(NORMAL);  // 76 %
  });

  it("avisa en ámbar desde el 80 % — antes de la pared, que es el punto", () => {
    expect(fondoDe(20, 25)).toBe(CERCA);   // 80 % exacto
    expect(fondoDe(24, 25)).toBe(CERCA);
    expect(fondoDe(8, 10)).toBe(CERCA);
  });

  it("pasa a rojo justo al llegar al tope", () => {
    expect(fondoDe(25, 25)).toBe(LLENO);
    expect(fondoDe(3, 3)).toBe(LLENO);
  });

  it("sigue en rojo por sobre el tope (downgrade que dejó al tenant excedido)", () => {
    expect(fondoDe(40, 25)).toBe(LLENO);
  });

  it("con max 0 no pinta ámbar por una división inválida", () => {
    // 0/0 sería NaN y >= 0.8 daría false, pero usado>=max ya lo marca lleno:
    // lo que se verifica es que no quede en un estado intermedio absurdo.
    expect(fondoDe(0, 0)).toBe(LLENO);
  });
});
