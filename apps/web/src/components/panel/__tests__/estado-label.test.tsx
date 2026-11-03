// @vitest-environment jsdom
/**
 * Tests: estadoLabel + Badge — el texto que ve el corredor en cada estado.
 *
 * Badge dejó de aplicar CSS `capitalize` (mayusculaba cada palabra: "Término
 * Anticipado", "Riesgo Bajo"), así que la capitalización queda a cargo de
 * estadoLabel. Estos tests fijan que el texto llegue escrito como en español.
 */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import React from "react";
import { Badge, estadoLabel } from "../ui";

describe("estadoLabel", () => {
  it("pone mayúscula solo a la primera letra de un estado simple", () => {
    expect(estadoLabel("disponible")).toBe("Disponible");
    expect(estadoLabel("arrendada")).toBe("Arrendada");
  });

  it("traduce los estados compuestos sin guiones bajos", () => {
    expect(estadoLabel("terminado_anticipado")).toBe("Término anticipado");
    expect(estadoLabel("en_revision")).toBe("En revisión");
  });

  it("no rompe con un estado vacío", () => {
    expect(estadoLabel("")).toBe("");
  });
});

describe("Badge", () => {
  it("no transforma el texto: una frase conserva sus minúsculas", () => {
    const { container } = render(<Badge tone="amber">Riesgo bajo</Badge>);
    const span = container.firstChild as HTMLElement;
    expect(span.textContent).toBe("Riesgo bajo");
    expect(span.className).not.toMatch(/\b(capitalize|uppercase)\b/);
  });
});
