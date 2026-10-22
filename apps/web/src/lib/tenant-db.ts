import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";

export type TenantClient = Prisma.TransactionClient;

/**
 * Ejecuta `fn` dentro de una transacción con `app.current_tenant_id` seteado
 * para esa conexión — requisito para que la política RLS `tenant_isolation`
 * (setup.sql, ADR-0011) filtre de verdad las consultas por tenant. Sin esto,
 * bajo el rol de runtime `propigo_app` (sin bypass de RLS), toda consulta a
 * una tabla protegida devuelve 0 filas.
 *
 * `SET LOCAL` es transaccional por diseño de Postgres — por eso todas las
 * queries dentro de `fn` deben usar el `tx` que se les pasa, no el `prisma`
 * global (una query fuera de esta transacción no vería el valor seteado).
 *
 * `set_config(..., true)` en vez de `SET LOCAL app.current_tenant_id = $1`
 * porque el nombre del parámetro no es interpolable de forma segura con
 * `SET LOCAL`; `set_config` sí acepta el valor como parámetro normal.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: TenantClient) => Promise<T>,
  options?: { timeout?: number; maxWait?: number },
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx);
  }, options);
}
