/**
 * Aplica los plazos de `lib/retencion.ts` borrando lo que ya venció.
 *
 * Vive separado del módulo de plazos porque aquel es puro —lo importa la página
 * de privacidad, que corre en el navegador— y este toca la base.
 *
 * Corre por corredora y no con un `DELETE` global, por dos motivos: respeta RLS
 * igual que el resto del código (ADR-0011), y deja el conteo por corredora, que
 * es lo que sirve para verificar que el proceso está haciendo algo.
 */
import type { TenantClient } from "./tenant-db";
import { fechaCorte, retencion } from "./retencion";

/** Cuántas filas se borraron de cada categoría. */
export type ResultadoPurga = {
  otp: number;
  accesoPortal: number;
  auditoriaEquipo: number;
};

export function purgaVacia(): ResultadoPurga {
  return { otp: 0, accesoPortal: 0, auditoriaEquipo: 0 };
}

export function sumarPurgas(a: ResultadoPurga, b: ResultadoPurga): ResultadoPurga {
  return {
    otp:             a.otp + b.otp,
    accesoPortal:    a.accesoPortal + b.accesoPortal,
    auditoriaEquipo: a.auditoriaEquipo + b.auditoriaEquipo,
  };
}

/**
 * Borra los datos vencidos de una corredora.
 *
 * `ahora` se inyecta para poder probar el corte sin esperar tres años.
 */
export async function purgarDatosVencidos(
  tx: TenantClient,
  tenantId: string,
  ahora: Date = new Date(),
): Promise<ResultadoPurga> {
  // El OTP se mide por `expiraEn` y no por `createdAt`: lo que importa es
  // cuándo dejó de servir, no cuándo se pidió.
  const otp = await tx.accesoOtp.deleteMany({
    where: { tenantId, expiraEn: { lt: fechaCorte(retencion("otp").dias!, ahora) } },
  });

  const accesoPortal = await tx.accesoLog.deleteMany({
    where: { tenantId, createdAt: { lt: fechaCorte(retencion("accesoPortal").dias!, ahora) } },
  });

  const auditoriaEquipo = await tx.auditoriaEquipo.deleteMany({
    where: { tenantId, createdAt: { lt: fechaCorte(retencion("auditoriaEquipo").dias!, ahora) } },
  });

  return {
    otp:             otp.count,
    accesoPortal:    accesoPortal.count,
    auditoriaEquipo: auditoriaEquipo.count,
  };
}
