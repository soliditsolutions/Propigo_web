/**
 * Utilidades de RUT chileno para la app web.
 *
 * DRY: la validación y el formateo delegan en la fuente única `@propigo/core`
 * (algoritmo mod-11 isomórfico). Aquí solo mantenemos los alias en inglés que
 * ya usan registro/perfil, más `canonicalRut` (forma para BD), que core no expone.
 *
 * Nota: core.validarRut es algo más permisivo que la versión previa (acepta
 * cuerpos de <7 dígitos y hace trim). Para RUTs chilenos reales (7-8 dígitos)
 * el resultado es idéntico.
 */
import { validarRut, formatearRut } from "@propigo/core";

/** Valida el dígito verificador (mod-11). Alias de core.validarRut. */
export const validateRut = validarRut;

/** Formatea a XX.XXX.XXX-Y. Alias de core.formatearRut. */
export const formatRut = formatearRut;

/**
 * Devuelve el RUT en forma canónica para guardar en BD: sin puntos, con guión
 * y DV en mayúscula. Ejemplo: "12.345.678-9" → "12345678-9".
 */
export function canonicalRut(raw: string): string {
  const clean = raw.replace(/[.\-\s]/g, "").toUpperCase();
  if (clean.length < 2) return raw;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}
