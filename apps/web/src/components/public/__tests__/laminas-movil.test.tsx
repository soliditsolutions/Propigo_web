// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { StaticImageData } from "next/image";
import { LaminaCalendario, LaminaFachadas, LaminaMapa, LaminaPlano } from "../LaminasMovil";
import { FotoSoloEscritorio } from "../ScrollWalkthrough";

const foto: StaticImageData = { src: "/_next/static/media/puerta.png", width: 1920, height: 1080 };

describe("Láminas de la portada en teléfono", () => {
  it.each([
    ["plano", LaminaPlano],
    ["calendario", LaminaCalendario],
    ["mapa", LaminaMapa],
    ["fachadas", LaminaFachadas],
  ])("%s: SVG con la clase de tokens, trazo que no escala y sin colores fijos", (_, Lamina) => {
    const { container } = render(<Lamina />);
    const svg = container.querySelector("svg")!;
    expect(svg.classList.contains("pgo-lamina")).toBe(true);
    // El color sale de los tokens del tema (globals.css), nunca del SVG.
    expect(container.innerHTML).not.toMatch(/(stroke|fill)="#|rgb\(/);
    const trazos = [...svg.querySelectorAll("path, rect, circle")];
    expect(trazos.length).toBeGreaterThan(0);
    for (const t of trazos) expect((t as SVGElement).style.vectorEffect).toBe("non-scaling-stroke");
  });

  it("el calendario cubre los 12 meses y marca el reajuste", () => {
    const { container } = render(<LaminaCalendario />);
    const textos = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(textos.filter((t) => /^[A-Z]{3}$/.test(t ?? ""))).toHaveLength(12);
    expect(textos).toContain("+ IPC");
  });

  it("solo el plano del hero lleva la animación de entrada", () => {
    expect(render(<LaminaPlano />).container.querySelector(".pgo-lamina--trazo")).not.toBeNull();
    for (const L of [LaminaCalendario, LaminaMapa, LaminaFachadas]) {
      expect(render(<L />).container.querySelector(".pgo-lamina--trazo")).toBeNull();
    }
  });
});

describe("FotoSoloEscritorio", () => {
  it("el teléfono no tiene fuente: solo el GIF de 1×1", () => {
    const { container } = render(<FotoSoloEscritorio src={foto} />);
    const source = container.querySelector("picture > source")!;
    expect(source.getAttribute("media")).toBe("(min-width: 1024px)");
    expect(source.getAttribute("srcset")).toContain("puerta.png");
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(/^data:image\/gif/);
    expect(img.getAttribute("srcset")).toBeNull();
    expect(img.getAttribute("fetchpriority")).toBe("high");
  });

  it("la franja solo trae foto con movimiento reducido y carga diferida", () => {
    const { container } = render(
      <FotoSoloEscritorio src={foto} sizes="768px" media="(min-width: 1024px) and (prefers-reduced-motion: reduce)" />,
    );
    expect(container.querySelector("source")!.getAttribute("media")).toContain("prefers-reduced-motion: reduce");
    expect(container.querySelector("img")!.getAttribute("loading")).toBe("lazy");
  });
});
