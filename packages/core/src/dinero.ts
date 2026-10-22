/**
 * Utilidades de dinero para Propigo.
 *
 * Reglas (ver docs/02-modelo-dominio.md):
 * - CLP se maneja en pesos enteros (sin centavos).
 * - Nunca se usa coma flotante para acumular dinero; redondeamos al peso al convertir.
 */

export type Denominacion = "UF" | "CLP";

/** Pesos chilenos como entero (no admite decimales). */
export type CLP = number;

/** Redondea un valor a peso entero (redondeo half-up). */
export function redondearPeso(valor: number): CLP {
  return Math.round(valor);
}

/** Verifica que un monto CLP sea un entero no negativo. */
export function esClpValido(monto: number): boolean {
  return Number.isInteger(monto) && monto >= 0;
}
