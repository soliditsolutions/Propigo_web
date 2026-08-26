/**
 * El marketplace público NO debe exponer los datos privados de una propiedad.
 *
 * El rol de avalúo identifica el inmueble ante el SII y los números de cuenta
 * identifican a personas. Hoy la protección es que las páginas públicas usan
 * un `select` explícito de campos — es decir, depende de que nadie "complete"
 * ese select por prolijidad. Este test convierte esa disciplina en una regla
 * que falla sola.
 *
 * Se hace leyendo el código fuente y no ejecutando la página porque lo que se
 * quiere fijar es la FORMA de la consulta: si alguien agrega el campo, esto
 * falla en el commit y no en producción.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(process.cwd(), "src", "app");

/** Rutas que sirven contenido a cualquiera, sin sesión. */
const PAGINAS_PUBLICAS = [
  "marketplace/page.tsx",
  "marketplace/[id]/page.tsx",
  "page.tsx",                      // home: destacados
];

/** Campos que jamás deben viajar a una superficie pública. */
const CAMPOS_PROHIBIDOS = [
  "rol:",
  "cuentasServicio",
  "rolesComplementarios",
];

describe("superficies públicas — datos privados de la propiedad", () => {
  it.each(PAGINAS_PUBLICAS)("%s no consulta campos privados", (relativa) => {
    const ruta = join(RAIZ, relativa);
    if (!existsSync(ruta)) {
      throw new Error(
        `No existe ${relativa}. Si la ruta se movió, actualiza esta lista: ` +
        "un test que apunta a un archivo inexistente deja de proteger nada.",
      );
    }

    const fuente = readFileSync(ruta, "utf8");
    for (const campo of CAMPOS_PROHIBIDOS) {
      expect(
        fuente.includes(campo),
        `${relativa} incluye "${campo}". El rol de avalúo y las cuentas de ` +
        "servicios son datos privados: van al panel y al portal de las partes, " +
        "nunca al marketplace.",
      ).toBe(false);
    }
  });

  it("la lista de páginas públicas no quedó vacía por un refactor", () => {
    // Sin esto, borrar las entradas de la lista dejaría el test en verde
    // mientras deja de proteger cualquier cosa.
    expect(PAGINAS_PUBLICAS.length).toBeGreaterThanOrEqual(3);
  });

  it("el portal SÍ los consulta — es el contraste que hace significativo lo anterior", () => {
    // Si esto fallara, o bien el portal dejó de mostrarlos (regresión de
    // producto), o los nombres de campo cambiaron y el test de arriba está
    // buscando algo que ya no existe, con lo cual protege nada.
    const portal = readFileSync(
      join(RAIZ, "portal", "contrato", "[contratoId]", "page.tsx"), "utf8",
    );
    expect(portal).toContain("cuentasServicio");
    expect(portal).toContain("rolesComplementarios");
  });
});
