// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { celdaMosaico, FOTOS_MOSAICO, GaleriaPropiedad } from "../GaleriaPropiedad";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- doble de prueba de next/image, no se renderiza en la app
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

const fotos = (n: number) => Array.from({ length: n }, (_, i) => ({ url: `/uploads/propiedades/${i}.jpg` }));

/** Celdas que ocupa cada foto en la grilla de 4×2 (oculta = 0). */
function celdas(total: number): number[] {
  return Array.from({ length: total }, (_, i) => {
    const c = celdaMosaico(i, total);
    if (c.includes("sm:hidden")) return 0;
    const cols = c.includes("sm:col-span-2") ? 2 : 1;
    const filas = c.includes("sm:row-span-2") ? 2 : 1;
    return cols * filas;
  });
}

describe("GaleriaPropiedad", () => {
  it("renderiza todas las fotos, no solo las tres primeras", () => {
    render(<GaleriaPropiedad titulo="Casa en Pucón" imagenes={fotos(7)} />);
    const imgs = screen.getAllByRole("img");
    expect(imgs).toHaveLength(7);
    expect(imgs[6].getAttribute("alt")).toBe("Casa en Pucón, foto 7 de 7");
  });

  it("el mosaico queda lleno (8 celdas) con 2 a 5 fotos y oculta las que sobran", () => {
    for (let n = 2; n <= 8; n++) {
      const c = celdas(n);
      expect(c.reduce((a, b) => a + b, 0), `${n} fotos`).toBe(8);
      expect(c.filter((x) => x > 0).length).toBe(Math.min(n, FOTOS_MOSAICO));
    }
  });

  it("con más fotos que el mosaico ofrece verlas todas; con pocas no", () => {
    const { unmount } = render(<GaleriaPropiedad titulo="Casa" imagenes={fotos(FOTOS_MOSAICO + 1)} />);
    expect(screen.getByRole("button", { name: `Ver las ${FOTOS_MOSAICO + 1} fotos` })).toBeTruthy();
    unmount();
    render(<GaleriaPropiedad titulo="Casa" imagenes={fotos(FOTOS_MOSAICO)} />);
    expect(screen.queryByRole("button", { name: /Ver las/ })).toBeNull();
  });

  it("una sola foto: alt sin contador y sin carrusel", () => {
    render(<GaleriaPropiedad titulo="Depto" imagenes={fotos(1)} />);
    expect(screen.getByRole("img").getAttribute("alt")).toBe("Depto");
    expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
  });
});
