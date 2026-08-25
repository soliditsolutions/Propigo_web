/**
 * Alertas personalizadas — dominio.
 *
 * El administrador de la corredora define una alerta una vez y queda
 * disponible para que cualquier corredor de la cuenta la use. El cuerpo admite
 * marcadores `{{nombre}}` que se reemplazan con datos del contrato al enviar.
 *
 * Este módulo es puro: no toca la base ni la sesión, así que se puede probar
 * sin mockear Prisma.
 */

import { clp, fecha } from "./format";

/** Marcadores disponibles, con la etiqueta que ve el corredor al escribir. */
export const MARCADORES = [
  { clave: "arrendatario", ayuda: "Nombre del arrendatario" },
  { clave: "propietario",  ayuda: "Nombre del propietario" },
  { clave: "direccion",    ayuda: "Dirección de la propiedad" },
  { clave: "monto",        ayuda: "Monto del arriendo" },
  { clave: "vencimiento",  ayuda: "Fecha de vencimiento del período" },
  { clave: "corredora",    ayuda: "Nombre de tu corredora" },
] as const;

export type ClaveMarcador = (typeof MARCADORES)[number]["clave"];

export type DatosAlerta = Partial<Record<ClaveMarcador, string | number | Date | null>>;

/** Formatea el valor de un marcador según su naturaleza, no según su tipo. */
function formatearValor(clave: ClaveMarcador, valor: string | number | Date | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "";
  // Un valor que no calza con la naturaleza del marcador se trata como
  // ausente. Preferimos un hueco antes que mandarle "$NaN" o "Invalid Date"
  // a un arrendatario: el hueco se lee como omisión; lo otro, como sistema roto.
  if (clave === "monto") {
    // Un contrato puede estar denominado en UF o en CLP, así que el monto lo
    // formatea quien conoce esa denominación (con clpOrUf) y llega acá como
    // string ya listo. El camino numérico queda como respaldo: formatear 10 UF
    // como "$10" fue un error real detectado en pruebas.
    if (typeof valor === "string") return valor;
    const n = Number(valor);
    return Number.isFinite(n) ? clp(n) : "";
  }
  if (clave === "vencimiento") {
    const d = valor instanceof Date ? valor : new Date(String(valor));
    return Number.isNaN(d.getTime()) ? "" : fecha(d);
  }
  return String(valor);
}

/**
 * Reemplaza los marcadores del cuerpo por sus valores.
 *
 * Un marcador sin dato se reemplaza por vacío en vez de quedar como
 * `{{monto}}` a la vista del arrendatario: un hueco se lee como omisión, pero
 * una llave suelta se lee como sistema roto. Un marcador desconocido se deja
 * intacto — es un error de quien escribió la plantilla, y borrarlo en silencio
 * le escondería el problema.
 */
export function renderizarAlerta(texto: string, datos: DatosAlerta): string {
  return texto.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (original, clave: string) => {
    const conocido = MARCADORES.some((m) => m.clave === clave);
    if (!conocido) return original;
    return formatearValor(clave as ClaveMarcador, datos[clave as ClaveMarcador]);
  });
}

/** Marcadores usados en un texto que NO existen — para avisar al escribir. */
export function marcadoresDesconocidos(texto: string): string[] {
  const usados = [...texto.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(usados.filter((u) => !MARCADORES.some((m) => m.clave === u)))];
}

export const LIMITES = {
  nombre: 60,
  asunto: 120,
  /** El cuerpo va dentro de un correo; más que esto deja de ser un aviso. */
  cuerpo: 1000,
  /** Un disparador más lejano que esto no se ancla a nada útil. */
  diasOffsetMax: 90,
} as const;

export type EntradaAlerta = {
  nombre: string;
  asunto: string;
  cuerpo: string;
  destinatario: "arrendatario" | "propietario";
  disparador: "antes_de_vencimiento" | "dias_de_mora" | null;
  diasOffset: number | null;
};

/**
 * Valida una alerta antes de guardarla. Devuelve el primer error en el idioma
 * del corredor, o null si está correcta.
 *
 * La regla que importa: disparador y diasOffset van juntos o no van. Una alerta
 * automática sin offset no sabría cuándo dispararse, y un offset sin disparador
 * es un número que no hace nada — ambos casos producen una alerta que el
 * corredor cree activa y nunca se emite.
 */
export function validarAlerta(e: EntradaAlerta): string | null {
  if (!e.nombre.trim())  return "Ponle un nombre a la alerta para reconocerla después.";
  if (e.nombre.length  > LIMITES.nombre)  return `El nombre no puede pasar de ${LIMITES.nombre} caracteres.`;
  if (!e.asunto.trim())  return "El asunto es obligatorio: es lo primero que ve quien recibe el correo.";
  if (e.asunto.length  > LIMITES.asunto)  return `El asunto no puede pasar de ${LIMITES.asunto} caracteres.`;
  if (!e.cuerpo.trim())  return "Escribe el mensaje que quieres enviar.";
  if (e.cuerpo.length  > LIMITES.cuerpo)  return `El mensaje no puede pasar de ${LIMITES.cuerpo} caracteres.`;

  if (!["arrendatario", "propietario"].includes(e.destinatario))
    return "Elige si la alerta va al arrendatario o al propietario.";

  const desconocidos = marcadoresDesconocidos(`${e.asunto} ${e.cuerpo}`);
  if (desconocidos.length > 0)
    return `Estos datos no existen: ${desconocidos.map((d) => `{{${d}}}`).join(", ")}. Revisa la lista de disponibles.`;

  if (e.disparador && (e.diasOffset === null || !Number.isInteger(e.diasOffset)))
    return "Una alerta automática necesita a los cuántos días se envía.";
  if (!e.disparador && e.diasOffset !== null)
    return "Indicaste una cantidad de días pero no cuándo debe dispararse la alerta.";
  if (e.diasOffset !== null && (e.diasOffset < 0 || e.diasOffset > LIMITES.diasOffsetMax))
    return `Los días deben estar entre 0 y ${LIMITES.diasOffsetMax}.`;

  return null;
}
