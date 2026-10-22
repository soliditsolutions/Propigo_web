/**
 * terminarContrato — liquidación de la garantía como boleta (L-CM5 / P-GA3 /
 * P-GA4 / P-GA5), contra Postgres real.
 *
 * Verifica que al terminar un contrato con retenciones:
 *   · nace un asiento RETENCION_GARANTIA por ítem, con su motivo;
 *   · nace el DEVOLUCION_GARANTIA por lo que sobra;
 *   · `v_garantia_retenida` cierra a 0 (la garantía queda liquidada);
 *   · se emite el voucher `garantia` con snapshot que cuadra;
 *   · la notificación al arrendatario lleva el desglose ítem por ítem;
 *   · el exceso de retenciones sobre la garantía NO entra al ledger.
 *
 * Si la base no está levantada, se salta.
 */
import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { adaptadorPg } from "@/lib/pg-adaptador";
import { PrismaClient } from "../../../../../generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries")>();
  return { ...actual, getActor: mockGetActor };
});

let prisma: PrismaClient | null = null;
let tenantId = "";
let idArr = "";
let idProp = "";
const MARCA = 2091;
const IDS: string[] = [];

async function admin(sql: string) {
  const { execSync } = await import("child_process");
  execSync(
    `docker exec -i propigo-db psql -U propigo -d propigo -v ON_ERROR_STOP=1`,
    { input: sql, stdio: ["pipe", "ignore", "inherit"] },
  );
}

async function preparar(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  prisma = new PrismaClient({ adapter: adaptadorPg(url) });
  try { await prisma.$queryRaw`SELECT 1`; } catch {
    await prisma.$disconnect().catch(() => {}); prisma = null; return false;
  }
  const t = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant LIMIT 1`;
  if (!t.length) return false;
  tenantId = t[0].id;
  return true;
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

async function comoTenant<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  }) as Promise<T>;
}

/** Siembra un contrato vigente con garantía CLP y su asiento GARANTIA_RECIBIDA. */
async function sembrarContrato(garantiaClp: number): Promise<string> {
  return comoTenant(async (tx) => {
    const propiedad = await tx.propiedad.create({
      data: { tenantId, propietarioId: idProp, tipo: "casa", rol: `GA-${MARCA}-${IDS.length}`, direccion: "Garantía QA 1", comuna: "Ñuñoa" },
      select: { id: true },
    });
    const c = await tx.contrato.create({
      data: {
        tenantId, propiedadId: propiedad.id, arrendatarioId: idArr, propietarioId: idProp,
        estado: "vigente", denominacion: "CLP", valorArriendo: 400000, diaVencimiento: 5,
        fechaInicio: new Date(`${MARCA}-01-05`),
        garantiaMontoCLP: garantiaClp, garantiaMeses: 1,
      },
      select: { id: true },
    });
    await tx.asientoLedger.create({
      data: {
        tenantId, contratoId: c.id, arrendatarioId: idArr, propietarioId: idProp,
        tipo: "GARANTIA_RECIBIDA", concepto: "garantia", signo: 1,
        montoClp: garantiaClp, fechaEvento: new Date(`${MARCA}-01-05`),
        descripcion: "Depósito de garantía",
      },
    });
    IDS.push(c.id, propiedad.id);
    return c.id;
  });
}

cuando("terminarContrato — boleta de garantía", () => {
  let terminarContrato: typeof import("../actions").terminarContrato;

  beforeAll(async () => {
    ({ terminarContrato } = await import("../actions"));
    await comoTenant(async (tx) => {
      const a = await tx.persona.create({ data: { tenantId, rut: `GA-${MARCA}-ARR`, nombre: "Arr Garantía QA" }, select: { id: true } });
      const p = await tx.persona.create({ data: { tenantId, rut: `GA-${MARCA}-PROP`, nombre: "Prop Garantía QA" }, select: { id: true } });
      idArr = a.id; idProp = p.id;
    });
    const tenant = await comoTenant((tx) => tx.tenant.findFirstOrThrow({ where: { id: tenantId } }));
    mockGetActor.mockResolvedValue({
      usuarioId: "qa-user", tenantId, rol: "manager", tenant,
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    // asiento_ledger es append-only (trigger) — se borra con replica off.
    await admin(`
      set session_replication_role = replica;
      delete from voucher where contrato_id = any(array[${IDS.map((x) => `'${x}'`).join(",") || "null"}]::uuid[]);
      -- El folio usa el año real (hoy), no MARCA. La feature es nueva: no hay
      -- folios de garantía "de verdad" que preservar en la base de pruebas.
      delete from folio_counter where tipo = 'garantia' and anio = extract(year from now())::int;
      delete from notificacion where contrato_id = any(array[${IDS.map((x) => `'${x}'`).join(",") || "null"}]::uuid[]);
      delete from asiento_ledger where contrato_id = any(array[${IDS.map((x) => `'${x}'`).join(",") || "null"}]::uuid[]);
      delete from periodo_pago where contrato_id = any(array[${IDS.map((x) => `'${x}'`).join(",") || "null"}]::uuid[]);
      delete from contrato where id = any(array[${IDS.map((x) => `'${x}'`).join(",") || "null"}]::uuid[]);
      delete from propiedad where id = any(array[${IDS.map((x) => `'${x}'`).join(",") || "null"}]::uuid[]);
      delete from persona where id = any(array[${[idArr, idProp].filter(Boolean).map((x) => `'${x}'`).join(",") || "null"}]::uuid[]);
      set session_replication_role = default;
    `);
    await prisma.$disconnect();
  });

  it("retenciones dentro de la garantía: un asiento por ítem, la garantía cierra a 0", async () => {
    const cid = await sembrarContrato(500_000);
    const res = await terminarContrato(cid, {
      tipo: "normal",
      causal: "vencimiento_plazo" as never,
      retenciones: [
        { descripcion: "Pintura living", montoClp: 120_000 },
        { descripcion: "Reposición llaves", montoClp: 30_000 },
      ],
    });
    expect(res.ok).toBe(true);

    const asientos = await comoTenant((tx) => tx.asientoLedger.findMany({
      where: { contratoId: cid, tipo: { in: ["RETENCION_GARANTIA", "DEVOLUCION_GARANTIA"] } },
      select: { tipo: true, montoClp: true, descripcion: true },
    }));
    const ret = asientos.filter((a) => a.tipo === "RETENCION_GARANTIA");
    expect(ret).toHaveLength(2);
    expect(ret.map((a) => a.descripcion).sort()).toEqual(
      ["Retención: Pintura living", "Retención: Reposición llaves"].sort(),
    );
    const dev = asientos.find((a) => a.tipo === "DEVOLUCION_GARANTIA");
    expect(Number(dev!.montoClp)).toBe(350_000);

    const [g] = await comoTenant((tx) => tx.$queryRaw<{ retenida_clp: string }[]>`
      SELECT retenida_clp FROM v_garantia_retenida WHERE contrato_id = ${cid}::uuid`);
    expect(Number(g.retenida_clp)).toBe(0);

    const voucher = await comoTenant((tx) => tx.voucher.findFirst({
      where: { contratoId: cid, tipo: "garantia" }, select: { folio: true, snapshot: true },
    }));
    expect(voucher?.folio).toMatch(/^GA-\d{4}-\d{5}$/);
    const snap = voucher!.snapshot as Record<string, number>;
    expect(snap.garantiaRecibidaClp + snap.reajusteClp - snap.retenidoDeGarantiaClp).toBe(snap.devolucionClp);

    const notif = await comoTenant((tx) => tx.notificacion.findFirst({
      where: { contratoId: cid, personaId: idArr }, select: { cuerpo: true },
    }));
    expect(notif?.cuerpo).toContain("Pintura living");
    expect(notif?.cuerpo).toContain("Se devuelve: $350.000");
  });

  it("retenciones que exceden la garantía: el sobrante es saldo pendiente, no entra al ledger", async () => {
    const cid = await sembrarContrato(200_000);
    const res = await terminarContrato(cid, {
      tipo: "normal",
      causal: "mutuo_acuerdo" as never,
      retenciones: [{ descripcion: "Daño estructural", montoClp: 350_000 }],
    });
    expect(res.ok).toBe(true);

    const [g] = await comoTenant((tx) => tx.$queryRaw<{ retenida_clp: string }[]>`
      SELECT retenida_clp FROM v_garantia_retenida WHERE contrato_id = ${cid}::uuid`);
    expect(Number(g.retenida_clp)).toBe(0); // 200k recibido − 200k retenido − 0 devuelto

    const ret = await comoTenant((tx) => tx.asientoLedger.aggregate({
      where: { contratoId: cid, tipo: "RETENCION_GARANTIA" }, _sum: { montoClp: true },
    }));
    expect(Number(ret._sum.montoClp)).toBe(200_000); // solo lo que la garantía cubre

    const voucher = await comoTenant((tx) => tx.voucher.findFirst({
      where: { contratoId: cid, tipo: "garantia" }, select: { snapshot: true },
    }));
    const snap = voucher!.snapshot as Record<string, number>;
    expect(snap.saldoPendienteArrendatarioClp).toBe(150_000);
    expect(snap.devolucionClp).toBe(0);

    const notif = await comoTenant((tx) => tx.notificacion.findFirst({
      where: { contratoId: cid, personaId: idArr }, select: { cuerpo: true },
    }));
    expect(notif?.cuerpo).toContain("Saldo pendiente de pago");
  });

  it("rechaza una retención sin motivo", async () => {
    const cid = await sembrarContrato(300_000);
    const res = await terminarContrato(cid, {
      tipo: "normal", causal: "vencimiento_plazo" as never,
      retenciones: [{ descripcion: "   ", montoClp: 10_000 }],
    });
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/motivo/i) });
    // El contrato sigue vigente.
    const c = await comoTenant((tx) => tx.contrato.findFirst({ where: { id: cid }, select: { estado: true } }));
    expect(c?.estado).toBe("vigente");
  });
});
