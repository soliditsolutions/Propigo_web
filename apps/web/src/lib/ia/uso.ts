/**
 * Consumo de la IA externa: registro por llamada y tope diario de neuronas.
 *
 * Cloudflare da 10.000 neuronas gratis al día para TODA la cuenta, y al agotarlas
 * las llamadas fallan hasta las 00:00 UTC. Si las revisiones de contrato se
 * comieran la cuota, quien se registra esa noche no podría verificar su cédula.
 * Por eso las revisiones tienen un tope menor que el total: el resto queda
 * reservado para el registro.
 *
 * Solo se guardan cifras (tokens y neuronas), nunca el contenido enviado.
 */
import type { PrismaClient } from "@/generated/prisma/client";

export type FlujoIa = "registro_cedula" | "contrato_validar_doc";

/** Neuronas gratis por día en Workers AI. */
export const NEURONAS_GRATIS_DIA = 10_000;

/** Parte del total diario que pueden gastar las revisiones de contrato. */
export const PARTE_CONTRATOS = 0.7;

export type FilaUsoIa = {
  flujo: FlujoIa;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  neuronas: number;
  ok: boolean;
};

export type AlmacenUsoIa = {
  /** Neuronas gastadas desde `desde` (inclusive). */
  neuronasDesde(desde: Date): Promise<number>;
  registrar(fila: FilaUsoIa): Promise<void>;
};

/** Inicio del día de Cloudflare: las 00:00 UTC. */
export function inicioDiaUtc(ahora: Date): Date {
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
}

/**
 * Neuronas por día que se permite gastar. `IA_NEURONAS_DIA` lo sube cuando la
 * cuenta pasa al plan de pago; "0" quita el tope propio (el costo lo cuida
 * Cloudflare con su propio presupuesto).
 */
export function presupuestoNeuronasDia(env: Record<string, string | undefined> = process.env): number {
  const bruto = env.IA_NEURONAS_DIA?.trim();
  if (!bruto) return NEURONAS_GRATIS_DIA;
  const n = Number(bruto);
  if (!Number.isInteger(n) || n < 0) return NEURONAS_GRATIS_DIA;
  return n === 0 ? Infinity : n;
}

/** Tope de neuronas del día para un flujo. */
export function topeDelFlujo(flujo: FlujoIa, env: Record<string, string | undefined> = process.env): number {
  const total = presupuestoNeuronasDia(env);
  return flujo === "contrato_validar_doc" ? Math.floor(total * PARTE_CONTRATOS) : total;
}

/**
 * Si el flujo todavía puede gastar hoy. No predice el costo de la llamada que
 * viene: el tope se cruza como mucho por una llamada, y el corte real lo pone
 * Cloudflare.
 */
export async function hayCupoIa(
  flujo: FlujoIa,
  almacen: AlmacenUsoIa,
  ahora: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): Promise<boolean> {
  const tope = topeDelFlujo(flujo, env);
  if (tope === Infinity) return true;
  return (await almacen.neuronasDesde(inicioDiaUtc(ahora))) < tope;
}

/** Almacén real, sobre la tabla `uso_ia`. */
export function almacenPrisma(prisma: Pick<PrismaClient, "usoIa">): AlmacenUsoIa {
  return {
    async neuronasDesde(desde) {
      const r = await prisma.usoIa.aggregate({
        where: { createdAt: { gte: desde } },
        _sum: { neuronas: true },
      });
      return r._sum.neuronas ?? 0;
    },
    async registrar(fila) {
      await prisma.usoIa.create({ data: fila });
    },
  };
}
