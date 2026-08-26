/**
 * Filtros y términos de búsqueda escritos por usuarios.
 *
 * Prisma entrega el texto de `contains` al LIKE de Postgres tal cual, sin
 * escapar. Eso significa que un `%` escrito por el usuario deja de ser un
 * carácter y pasa a ser un comodín: en el buscador público del marketplace,
 * `?q=%` devuelve el catálogo completo, y `?q=_` también. Se comprobó contra el
 * servidor, no es teórico.
 *
 * Aparte del resultado equivocado, un término largo lleno de comodines obliga a
 * Postgres a recorrer la tabla entera sin poder apoyarse en un índice. En una
 * ruta pública y sin sesión eso es una forma barata de hacer trabajar a la base.
 */

/**
 * Tope de largo de un término. Ochenta caracteres pasan cualquier dirección
 * chilena y dejan fuera los patrones armados para hacer trabajar al motor.
 */
export const MAX_TERMINO = 80;

/**
 * Deja un término listo para `contains`: recorta, limita el largo y neutraliza
 * los comodines de LIKE.
 *
 * Devuelve `null` cuando no queda nada que buscar, para que quien llama omita
 * el filtro en lugar de buscar la cadena vacía.
 */
export function terminoBusqueda(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").trim().slice(0, MAX_TERMINO);
  if (!limpio) return null;

  // La barra invertida va primero: si se escapara después, duplicaría las que
  // agregan las dos líneas siguientes.
  return limpio
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/*
 * Los filtros del marketplace llegan por query string, así que cualquiera
 * escribe lo que quiera en ellos. Un `?precioMin=abc` terminaba en Prisma como
 * NaN y tumbaba la página con un 500 — y el marketplace es público, no hay
 * sesión que lo contenga. Los validadores de acá abajo convierten "basura" en
 * "filtro ausente", que es lo que un usuario esperaría de un enlace roto.
 */

/** Un decimal dentro de un rango. Devuelve null si no es un número usable. */
export function numeroFiltro(
  valor: string | null | undefined,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number | null {
  if (valor === undefined || valor === null || valor.trim() === "") return null;
  const n = Number(valor);
  // Number() acepta "NaN", "Infinity" y "1e400"; ninguno sirve como filtro.
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/** Un entero dentro de un rango. Rechaza decimales y notación científica. */
export function enteroFiltro(
  valor: string | null | undefined,
  opciones: { min?: number; max?: number } = {},
): number | null {
  const n = numeroFiltro(valor, opciones);
  if (n === null || !Number.isInteger(n)) return null;
  return n;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Un identificador que va a una columna uuid. Postgres rechaza cualquier otra
 * cosa con un error, así que se filtra antes de llegar a la consulta.
 */
export function idFiltro(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim();
  return RE_UUID.test(v) ? v : null;
}

/**
 * Un valor que debe pertenecer a una lista cerrada, como un enum de Prisma.
 * Sin esto, un `as` sobre texto del usuario es una promesa que el compilador
 * cree y la base no.
 */
export function opcionFiltro<T extends string>(
  valor: string | null | undefined,
  permitidas: readonly T[],
): T | null {
  const v = (valor ?? "").trim();
  return (permitidas as readonly string[]).includes(v) ? (v as T) : null;
}
