const clpFmt = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Formatea un valor (number | string | Prisma.Decimal) como CLP. */
export function clp(value: number | string | { toString(): string }): string {
  return clpFmt.format(Number(value.toString()));
}

/** Número entero plano (Number) desde Decimal/string. */
export function num(value: number | string | { toString(): string }): number {
  return Number(value.toString());
}

export function fecha(d: Date | string): string {
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

export const UF_LABEL = "UF";

/**
 * Formatea un precio de publicación en UF o CLP.
 * Devuelve "Consultar precio" si no hay valor.
 */
export function clpOrUf(valor: number | string | null, denom: string | null): string {
  if (!valor) return "Consultar precio";
  const n = Number(valor);
  if (denom === "UF") {
    return `UF ${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });
}

/**
 * Devuelve el sustantivo en singular o plural según la cantidad.
 * Ej: `${n} ${plural(n, "pieza")}` → "1 pieza" / "3 piezas".
 * Para plurales irregulares, pasar el tercer argumento.
 */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? singular : (pluralForm ?? `${singular}s`);
}

/**
 * Cantidad + sustantivo ya concordado: cantidad(1, "día") → "1 día".
 *
 * Existe para erradicar el "día(s)" de la interfaz. La RAE admite ese
 * paréntesis en formularios administrativos, donde quien redacta no conoce la
 * cantidad; en una UI esa condición no se cumple —el sistema sí la conoce— y
 * escribir "1 día(s)" solo delata que nadie resolvió la concordancia.
 * Ver Docs/referencias/guia-de-estilo-editorial.md §4.
 *
 * Envuelve a `plural()` en vez de reimplementarlo, para que ambos compartan la
 * misma regla de pluralización y no puedan divergir.
 */
export function cantidad(n: number, singular: string, pluralForm?: string): string {
  return `${n} ${plural(n, singular, pluralForm)}`;
}
