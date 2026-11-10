/**
 * Qué meses de IPC se usan para reajustar (decisión L-10, 2026-11-09).
 *
 * El INE publica el IPC de un mes hacia el día 8 del siguiente, así que el del
 * mes del pago casi nunca existe cuando se paga. Se usa **el último IPC
 * disponible** hasta el mes del pago como extremo final, y el extremo inicial se
 * corre el mismo número de meses hacia atrás para que la variación cubra
 * exactamente los mismos meses que si se hubiera usado el mes del pago
 * (ej.: pago en noviembre con IPC hasta octubre → octubre vs. mes de inicio − 1).
 *
 * Como el extremo final depende de lo publicado al momento de conciliar, el
 * mismo período conciliado antes o después del día 8 puede usar un mes distinto.
 * Cada reajuste deja los meses usados en el asiento, para poder explicarlo.
 */

/** Más atraso que esto significa que la carga de IPC está caída: no se reajusta con datos viejos. */
export const REZAGO_MAXIMO_MESES = 2;

const MES = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
export const nombreMes = (d: Date) => MES.format(d);

/** Meses completos de `desde` a `hasta` (ambos día 1, UTC). */
export function mesesEntre(desde: Date, hasta: Date): number {
  return (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 + (hasta.getUTCMonth() - desde.getUTCMonth());
}

/** Corre un mes día-1 `n` meses (negativo = hacia atrás). */
export function sumarMeses(mes: Date, n: number): Date {
  return new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + n, 1));
}

/** Rezago del último IPC disponible respecto del mes del pago, o null si está demasiado atrasado. */
export function rezagoIpc(ultimoDisponible: Date | null, mesPago: Date): number | null {
  if (!ultimoDisponible) return null;
  const rezago = mesesEntre(ultimoDisponible, mesPago);
  return rezago >= 0 && rezago <= REZAGO_MAXIMO_MESES ? rezago : null;
}

/** Mensaje cuando no hay un IPC reciente: la carga automática no está al día. */
export function mensajeIpcDesactualizado(ultimoDisponible: Date | null, mesPago: Date): string {
  const ultimo = ultimoDisponible ? `el último cargado es ${nombreMes(ultimoDisponible)}` : "no hay ningún IPC cargado";
  return (
    `Este período toca reajuste por IPC y no hay un índice reciente (${ultimo}; ` +
    `el pago es de ${nombreMes(mesPago)}). La carga automática del IPC no está al día: ` +
    "avisa al administrador y vuelve a conciliar cuando esté cargado."
  );
}

/** Mensaje cuando falta el índice del extremo inicial de la variación. */
export function mensajeIpcFaltante(faltantes: Date[]): string {
  const meses = faltantes.map(nombreMes);
  const lista = meses.length > 1 ? `${meses.slice(0, -1).join(", ")} y ${meses[meses.length - 1]}` : meses[0];
  return (
    `Este período toca reajuste por IPC y no está cargado el índice de ${lista}, ` +
    "necesario para calcular la variación. Avisa al administrador y vuelve a conciliar cuando esté cargado."
  );
}
