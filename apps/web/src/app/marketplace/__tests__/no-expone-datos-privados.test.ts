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
  // El avalúo fiscal es dato del SII sobre el inmueble, igual que el rol: sirve
  // para deducir la carga tributaria del propietario y no tiene por qué estar
  // al alcance de cualquiera que mire una publicación.
  "avaluoFiscal",
  // Cuentas bancarias (de la corredora o de propietarios): el dato más sensible
  // que guarda la plataforma. Nunca en una superficie pública.
  "cuentasBancarias",
  "cuentaBancaria",
  "rutTitular",
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

/**
 * Visibilidad hacia el portal (2026-08-26).
 *
 * El corredor puede marcar una cuenta o un rol como "no compartir". Eso decide
 * lo que ven el propietario y el arrendatario en el portal — y **nada más**.
 * El borrador de contrato tiene que seguir nombrando todas las unidades: un
 * contrato que omite la bodega deja esa bodega sin cubrir, y la visibilidad es
 * una preferencia de la corredora, no un cambio en lo que se arrienda.
 */
describe("visibilidad en el portal", () => {
  const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

  it("el portal filtra por visibleEnPortal", () => {
    const portal = leer(join("portal", "contrato", "[contratoId]", "page.tsx"));
    expect(portal).toMatch(/cuentasServicio:\s*\{\s*where:\s*\{\s*visibleEnPortal:\s*true/);
    expect(portal).toMatch(/rolesComplementarios:\s*\{\s*where:\s*\{\s*visibleEnPortal:\s*true/);
    // Y el rol principal se anula cuando no se comparte, en vez de mostrarse.
    expect(portal).toContain("rolVisibleEnPortal ? p.rol : null");
  });

  it("el borrador de contrato NO filtra: nombra todas las unidades", () => {
    // Si alguien agregara el mismo `where` acá "por consistencia", el contrato
    // dejaría de mencionar la bodega que el corredor decidió no publicar en el
    // portal. Son dos cosas distintas y este test las mantiene separadas.
    const pdf = leer(join("api", "contratos", "[id]", "pdf", "route.ts"));
    expect(pdf).toContain("rolesComplementarios");
    expect(pdf).not.toContain("visibleEnPortal");
  });

  it("el panel NO filtra: el corredor ve sus propios datos completos", () => {
    const queries = readFileSync(join(process.cwd(), "src", "lib", "queries.ts"), "utf8");
    const bloque = queries.slice(queries.indexOf("export async function getPropiedades"));
    const select = bloque.slice(0, bloque.indexOf("_count"));
    expect(select).toContain("cuentasServicio");
    expect(select).not.toContain("where: { visibleEnPortal");
  });
});
