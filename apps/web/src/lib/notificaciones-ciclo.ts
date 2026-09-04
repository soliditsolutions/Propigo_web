/**
 * Colapso de notificaciones del ciclo de vida de un contrato.
 *
 * Un contrato pasa por estados —pendiente de firma, vigente, renovado,
 * terminado— y cada transición genera su aviso. Si el cron no alcanzó a
 * despachar entre dos transiciones, el arrendatario recibiría los dos correos
 * seguidos: "firma tu contrato" y, acto seguido, "tu contrato está vigente".
 * El primero ya no tiene sentido cuando el segundo existe.
 *
 * Esto no aplica a los avisos recurrentes (cobros, vencimientos, comprobantes):
 * cada uno de esos importa por separado. Solo colapsa los que describen el
 * ESTADO del contrato, que son mutuamente excluyentes: vale el último.
 */
import type { TipoNotificacion } from "@/generated/prisma/enums";

/**
 * Tipos que representan el estado del contrato. Están ordenados por el momento
 * del ciclo en que ocurren, pero el colapso NO se apoya en este orden sino en
 * la fecha de creación: lo que manda es cuál se generó después, no un ranking
 * fijo, para no tener que reordenar esta lista cada vez que se agregue un tipo.
 */
export const TIPOS_CICLO_CONTRATO: ReadonlySet<TipoNotificacion> = new Set([
  "solicitud_firma",
  "nuevo_contrato",
  "renovacion_contrato",
  "salida_anticipada",
  "termino_contrato",
]);

export function esNotificacionDeCiclo(tipo: TipoNotificacion): boolean {
  return TIPOS_CICLO_CONTRATO.has(tipo);
}

/** Lo mínimo que necesita el colapso de cada notificación. */
export type NotifCiclo = {
  id: string;
  tipo: TipoNotificacion;
  contratoId: string | null;
  createdAt: Date;
  estado: string;
};

/**
 * Dada TODA notificación de ciclo de los contratos en juego (sin importar su
 * estado), devuelve los ids de las que están **pendientes** y quedaron
 * obsoletas: existe otra de ciclo, del mismo contrato, creada después.
 *
 * Se consideran también las ya enviadas: si el "contrato vigente" ya salió, la
 * "solicitud de firma" que quedó pendiente igual debe retirarse. Solo se
 * retiran las pendientes —una ya enviada no se puede des-enviar—.
 */
export function idsReemplazadas(notifs: NotifCiclo[]): string[] {
  const porContrato = new Map<string, NotifCiclo[]>();
  for (const n of notifs) {
    if (!n.contratoId || !TIPOS_CICLO_CONTRATO.has(n.tipo)) continue;
    const grupo = porContrato.get(n.contratoId);
    if (grupo) grupo.push(n);
    else porContrato.set(n.contratoId, [n]);
  }

  const retirar: string[] = [];
  for (const grupo of porContrato.values()) {
    const maxTs = Math.max(...grupo.map((n) => n.createdAt.getTime()));
    for (const n of grupo) {
      // Estrictamente anterior a la más reciente: si empatan en el tiempo
      // (caso raro), ninguna retira a la otra.
      if (n.estado === "pendiente" && n.createdAt.getTime() < maxTs) {
        retirar.push(n.id);
      }
    }
  }
  return retirar;
}
