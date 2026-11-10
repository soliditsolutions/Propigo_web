/**
 * Carga periódica de la UF y del IPC en `serie_uf` / `serie_ipc` (L-FU1, L-FU2).
 *
 * Antes solo las llenaba el seed: en producción `getUfCLP` lanza si falta el
 * día, y todo arriendo en UF dejaba de operar.
 *
 * Reglas:
 *  - Nunca se pisa un valor ya guardado (`skipDuplicates`): la UF y el IPC
 *    publicados no cambian, y un valor distinto sería una señal de problema,
 *    no algo para sobrescribir sin avisar.
 *  - Cada serie va por separado: que falle una no impide cargar la otra.
 *  - El IPC se valida contra el último índice guardado: si salta más del 5 %
 *    entre meses consecutivos casi seguro cambió la base de la serie (o se
 *    mezcló con datos de otra), y mezclar bases rompe todas las variaciones.
 *    No se inserta nada y se avisa.
 */
import type { Observacion, PedirSerie } from "./bcch";
import { SERIE_IPC, SERIE_UF } from "./bcch";

/** Lo mínimo de Prisma que usa el cargador (facilita probarlo sin base). */
export interface DbSeries {
  serieUf: {
    findFirst(args: { orderBy: { fecha: "desc" } }): Promise<{ fecha: Date; valorClp: unknown } | null>;
    createMany(args: { data: { fecha: Date; valorClp: number }[]; skipDuplicates: true }): Promise<{ count: number }>;
  };
  serieIpc: {
    findFirst(args: { orderBy: { periodo: "desc" } }): Promise<{ periodo: Date; indice: unknown } | null>;
    createMany(args: { data: { periodo: Date; indice: number }[]; skipDuplicates: true }): Promise<{ count: number }>;
  };
}

export type ResultadoSerie = {
  insertados: number;
  /** Último día/mes que quedó cargado (ISO), o null si la tabla sigue vacía. */
  hasta: string | null;
  error?: string;
};
export type ResultadoCarga = { uf: ResultadoSerie; ipc: ResultadoSerie };

const DIA_MS = 86_400_000;
/** La UF se publica con semanas de anticipación; se pide de más y los días sin dato se descartan. */
const UF_ADELANTO_DIAS = 45;
const UF_RELLENO_DIAS = 14;
const UF_HISTORIAL_ANIOS = 3;
const IPC_HISTORIAL_ANIOS = 4;
/** Rangos de cordura: lo que cae fuera es una lectura rota, no un dato. */
const UF_MIN = 5_000;
const UF_MAX = 500_000;
const IPC_SALTO_MAXIMO = 0.05;

function restarAnios(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear() - n, d.getUTCMonth(), d.getUTCDate()));
}
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function cargarUf(db: DbSeries, pedir: PedirSerie, ahora: Date): Promise<ResultadoSerie> {
  const ultima = await db.serieUf.findFirst({ orderBy: { fecha: "desc" } });
  const desde = ultima
    ? new Date(ultima.fecha.getTime() - UF_RELLENO_DIAS * DIA_MS)
    : restarAnios(ahora, UF_HISTORIAL_ANIOS);
  const hasta = new Date(ahora.getTime() + UF_ADELANTO_DIAS * DIA_MS);

  const obs = (await pedir(SERIE_UF, desde, hasta)).filter((o) => o.valor >= UF_MIN && o.valor <= UF_MAX);
  const r = obs.length
    ? await db.serieUf.createMany({
        data: obs.map((o) => ({ fecha: o.fecha, valorClp: o.valor })),
        skipDuplicates: true,
      })
    : { count: 0 };
  const final = await db.serieUf.findFirst({ orderBy: { fecha: "desc" } });
  return { insertados: r.count, hasta: iso(final?.fecha ?? null) };
}

async function cargarIpc(db: DbSeries, pedir: PedirSerie, ahora: Date): Promise<ResultadoSerie> {
  const ultimo = await db.serieIpc.findFirst({ orderBy: { periodo: "desc" } });
  const desde = ultimo
    ? new Date(Date.UTC(ultimo.periodo.getUTCFullYear(), ultimo.periodo.getUTCMonth() - 2, 1))
    : restarAnios(ahora, IPC_HISTORIAL_ANIOS);

  const obs: Observacion[] = (await pedir(SERIE_IPC, desde, ahora))
    .map((o) => ({ fecha: new Date(Date.UTC(o.fecha.getUTCFullYear(), o.fecha.getUTCMonth(), 1)), valor: o.valor }))
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

  // Comparar el primer valor nuevo con el último guardado detecta un cambio de base.
  if (ultimo && obs.length) {
    const guardado = Number(ultimo.indice);
    const nuevo = obs.find((o) => o.fecha.getTime() > ultimo.periodo.getTime());
    if (nuevo && Math.abs(nuevo.valor / guardado - 1) > IPC_SALTO_MAXIMO) {
      return {
        insertados: 0,
        hasta: iso(ultimo.periodo),
        error:
          `El IPC de ${iso(nuevo.fecha)} (${nuevo.valor}) difiere más de ${IPC_SALTO_MAXIMO * 100} % ` +
          `del último guardado (${guardado}). Posible cambio de base: no se cargó nada.`,
      };
    }
  }

  const r = obs.length
    ? await db.serieIpc.createMany({
        data: obs.map((o) => ({ periodo: o.fecha, indice: o.valor })),
        skipDuplicates: true,
      })
    : { count: 0 };
  const final = await db.serieIpc.findFirst({ orderBy: { periodo: "desc" } });
  return { insertados: r.count, hasta: iso(final?.periodo ?? null) };
}

export async function cargarIndicadores(
  db: DbSeries,
  pedir: PedirSerie,
  ahora: Date = new Date(),
): Promise<ResultadoCarga> {
  const correr = async (f: () => Promise<ResultadoSerie>): Promise<ResultadoSerie> => {
    try {
      return await f();
    } catch (e) {
      return { insertados: 0, hasta: null, error: e instanceof Error ? e.message : "Error desconocido." };
    }
  };
  // Secuencial: comparten conexión y son dos consultas chicas por día.
  const uf = await correr(() => cargarUf(db, pedir, ahora));
  const ipc = await correr(() => cargarIpc(db, pedir, ahora));
  return { uf, ipc };
}
