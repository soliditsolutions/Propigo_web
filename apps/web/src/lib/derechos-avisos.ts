/**
 * Aviso interno diario de solicitudes de derechos por vencer o vencidas (L-DP7).
 *
 * El plazo legal corre aunque nadie mire la bandeja: este aviso es lo que evita
 * que una solicitud se venza sin que nadie lo note. Una sola pasada por día, un
 * solo correo con todo lo pendiente.
 */
import { DIAS_AVISO_PREVIO, diasParaVencer, etiquetaDerecho, requiereAviso } from "./derechos";
import type { ItemAvisoDerechos } from "./email";

type Fila = { id: string; folio: string; derecho: string; estado: string; venceAt: Date; avisadaAt: Date | null };

export interface DbDerechos {
  solicitudDerecho: {
    findMany(args: {
      where: { estado: { in: string[] }; venceAt: { lte: Date } };
      orderBy: { venceAt: "asc" };
    }): Promise<Fila[]>;
    updateMany(args: { where: { id: { in: string[] } }; data: { avisadaAt: Date } }): Promise<{ count: number }>;
  };
}

export async function avisarSolicitudesPorVencer(
  db: DbDerechos,
  enviar: (items: ItemAvisoDerechos[]) => Promise<void>,
  ahora: Date = new Date(),
): Promise<{ avisadas: number }> {
  const limite = new Date(ahora.getTime() + DIAS_AVISO_PREVIO * 86_400_000);
  const candidatas = await db.solicitudDerecho.findMany({
    where: { estado: { in: ["recibida", "en_proceso"] }, venceAt: { lte: limite } },
    orderBy: { venceAt: "asc" },
  });
  const pendientes = candidatas.filter((s) => requiereAviso(s, ahora));
  if (pendientes.length === 0) return { avisadas: 0 };

  // Primero el correo y después la marca: si el envío falla, mañana se reintenta
  // en vez de darse por avisada una solicitud que nadie vio.
  await enviar(
    pendientes.map((s) => ({
      folio: s.folio,
      derecho: etiquetaDerecho(s.derecho),
      venceAt: s.venceAt,
      dias: diasParaVencer(s.venceAt, ahora),
    })),
  );
  await db.solicitudDerecho.updateMany({
    where: { id: { in: pendientes.map((s) => s.id) } },
    data: { avisadaAt: ahora },
  });
  return { avisadas: pendientes.length };
}
