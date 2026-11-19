/**
 * Estructura de textos de las páginas públicas (PRODUCT.md § «Estructura de
 * textos»). Son componentes de servidor con datos de Prisma, así que se revisa
 * la fuente: un solo `main`, ningún `aside` sin nombre accesible, el `h1` entre
 * `<main` y `</main>` y los títulos en mayúscula solo inicial.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV_LINKS } from "@/components/public/PublicNavLinks";

const raiz = join(__dirname, "..");
const PAGINAS = ["page.tsx", "marketplace/page.tsx", "privacidad/page.tsx", "terminos-uso/page.tsx", "registro-tratamiento/page.tsx"];

/** Texto plano del h1 (sin etiquetas JSX ni espacios de más). */
function textoH1(fuente: string): string {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(fuente);
  return (m?.[1] ?? "").replace(/\{"\s*"\}/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

describe("estructura de las páginas públicas", () => {
  for (const archivo of PAGINAS) {
    const fuente = readFileSync(join(raiz, archivo), "utf8");

    it(`${archivo}: un solo main y el h1 dentro de él`, () => {
      expect(fuente.match(/<main[\s>]/g)).toHaveLength(1);
      const h1 = fuente.indexOf("<h1");
      // La portada arma el hero en una constante que se renderiza dentro de main.
      if (archivo !== "page.tsx") {
        expect(h1).toBeGreaterThan(fuente.indexOf("<main"));
        expect(h1).toBeLessThan(fuente.indexOf("</main>"));
      }
    });

    it(`${archivo}: todo aside tiene nombre accesible`, () => {
      for (const aside of fuente.match(/<aside[^>]*>/g) ?? []) expect(aside).toMatch(/aria-label(ledby)?=/);
    });

    it(`${archivo}: h1 sin punto final y sin mayúsculas de título`, () => {
      const h1 = textoH1(fuente);
      expect(h1.length).toBeGreaterThan(0);
      expect(h1).not.toMatch(/\.$/);
      // Después de la primera palabra no hay otra con mayúscula inicial (salvo la ley o siglas).
      const resto = h1.split(" ").slice(1).filter((p) => !/^[A-ZÁÉÍÓÚÑ]{2,}$|^\d/.test(p));
      expect(resto.filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p))).toEqual([]);
    });
  }

  it("los enlaces del menú público usan mayúscula solo inicial", () => {
    for (const { label } of NAV_LINKS) {
      expect(label.split(" ").slice(1).filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p))).toEqual([]);
    }
  });
});
