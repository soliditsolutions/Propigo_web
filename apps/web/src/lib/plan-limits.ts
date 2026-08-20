/**
 * Enforcement de los límites que venden los planes — Fase B0 del rowMap.
 *
 * Hasta acá, "10 propiedades" y "3 tokens diarios de IA" eran texto en una card
 * y nada en el código los aplicaba: un tenant Bronze podía cargar 500
 * propiedades y consumir IA sin tope. No se pueden cobrar precios diferenciados
 * por límites que no se aplican, así que este módulo es prerrequisito de cobrar,
 * no una mejora posterior.
 *
 * Todo el enforcement es **del lado del servidor**. Ocultar un botón en la UI
 * es cortesía, no un límite: un request armado a mano lo saltaría.
 */
import { Prisma } from "@/generated/prisma/client";
import type { TenantClient } from "./tenant-db";
import { getCupoPropiedades, getCupoTokensDiarios } from "./plans";

export type ResultadoCupo = {
  permitido: boolean;
  usado: number;
  max: number;
};

/**
 * ¿Puede el tenant crear una propiedad más?
 *
 * Cuenta TODAS las propiedades del tenant sin filtrar por estado (borrador,
 * disponible, reservada, arrendada) — decisión N-05, coherente con el tooltip
 * ya publicado: "cuentan las disponibles, las arrendadas y las en pausa".
 *
 * Debe llamarse DENTRO de la misma transacción que crea la propiedad (por eso
 * recibe `tx`): contar en una transacción y crear en otra deja una ventana para
 * que dos altas simultáneas pasen el chequeo y se pasen del cupo.
 */
export async function verificarCupoPropiedades(
  tx: TenantClient,
  tenantId: string,
  plan: string | null,
): Promise<ResultadoCupo> {
  const max = getCupoPropiedades(plan);
  const usado = await tx.propiedad.count({ where: { tenantId } });
  return { permitido: usado < max, usado, max };
}

/**
 * Consume un token de IA del cupo diario del tenant, de forma atómica.
 *
 * El upsert-con-incremento va en una sola sentencia SQL a propósito. La versión
 * "leer el contador, comparar, escribir" tiene una carrera evidente: dos
 * peticiones simultáneas leen el mismo valor, ambas concluyen que hay cupo y
 * ambas escriben — el tenant termina consumiendo más de lo que su plan permite.
 * Acá el `WHERE usados < max` viaja dentro del `ON CONFLICT DO UPDATE`, así que
 * es Postgres quien resuelve el desempate bajo el lock de fila.
 *
 * Si el UPDATE no encuentra fila que cumpla la condición, no devuelve nada —
 * eso ES el "cupo agotado", sin necesidad de una segunda consulta.
 *
 * La fecha se calcula en el servidor en UTC. Si viniera del cliente, bastaría
 * con mentir la zona horaria para reiniciar el cupo cuando se quisiera.
 */
export async function consumirTokenIa(
  tx: TenantClient,
  tenantId: string,
  plan: string | null,
): Promise<ResultadoCupo> {
  const max = getCupoTokensDiarios(plan);

  // Un plan sin cupo no debe insertar ninguna fila: sin esta guarda, el INSERT
  // inicial crearía un consumo de 1 aunque el máximo fuera 0.
  if (max <= 0) return { permitido: false, usado: 0, max };

  const filas = await tx.$queryRaw<{ usados: number }[]>(Prisma.sql`
    INSERT INTO consumo_ia_diario (tenant_id, fecha, usados)
    VALUES (${tenantId}::uuid, (now() AT TIME ZONE 'utc')::date, 1)
    ON CONFLICT (tenant_id, fecha) DO UPDATE
      SET usados = consumo_ia_diario.usados + 1
      WHERE consumo_ia_diario.usados < ${max}
    RETURNING usados
  `);

  if (filas.length === 0) {
    // Cupo agotado: la fila existe pero ya llegó al máximo.
    return { permitido: false, usado: max, max };
  }
  return { permitido: true, usado: filas[0].usados, max };
}

/**
 * Consumo de IA de hoy, sin descontar nada — para mostrarlo en el panel.
 * Devuelve 0 usados si el tenant todavía no consumió nada hoy.
 */
export async function consultarConsumoIaHoy(
  tx: TenantClient,
  tenantId: string,
  plan: string | null,
): Promise<ResultadoCupo> {
  const max = getCupoTokensDiarios(plan);
  const filas = await tx.$queryRaw<{ usados: number }[]>(Prisma.sql`
    SELECT usados FROM consumo_ia_diario
    WHERE tenant_id = ${tenantId}::uuid
      AND fecha = (now() AT TIME ZONE 'utc')::date
  `);
  const usado = filas[0]?.usados ?? 0;
  return { permitido: usado < max, usado, max };
}
