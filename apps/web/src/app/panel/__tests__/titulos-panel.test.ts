/**
 * Cada pantalla del panel tiene título de documento propio (WCAG 2.4.2: sin él,
 * todas las pestañas decían el eslogan) y sus títulos visibles usan mayúscula
 * solo inicial, sin punto final (PRODUCT.md § «Estructura de textos»).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PANEL = join(__dirname, "..");

function paginas(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return n === "__tests__" ? [] : paginas(ruta);
    return n === "page.tsx" ? [ruta] : [];
  });
}

// Siglas y nombres propios que sí van en mayúscula dentro de un título.
const PERMITIDAS = /^(UF|IPC|CLP|RUT|IVA|PDF|CSV|Propigo)$/;

describe("títulos del panel", () => {
  const lista = paginas(PANEL);

  it("encuentra las pantallas", () => {
    expect(lista.length).toBeGreaterThan(8);
  });

  for (const archivo of lista) {
    const nombre = relative(PANEL, archivo);
    const fuente = readFileSync(archivo, "utf8");

    it(`${nombre}: declara título de documento`, () => {
      expect(fuente).toMatch(/export const metadata\b|export async function generateMetadata\b/);
    });

    it(`${nombre}: título visible sin mayúsculas de título ni punto final`, () => {
      for (const [, titulo] of fuente.matchAll(/<PageTitle[\s\S]*?\btitle="([^"]+)"/g)) {
        expect(titulo).not.toMatch(/\.$/);
        const conMayuscula = titulo.split(" ").slice(1).filter((p) => /^[A-ZÁÉÍÓÚÑ]/.test(p) && !PERMITIDAS.test(p));
        expect(`${titulo}: ${conMayuscula.join(" ")}`).toBe(`${titulo}: `);
      }
    });
  }
});
