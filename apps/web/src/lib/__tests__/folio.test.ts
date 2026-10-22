/**
 * Folio de documentos (L-CP4).
 *
 * El formato es puro y se prueba directo. El correlativo toca base y va contra
 * Postgres real: lo que importa probar es que NO se salte ni repita números aun
 * si dos emisiones ocurren a la vez —un folio legal duplicado es un problema
 * serio—, y eso solo lo garantiza el índice único real, no un mock.
 */
import "dotenv/config";
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { adaptadorPg } from "@/lib/pg-adaptador";
import { PrismaClient } from "../../generated/prisma/client";
import { formatearFolio, siguienteFolio, PREFIJO_FOLIO } from "../folio";

describe("formatearFolio", () => {
  it("arma el folio con prefijo, año y número a 5 dígitos", () => {
    expect(formatearFolio("pago", 2026, 42)).toBe("CP-2026-00042");
    expect(formatearFolio("liquidacion", 2026, 1)).toBe("LQ-2026-00001");
  });
  it("no trunca cuando el número supera 5 dígitos", () => {
    expect(formatearFolio("pago", 2026, 123456)).toBe("CP-2026-123456");
  });
  it("cada tipo tiene su propio prefijo", () => {
    expect(PREFIJO_FOLIO.pago).toBe("CP");
    expect(PREFIJO_FOLIO.liquidacion).toBe("LQ");
  });
});

// ── Correlativo contra base ──────────────────────────────────────────────────

let prisma: PrismaClient | null = null;
let tenantId = "";

async function comoTenant<T>(t: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${t}, true)`;
    return fn(tx as unknown as PrismaClient);
  }) as Promise<T>;
}

async function preparar(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  prisma = new PrismaClient({ adapter: adaptadorPg(url) });
  try { await prisma.$queryRaw`SELECT 1`; } catch {
    await prisma.$disconnect().catch(() => {}); prisma = null; return false;
  }
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant LIMIT 1`;
  if (rows.length < 1) throw new Error("Falta un tenant; corre `npm run db:seed`.");
  tenantId = rows[0].id;
  return true;
}

async function limpiar() {
  if (!prisma) return;
  await comoTenant(tenantId, (tx) => tx.folioCounter.deleteMany({ where: { tenantId, anio: 2099 } }));
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

beforeEach(limpiar);
afterAll(async () => { await limpiar(); await prisma?.$disconnect(); });

const FECHA = new Date("2099-05-10T00:00:00Z");

cuando("siguienteFolio — correlativo", () => {
  it("arranca en 1 y avanza sin saltos", async () => {
    const f1 = await comoTenant(tenantId, (tx) => siguienteFolio(tx, tenantId, "pago", FECHA));
    const f2 = await comoTenant(tenantId, (tx) => siguienteFolio(tx, tenantId, "pago", FECHA));
    const f3 = await comoTenant(tenantId, (tx) => siguienteFolio(tx, tenantId, "pago", FECHA));
    expect(f1).toBe("CP-2099-00001");
    expect(f2).toBe("CP-2099-00002");
    expect(f3).toBe("CP-2099-00003");
  });

  it("cada tipo lleva su serie independiente", async () => {
    const pago = await comoTenant(tenantId, (tx) => siguienteFolio(tx, tenantId, "pago", FECHA));
    const liq  = await comoTenant(tenantId, (tx) => siguienteFolio(tx, tenantId, "liquidacion", FECHA));
    expect(pago).toBe("CP-2099-00001");
    expect(liq).toBe("LQ-2099-00001");
  });

  it("emisiones concurrentes no repiten número", async () => {
    // Diez a la vez: si el contador no fuera atómico, dos leerían el mismo
    // 'ultimo' y saldría un folio duplicado. El set debe tener 10 distintos.
    const folios = await Promise.all(
      Array.from({ length: 10 }, () =>
        comoTenant(tenantId, (tx) => siguienteFolio(tx, tenantId, "pago", FECHA))),
    );
    expect(new Set(folios).size).toBe(10);
  });
});
