import { prisma } from "@/lib/db";
import { generarCalendario, type PeriodoCalendario } from "@propigo/core";

const DIAS_UMBRAL    = 90;  // extiende cuando queden < 90 días en el último período
const MESES_EXTENSION = 12; // cuántos meses adicionales generar

/**
 * Para contratos indefinidos vigentes: si el último período pendiente
 * vence en menos de DIAS_UMBRAL días, genera MESES_EXTENSION meses adicionales.
 *
 * Se llama en el server component de detalle del contrato — efecto silencioso.
 * Incluye doble verificación dentro de la transacción para evitar race conditions
 * (p.ej. dos tabs abiertas del mismo contrato).
 *
 * @returns true si se generaron períodos nuevos, false si no era necesario.
 */
export async function verificarYExtenderCalendario(
  tenantId: string,
  contratoId: string,
  contrato: {
    estado:          string;
    fechaFin:        Date | null;
    diaVencimiento:  number;
    valorArriendo:   number;
    denominacion:    string;
    cobraGastoComun: boolean;
    periodos: Array<{
      numero:            number;
      fechaVencimiento:  Date;
      montoGastoComun:   number;
    }>;
  },
): Promise<boolean> {
  if (contrato.estado !== "vigente" || contrato.fechaFin !== null) return false;

  const ultimoPeriodo = contrato.periodos.at(-1);
  if (!ultimoPeriodo) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diasRestantes = Math.floor(
    (new Date(ultimoPeriodo.fechaVencimiento).getTime() - hoy.getTime()) / 86_400_000,
  );

  if (diasRestantes >= DIAS_UMBRAL) return false;

  // Inicio del primer período nuevo: mes siguiente al último existente
  const lastY = new Date(ultimoPeriodo.fechaVencimiento).getUTCFullYear();
  const lastM = new Date(ultimoPeriodo.fechaVencimiento).getUTCMonth();
  const inicioPrimeroNuevo = new Date(Date.UTC(lastY, lastM + 1, 1));

  // La nueva fechaFin abarca MESES_EXTENSION meses completos desde el inicio
  const inicioY = inicioPrimeroNuevo.getUTCFullYear();
  const inicioM = inicioPrimeroNuevo.getUTCMonth();
  const fechaFinExtension = new Date(Date.UTC(inicioY, inicioM + MESES_EXTENSION - 1, 15));

  const nuevosCalendario = generarCalendario({
    fechaInicio:     inicioPrimeroNuevo,
    fechaFin:        fechaFinExtension,
    diaVencimiento:  contrato.diaVencimiento,
    montoArriendo:   contrato.valorArriendo,
    denominacion:    contrato.denominacion as "UF" | "CLP",
    montoGastoComun: contrato.cobraGastoComun ? ultimoPeriodo.montoGastoComun : 0,
  });

  if (nuevosCalendario.length === 0) return false;

  const offsetNumero = ultimoPeriodo.numero;

  await prisma.$transaction(async (tx) => {
    // Re-verificar dentro de la TX: contrato aún indefinido y vigente
    const contratoDb = await tx.contrato.findFirst({
      where: { id: contratoId, tenantId, estado: "vigente", fechaFin: null },
      select: { id: true },
    });
    if (!contratoDb) return;

    // Verificar que nadie extendió mientras tanto (mismo número del último período)
    const ultimoDb = await tx.periodoPago.findFirst({
      where: { contratoId, tenantId },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    if (ultimoDb?.numero !== ultimoPeriodo.numero) return;

    await tx.periodoPago.createMany({
      data: nuevosCalendario.map((p: PeriodoCalendario) => ({
        tenantId,
        contratoId,
        numero:           p.numero + offsetNumero,
        fechaInicio:      p.fechaInicio,
        fechaVencimiento: p.fechaVencimiento,
        montoBase:        p.montoBase,
        montoGastoComun:  p.montoGastoComun,
      })),
    });
  });

  return true;
}
