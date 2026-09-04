/**
 * Plazo de restitución del inmueble tras el desahucio del arrendador
 * (Ley 18.101, Art. 3 — contratos de plazo indefinido / mes a mes).
 *
 * Cuando el arrendador pone término con desahucio, el arrendatario no debe irse
 * de inmediato: la ley le da un plazo mínimo de **dos meses**, aumentado en **un
 * mes por cada año completo** que haya ocupado el inmueble, con un **tope de seis
 * meses** en total. El plazo corre desde la notificación del desahucio, no desde
 * la fecha de término ni desde hoy — por eso se cuenta contra `fechaNotificacion`.
 *
 * El cálculo vive en el núcleo (framework-agnóstico) porque define un derecho del
 * arrendatario y una fecha que un tribunal puede revisar: no puede depender de la
 * UI ni recalcularse distinto en cada pantalla.
 */

/** Meses base del plazo de restitución (Ley 18.101 Art. 3). */
export const PLAZO_BASE_MESES = 2;
/** Tope legal del plazo, en meses. */
export const PLAZO_TOPE_MESES = 6;

export type PlazoRestitucion = {
  /** Años completos que el arrendatario ocupó el inmueble a la notificación. */
  aniosOcupados: number;
  /** Plazo en meses: min(2 + años completos, 6). */
  mesesPlazo: number;
  /** Fecha límite para restituir: notificación + mesesPlazo. */
  fechaRestitucion: Date;
  /** Si el plazo llegó al tope legal (informativo para el documento). */
  alcanzoTope: boolean;
};

/**
 * Años completos entre dos fechas, en UTC. Un contrato iniciado el 5-mar-2024 y
 * notificado el 4-mar-2026 lleva 1 año completo (aún no cumple el segundo);
 * notificado el 5-mar-2026, lleva 2.
 */
function aniosCompletos(desde: Date, hasta: Date): number {
  let anios = hasta.getUTCFullYear() - desde.getUTCFullYear();
  const mesDiff = hasta.getUTCMonth() - desde.getUTCMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hasta.getUTCDate() < desde.getUTCDate())) {
    anios -= 1;
  }
  return Math.max(0, anios);
}

/** Suma meses de calendario en UTC, anclando al último día si el mes destino es más corto. */
function sumarMeses(fecha: Date, meses: number): Date {
  const d = new Date(fecha);
  const dia = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + meses);
  if (d.getUTCDate() < dia) d.setUTCDate(0);
  return d;
}

/**
 * Calcula el plazo de restitución de un desahucio del arrendador.
 *
 * @param fechaInicio      Inicio del contrato (para contar los años ocupados).
 * @param fechaNotificacion Fecha en que se notificó el desahucio.
 */
export function plazoRestitucionDesahucio(
  fechaInicio: Date,
  fechaNotificacion: Date,
): PlazoRestitucion {
  if (fechaNotificacion.getTime() < fechaInicio.getTime()) {
    throw new Error(
      "plazoRestitucionDesahucio: la notificación no puede ser anterior al inicio del contrato",
    );
  }
  const aniosOcupados = aniosCompletos(fechaInicio, fechaNotificacion);
  const mesesSinTope = PLAZO_BASE_MESES + aniosOcupados;
  const mesesPlazo = Math.min(mesesSinTope, PLAZO_TOPE_MESES);
  return {
    aniosOcupados,
    mesesPlazo,
    fechaRestitucion: sumarMeses(fechaNotificacion, mesesPlazo),
    alcanzoTope: mesesSinTope > PLAZO_TOPE_MESES,
  };
}
