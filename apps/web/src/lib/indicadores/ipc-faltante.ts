/**
 * Mensaje cuando un período toca reajuste por IPC y falta algún índice (L-FU3).
 *
 * Antes la conciliación seguía sin reajustar y sin avisar: la corredora cobraba
 * una renta desactualizada creyendo que estaba bien. Ahora se rechaza con la
 * causa. El INE publica el IPC de un mes hacia el día 8 del mes siguiente, y la
 * carga automática lo trae; reintentar después alcanza.
 */
const MES = new Intl.DateTimeFormat("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });

export function mensajeIpcFaltante(faltantes: Date[]): string {
  const meses = faltantes.map((d) => MES.format(d));
  const lista = meses.length > 1 ? `${meses.slice(0, -1).join(", ")} y ${meses[meses.length - 1]}` : meses[0];
  return (
    `Este período toca reajuste por IPC y aún no está cargado el índice de ${lista}. ` +
    "El INE lo publica hacia el día 8 del mes siguiente y se carga solo; " +
    "vuelve a conciliar entonces para que la renta quede reajustada."
  );
}
