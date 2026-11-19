// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { StaticImageData } from "next/image";
import { FotoPorPantalla } from "../ScrollWalkthrough";

const foto: StaticImageData = { src: "/_next/static/media/entrada.jpg", width: 768, height: 906 };

describe("FotoPorPantalla", () => {
  it("fuera de su media no hay fuente: solo el GIF de 1×1, así no se descarga", () => {
    const { container } = render(<FotoPorPantalla src={foto} media="(max-width: 1023.98px)" sizes="100vw" />);
    const source = container.querySelector("picture > source")!;
    expect(source.getAttribute("media")).toBe("(max-width: 1023.98px)");
    expect(source.getAttribute("srcset")).toContain("entrada.jpg");
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toMatch(/^data:image\/gif/);
    expect(img.getAttribute("srcset")).toBeNull();
    expect(img.getAttribute("alt")).toBe("");
  });

  it("la de la primera parada carga temprano con prioridad alta; las demás, diferidas", () => {
    const prioritaria = render(<FotoPorPantalla src={foto} media="(min-width: 1024px)" sizes="100vw" prioridad />).container.querySelector("img")!;
    expect(prioritaria.getAttribute("fetchpriority")).toBe("high");
    expect(prioritaria.getAttribute("loading")).toBe("eager");
    const diferida = render(<FotoPorPantalla src={foto} media="(min-width: 1024px)" sizes="768px" />).container.querySelector("img")!;
    expect(diferida.getAttribute("loading")).toBe("lazy");
    expect(diferida.getAttribute("fetchpriority")).toBeNull();
  });

  it("aplica el encuadre pedido", () => {
    const img = render(<FotoPorPantalla src={foto} media="(max-width: 1023.98px)" sizes="100vw" posicion="50% 75%" />).container.querySelector("img")!;
    expect(img.style.objectPosition).toBe("50% 75%");
  });
});
