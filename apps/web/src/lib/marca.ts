/**
 * Identidad de la plataforma en un solo lugar: nombre comercial, eslogan,
 * dominio y correos. SOLID IT SpA es la empresa responsable (razón social en
 * los documentos legales), no la marca: no aparece en el logo ni en títulos.
 */
export const MARCA = "Propigo";
export const ESLOGAN = "Publica más. Complica menos.";
export const RAZON_SOCIAL = "SOLID IT SpA";
export const DOMINIO = "propigo.cl";

/**
 * Colores de marca para contextos que no leen variables CSS: PDFs, correos
 * HTML, Leaflet. Son la misma escala que --brand-* de globals.css.
 */
export const COLOR = {
  azul:       "#1E6FE8",
  azulClaro:  "#2E9BFF",
  azulOscuro: "#1449B0",
  azulSuave:  "#EAF2FF",
  marino:     "#0F1B3D",
  cian:       "#19C2E0",
  ambar:      "#FFB020",
  texto:      "#0F1B3D",
  textoSuave: "#5B6782",
  borde:      "#DCE5F2",
  fondo:      "#F5F8FD",
} as const;

export const CORREO = {
  noReply:        `no-reply@${DOMINIO}`,
  notificaciones: `notificaciones@${DOMINIO}`,
  soporte:        `soporte@${DOMINIO}`,
  denuncias:      `denuncias@${DOMINIO}`,
  legal:          `legal@${DOMINIO}`,
  privacidad:     `privacidad@${DOMINIO}`,
  tecnologia:     `tecnologia@${DOMINIO}`,
} as const;

/**
 * Datos de SOLID IT SpA que muestran los términos y la política de privacidad.
 * RUT y teléfono reales (tarea E-03, 2026-11-12). Los valores de relleno de
 * abajo siguen vigilados: en producción el servidor NO arranca si alguien los
 * vuelve a poner (startup-check). El domicilio es el de la escritura de
 * constitución (art. segundo): la comuna, no una calle.
 */
export const EMPRESA = {
  rut:       "78.395.184-3",
  telefono:  "+56 9 5776 3289",
  domicilio: "comuna de La Florida, Región Metropolitana de Santiago, Chile",
};

const RUT_DE_RELLENO = "77.000.000-0";
const TELEFONO_DE_RELLENO = "+56 2 0000 0000";

/** Qué datos de la empresa siguen siendo de relleno (vacío si ya están todos reales). */
export function datosDeRelleno(e: { rut: string; telefono: string }): string[] {
  return [
    e.rut === RUT_DE_RELLENO && "RUT",
    e.telefono === TELEFONO_DE_RELLENO && "teléfono",
  ].filter((x): x is string => !!x);
}

/** Remitente con nombre visible, formato "Nombre <correo>". */
export const remitente = (correo: string) => `${MARCA} <${correo}>`;

/** Título de pestaña: "Sección — Propigo". */
export const titulo = (seccion: string) => `${seccion} — ${MARCA}`;
