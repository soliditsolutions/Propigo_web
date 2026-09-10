/**
 * Folio de documentos (L-CP4).
 *
 * Un folio es un correlativo legible y legal del documento que la corredora
 * emite: "CP-2026-00042" para el comprobante de pago, "LQ-2026-00042" para la
 * liquidación. Es correlativo **por corredora, tipo y año**: el documento es de
 * la corredora, no de la plataforma (decisión L-01), así que dos corredoras
 * llevan series independientes, y cada año arranca de nuevo.
 *
 * Un correlativo legal no puede saltarse ni repetirse aunque dos emisiones
 * ocurran a la vez. Por eso el número no sale de un max()+1 sobre voucher —que
 * dos transacciones concurrentes leerían igual y duplicarían— sino de un
 * contador con una fila única por (tenant, tipo, año): el upsert con increment
 * serializa a los concurrentes sobre esa fila.
 */
import type { TenantClient } from "./tenant-db";
import type { TipoVoucher } from "@/generated/prisma/enums";

/** Prefijo del folio según el tipo de documento. */
export const PREFIJO_FOLIO: Record<TipoVoucher, string> = {
  pago: "CP",         // Comprobante de Pago
  liquidacion: "LQ",  // Liquidación
  garantia: "GA",     // Devolución de Garantía
};

/**
 * Arma el folio legible. El número se rellena a 5 dígitos ("00042"); si una
 * corredora superara los 99.999 documentos de un tipo en un año, el formato
 * crece en vez de truncar —nunca se pierde un dígito—.
 */
export function formatearFolio(tipo: TipoVoucher, anio: number, numero: number): string {
  return `${PREFIJO_FOLIO[tipo]}-${anio}-${String(numero).padStart(5, "0")}`;
}

/**
 * Entrega el siguiente folio para (corredora, tipo, año) y avanza el contador,
 * de forma atómica. Debe correr dentro de la misma transacción que crea el
 * voucher: si la creación falla y hace rollback, el folio no se consume.
 */
export async function siguienteFolio(
  tx: TenantClient,
  tenantId: string,
  tipo: TipoVoucher,
  fecha: Date,
): Promise<string> {
  const anio = fecha.getUTCFullYear();
  const contador = await tx.folioCounter.upsert({
    where:  { tenantId_tipo_anio: { tenantId, tipo, anio } },
    create: { tenantId, tipo, anio, ultimo: 1 },
    update: { ultimo: { increment: 1 } },
    select: { ultimo: true },
  });
  return formatearFolio(tipo, anio, contador.ultimo);
}
