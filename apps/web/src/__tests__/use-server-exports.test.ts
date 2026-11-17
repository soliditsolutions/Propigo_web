/**
 * Un archivo "use server" solo puede exportar funciones asíncronas (y tipos).
 * Una constante exportada pasa las pruebas y el modo desarrollo, pero rompe
 * `next build`: el módulo queda sin exportaciones y la importación falla.
 * Esta prueba lo atrapa antes de llegar a la compilación de producción.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..");

/** Exportaciones de un módulo "use server" que Next no admite. Vacío si el archivo no es "use server". */
export function exportacionesInvalidas(codigo: string): string[] {
  const lineas = codigo.split(/\r?\n/);
  const primera = lineas.find((l) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("/*") && !l.trim().startsWith("*"));
  if (!primera || !/^["']use server["'];?$/.test(primera.trim())) return [];

  return lineas
    .filter((l) => /^export\s/.test(l))
    .filter((l) => !/^export\s+(type|interface)\b/.test(l))
    .filter((l) => !/^export\s+async\s+function\b/.test(l))
    .filter((l) => !/^export\s+(const|let|var)\s+\w+\s*(:[^=]+)?=\s*async\b/.test(l))
    .filter((l) => !/^export\s+\{[^}]*\}\s*from/.test(l) && !/^export\s+type\s*\{/.test(l))
    .map((l) => l.trim());
}

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (nombre === "node_modules" || nombre === "generated" || nombre === "__tests__") return [];
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

describe('módulos "use server"', () => {
  it("detecta una constante exportada, una función síncrona y una clase", () => {
    const malo = `"use server";\n\nexport const PALABRA = "X";\nexport function sincrona() {}\nexport class A {}\nexport async function ok() {}\nexport type T = string;\n`;
    expect(exportacionesInvalidas(malo)).toEqual([
      'export const PALABRA = "X";',
      "export function sincrona() {}",
      "export class A {}",
    ]);
  });

  it("acepta funciones asíncronas, flechas asíncronas y tipos", () => {
    const bueno = `// nota\n"use server";\nexport async function a() {}\nexport const b = async () => {};\nexport type R = { ok: boolean };\nexport interface I {}\n`;
    expect(exportacionesInvalidas(bueno)).toEqual([]);
  });

  it('ignora los archivos que no son "use server"', () => {
    expect(exportacionesInvalidas(`export const X = 1;\n`)).toEqual([]);
  });

  it('ningún archivo "use server" del proyecto exporta algo que Next no admite', () => {
    const problemas = archivos(RAIZ)
      .map((ruta) => ({ ruta, malas: exportacionesInvalidas(readFileSync(ruta, "utf8")) }))
      .filter((x) => x.malas.length > 0)
      .map((x) => `${x.ruta.replace(RAIZ, "src")}: ${x.malas.join(" | ")}`);
    expect(problemas).toEqual([]);
  });
});
