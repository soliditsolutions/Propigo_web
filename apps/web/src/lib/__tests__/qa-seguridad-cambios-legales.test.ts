/**
 * QA + Seguridad de los cambios legales/billing de la sesión 2026-09.
 *
 * Contra Postgres real y con el rol de la aplicación (`housing_app`, sujeto a
 * RLS). Cubre lo que los tests existentes no tocan de esta tanda:
 *   · aislamiento de `folio_counter` entre corredoras;
 *   · la restricción UNIQUE del RUT de la corredora;
 *   · que la inyección en los campos de la cuenta bancaria se guarde como
 *     texto y no ejecute nada, y que el validador rechace lo malformado;
 *   · que el folio no salte ni se repita bajo concurrencia;
 *   · que un snapshot de voucher no arrastre datos de otro contrato.
 *
 * Ver Docs/gestion/plan-qa-seguridad-cambios-legales-2026-09.md
 *
 * Si la base no está levantada, el archivo se salta.
 */
import "dotenv/config";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { validarCuentaBancaria } from "../cuenta-bancaria";
import { siguienteFolio } from "../folio";

let prisma: PrismaClient | null = null;
let tenantA = "";
let tenantB = "";
let personaA = "";

const RUT_PERSONA_QA = "QA-SEG-FIXTURE";
const MARCA = 2088; // año imposible: aísla lo que crea este archivo

async function comoTenant<T>(t: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${t}, true)`;
    return fn(tx as unknown as PrismaClient);
  }) as Promise<T>;
}

async function preparar(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try { await prisma.$queryRaw`SELECT 1`; } catch {
    await prisma.$disconnect().catch(() => {}); prisma = null; return false;
  }
  const tenants = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant LIMIT 2`;
  if (tenants.length < 2) throw new Error("Se necesitan dos corredoras. Corre `npm run db:seed`.");
  tenantA = tenants[0].id;
  tenantB = tenants[1].id;
  // Persona propia del archivo: los otros tests corren en paralelo contra la
  // misma base y comparten las personas del seed; una dedicada evita que el
  // índice único (tenant, persona) de `cuenta_bancaria` choque con una cuenta
  // que otro test cree a la vez.
  const per = await comoTenant(tenantA, (tx) => tx.persona.upsert({
    where: { tenantId_rut: { tenantId: tenantA, rut: RUT_PERSONA_QA } },
    update: {},
    create: { tenantId: tenantA, rut: RUT_PERSONA_QA, nombre: "QA Seguridad (fixture)" },
    select: { id: true },
  }));
  personaA = per.id;
  return true;
}

async function limpiar() {
  if (!prisma) return;
  for (const t of [tenantA, tenantB].filter(Boolean)) {
    await comoTenant(t, async (tx) => {
      await tx.folioCounter.deleteMany({ where: { anio: MARCA } });
      await tx.cuentaBancaria.deleteMany({ where: { rutTitular: "QA-INJECT" } });
    });
  }
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

afterAll(async () => {
  await limpiar();
  if (prisma && personaA) {
    await comoTenant(tenantA, async (tx) => {
      await tx.cuentaBancaria.deleteMany({ where: { personaId: personaA } });
      await tx.persona.deleteMany({ where: { id: personaA, rut: RUT_PERSONA_QA } });
    });
  }
  await prisma?.$disconnect();
});

// ── B. Aislamiento multi-tenant (RLS) ────────────────────────────────────────

cuando("B — folio_counter no cruza de corredora", () => {
  it("otra corredora NO ve ni altera el contador de folios de A", async () => {
    await limpiar();
    // A genera un folio → nace su fila de contador.
    await comoTenant(tenantA, (tx) => siguienteFolio(tx, tenantA, "pago", new Date(`${MARCA}-05-10`)));

    // B, sin filtrar por tenant a propósito: si RLS falla, algo aparece.
    const fuga = await comoTenant(tenantB, (tx) =>
      tx.folioCounter.findMany({ where: { anio: MARCA } }));
    expect(fuga).toHaveLength(0);

    // B tampoco puede pisar el contador de A.
    const upd = await comoTenant(tenantB, (tx) =>
      tx.folioCounter.updateMany({ where: { anio: MARCA }, data: { ultimo: 999 } }));
    expect(upd.count).toBe(0);

    // El contador de A quedó intacto.
    const propioA = await comoTenant(tenantA, (tx) =>
      tx.folioCounter.findMany({ where: { anio: MARCA }, select: { ultimo: true } }));
    expect(propioA[0]?.ultimo).toBe(1);
  });

  it("SIN contexto de tenant, folio_counter devuelve vacío", async () => {
    await comoTenant(tenantA, (tx) => siguienteFolio(tx, tenantA, "pago", new Date(`${MARCA}-05-10`)));
    const fuga = await prisma!.folioCounter.findMany({ where: { anio: MARCA } });
    expect(fuga).toHaveLength(0);
  });

  it("housing_app tiene los GRANT sobre folio_counter y cuenta_bancaria", async () => {
    const grants = await prisma!.$queryRaw<{ table_name: string; privilege_type: string }[]>`
      SELECT table_name, privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'housing_app' AND table_name IN ('folio_counter', 'cuenta_bancaria')`;
    for (const t of ["folio_counter", "cuenta_bancaria"]) {
      const priv = grants.filter((g) => g.table_name === t).map((g) => g.privilege_type).sort();
      expect(priv, t).toEqual(["DELETE", "INSERT", "SELECT", "UPDATE"]);
    }
  });

  it("folio_counter y cuenta_bancaria tienen RLS activada", async () => {
    const rls = await prisma!.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class
      WHERE relname IN ('folio_counter', 'cuenta_bancaria')`;
    for (const r of rls) expect(r.relrowsecurity, r.relname).toBe(true);
  });
});

// ── D. Inyección en los campos de la cuenta bancaria ─────────────────────────

cuando("D — inyección en la cuenta bancaria", () => {
  const PAYLOADS = [
    "'; DROP TABLE cuenta_bancaria; --",
    "' OR '1'='1",
    "' UNION SELECT numero FROM cuenta_bancaria --",
    "<script>alert(1)</script>",
    "Robert'); DELETE FROM tenant; --",
  ];

  it("un payload en el nombre del banco/titular se guarda como TEXTO, no ejecuta", async () => {
    await limpiar();
    // El número y el RUT sí se validan; el banco y el titular son texto libre.
    // Se prueba que Prisma parametriza y el string queda literal.
    for (const payload of PAYLOADS) {
      const creada = await comoTenant(tenantA, (tx) => tx.cuentaBancaria.create({
        data: {
          tenantId: tenantA, personaId: personaA,
          banco: payload, tipo: "corriente", numero: "12345678",
          titular: payload, rutTitular: "QA-INJECT",
        },
        select: { id: true, banco: true, titular: true },
      }));
      expect(creada.banco).toBe(payload);   // literal, sin interpretar
      expect(creada.titular).toBe(payload);
      // La tabla sigue existiendo y el tenant también.
      const sigueViva = await comoTenant(tenantA, (tx) => tx.cuentaBancaria.count());
      expect(sigueViva).toBeGreaterThan(0);
      const tenantSigue = await prisma!.$queryRaw<{ n: bigint }[]>`SELECT count(*) n FROM tenant`;
      expect(Number(tenantSigue[0].n)).toBeGreaterThanOrEqual(2);
      await comoTenant(tenantA, (tx) => tx.cuentaBancaria.deleteMany({ where: { id: creada.id } }));
    }
  });

  it("validarCuentaBancaria rechaza RUT y número malformados (incluye inyección)", () => {
    for (const payload of PAYLOADS) {
      expect(validarCuentaBancaria({
        banco: "Banco X", tipo: "corriente", numero: "12345678",
        titular: "T", rutTitular: payload,
      }), `rut=${payload}`).not.toBeNull();
      expect(validarCuentaBancaria({
        banco: "Banco X", tipo: "corriente", numero: payload,
        titular: "Titular", rutTitular: "11111111-1",
      }), `numero=${payload}`).not.toBeNull();
    }
  });

  it("validarCuentaBancaria rechaza un tipo fuera del enum (no se puede colar 'otro')", () => {
    expect(validarCuentaBancaria({
      banco: "Banco X", tipo: "'; DROP --", numero: "12345678",
      titular: "Titular", rutTitular: "11111111-1",
    })).toMatch(/tipo de cuenta/i);
  });
});

// ── E. Constraints e integridad ─────────────────────────────────────────────

cuando("E — constraints de integridad", () => {
  it("E1 — el RUT de la corredora es UNIQUE: no hay dos con el mismo", async () => {
    const rutA = await prisma!.$queryRaw<{ rut: string }[]>`
      SELECT rut FROM tenant WHERE id = ${tenantA}::uuid`;
    // Intentar ponerle a B el RUT de A debe fallar por la restricción UNIQUE.
    await expect(
      prisma!.$executeRaw`UPDATE tenant SET rut = ${rutA[0].rut} WHERE id = ${tenantB}::uuid`,
    ).rejects.toThrow();
  });

  it("E1b — la función auth_rut_corredora_existe detecta un RUT ya tomado", async () => {
    const rutA = await prisma!.$queryRaw<{ rut: string }[]>`
      SELECT rut FROM tenant WHERE id = ${tenantA}::uuid`;
    const existe = await prisma!.$queryRaw<{ existe: boolean }[]>`
      SELECT auth_rut_corredora_existe(${rutA[0].rut}) AS existe`;
    expect(existe[0].existe).toBe(true);
    const inexistente = await prisma!.$queryRaw<{ existe: boolean }[]>`
      SELECT auth_rut_corredora_existe('99999999-9') AS existe`;
    expect(inexistente[0].existe).toBe(false);
  });

  it("E2 — 10 folios concurrentes del mismo (tenant, tipo, año): sin saltos ni repetidos", async () => {
    await limpiar();
    const fecha = new Date(`${MARCA}-07-01`);
    const folios = await Promise.all(
      Array.from({ length: 10 }, () =>
        comoTenant(tenantA, (tx) => siguienteFolio(tx, tenantA, "liquidacion", fecha))),
    );
    // 10 distintos.
    expect(new Set(folios).size).toBe(10);
    // Y son exactamente 1..10, sin saltos.
    const nums = folios.map((f) => Number(f.split("-").pop())).sort((a, b) => a - b);
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("E3 — una sola cuenta de corredora (personaId nulo) por tenant", async () => {
    await comoTenant(tenantA, (tx) => tx.cuentaBancaria.deleteMany({
      where: { tenantId: tenantA, personaId: null },
    }));
    const datos = {
      tenantId: tenantA, personaId: null, banco: "B",
      tipo: "corriente" as const, titular: "T", rutTitular: "QA-INJECT",
    };
    const primera = await comoTenant(tenantA, (tx) =>
      tx.cuentaBancaria.create({ data: { ...datos, numero: "1111" }, select: { id: true } }));
    try {
      await expect(
        comoTenant(tenantA, (tx) => tx.cuentaBancaria.create({ data: { ...datos, numero: "2222" } })),
      ).rejects.toThrow();
    } finally {
      await comoTenant(tenantA, (tx) => tx.cuentaBancaria.deleteMany({ where: { id: primera.id } }));
    }
  });
});

// ── C. Fuga de información en el snapshot del voucher ────────────────────────

cuando("C — el snapshot del voucher no arrastra datos ajenos", () => {
  it("un voucher solo conserva el snapshot de SU contrato", async () => {
    // Se leen los vouchers reales de A y se comprueba que ningún snapshot
    // menciona un RUT o dirección que no sea de su propio contrato.
    const vouchers = await comoTenant(tenantA, (tx) => tx.voucher.findMany({
      where: { tenantId: tenantA },
      select: {
        snapshot: true,
        contrato: {
          select: {
            arrendatario: { select: { rut: true } },
            propietario: { select: { rut: true } },
            propiedad: { select: { direccion: true } },
          },
        },
      },
      take: 20,
    }));
    for (const v of vouchers) {
      const snap = v.snapshot as Record<string, unknown>;
      const emisor = snap.emisor as { rut?: string } | undefined;
      const arr = snap.arrendatario as { rut?: string } | undefined;
      const prop = snap.propietario as { rut?: string } | undefined;
      if (arr?.rut) expect(arr.rut).toBe(v.contrato.arrendatario.rut);
      if (prop?.rut) expect(prop.rut).toBe(v.contrato.propietario.rut);
      // El emisor es la corredora, no una de las partes: su RUT no debe ser
      // el de nadie más que el tenant.
      if (emisor?.rut) {
        const tenantRut = await prisma!.$queryRaw<{ rut: string }[]>`
          SELECT rut FROM tenant WHERE id = ${tenantA}::uuid`;
        expect(emisor.rut).toBe(tenantRut[0].rut);
      }
    }
  });
});

// ── A. IDOR vertical en el portal (A3/A4) ───────────────────────────────────
//
// El arrendatario descarga su comprobante de PAGO; al propietario se le entrega
// la LIQUIDACIÓN. Nunca al revés: la liquidación lleva la comisión de la
// corredora y —desde L-DT7— la cuenta bancaria del propietario. Se reproduce la
// consulta exacta de /api/portal/voucher/[id]/pdf (y /api/portal/documento/[id])
// bajo RLS, con un contrato sembrado de propósito, y se comprueba que el filtro
// por `tipo` + la pertenencia del contrato por el lado correcto lo impiden.

const SECRETO_CUENTA = "SECRETO-CUENTA-QA-999";
let idContratoP = "";
let idVoucherPago = "";
let idVoucherLiq = "";
let idArr = "";
let idProp = "";

async function sembrarPortal(): Promise<boolean> {
  if (!prisma) return false;
  await comoTenant(tenantA, async (tx) => {
    const props = await tx.persona.findMany({ where: { tenantId: tenantA }, select: { id: true }, take: 2 });
    idArr = props[0].id;
    idProp = props[1]?.id ?? props[0].id;
    // Propiedad propia: un índice único impide dos contratos vigentes por
    // propiedad, así que no se puede reusar una del seed.
    const propiedad = await tx.propiedad.create({
      data: {
        tenantId: tenantA, propietarioId: idProp, tipo: "casa",
        rol: `QA-${MARCA}-0001`, direccion: "QA IDOR portal",
      },
      select: { id: true },
    });
    const c = await tx.contrato.create({
      data: {
        tenantId: tenantA, propiedadId: propiedad.id,
        arrendatarioId: idArr, propietarioId: idProp,
        estado: "vigente", denominacion: "CLP", valorArriendo: 500000,
        diaVencimiento: 5, fechaInicio: new Date(`${MARCA}-01-05`),
      },
      select: { id: true },
    });
    idContratoP = c.id;
    const snapBase = { emisor: { nombre: "QA", rut: "1-9", giro: "x", direccion: "x" } };
    const vp = await tx.voucher.create({
      data: {
        tenantId: tenantA, contratoId: idContratoP, arrendatarioId: idArr,
        tipo: "pago", montoClp: 500000, fecha: new Date(`${MARCA}-01-05`),
        folio: `CP-${MARCA}-90001`, snapshot: snapBase,
      },
      select: { id: true },
    });
    idVoucherPago = vp.id;
    const vl = await tx.voucher.create({
      data: {
        tenantId: tenantA, contratoId: idContratoP, arrendatarioId: idArr,
        tipo: "liquidacion", montoClp: 460000, fecha: new Date(`${MARCA}-01-05`),
        folio: `LQ-${MARCA}-90001`,
        snapshot: { ...snapBase, cuentaPropietario: { banco: "Banco Falso", numero: SECRETO_CUENTA } },
      },
      select: { id: true },
    });
    idVoucherLiq = vl.id;
  });
  return true;
}

/** Reproduce la autorización de /api/portal/voucher/[id]/pdf. */
async function comoPortalVoucher(rol: "arrendatario" | "propietario", personaId: string, voucherId: string) {
  return comoTenant(tenantA, async (tx) => {
    const tipoPermitido = rol === "arrendatario" ? "pago" : "liquidacion";
    const whereContrato = rol === "arrendatario"
      ? { tenantId: tenantA, arrendatarioId: personaId }
      : { tenantId: tenantA, propietarioId: personaId };
    const v = await tx.voucher.findFirst({
      where: { id: voucherId, tenantId: tenantA, tipo: tipoPermitido },
      select: { id: true, contratoId: true, snapshot: true },
    });
    if (!v) return null;
    const c = await tx.contrato.findFirst({ where: { id: v.contratoId, ...whereContrato }, select: { id: true } });
    return c ? v : null;
  });
}

cuando("A — IDOR vertical portal (comprobante ↔ liquidación)", () => {
  beforeAll(async () => { await sembrarPortal(); });
  afterAll(async () => {
    if (!prisma || !idContratoP) return;
    await comoTenant(tenantA, async (tx) => {
      const c = await tx.contrato.findFirst({ where: { id: idContratoP }, select: { propiedadId: true } });
      await tx.voucher.deleteMany({ where: { contratoId: idContratoP } });
      await tx.contrato.deleteMany({ where: { id: idContratoP } });
      if (c) await tx.propiedad.deleteMany({ where: { id: c.propiedadId } });
    });
  });

  it("A3 — el arrendatario NO alcanza la liquidación (lleva la cuenta del propietario)", async () => {
    const r = await comoPortalVoucher("arrendatario", idArr, idVoucherLiq);
    expect(r).toBeNull();
  });

  it("A3b — el número de cuenta secreto no sale por ninguna vía del arrendatario", async () => {
    const pago = await comoPortalVoucher("arrendatario", idArr, idVoucherPago);
    expect(JSON.stringify(pago?.snapshot ?? {})).not.toContain(SECRETO_CUENTA);
    const liq = await comoPortalVoucher("arrendatario", idArr, idVoucherLiq);
    expect(liq).toBeNull();
  });

  it("A4 — el propietario NO alcanza el comprobante de pago del arrendatario", async () => {
    const r = await comoPortalVoucher("propietario", idProp, idVoucherPago);
    expect(r).toBeNull();
  });

  it("cada parte SÍ alcanza el documento que le corresponde", async () => {
    const pagoArr = await comoPortalVoucher("arrendatario", idArr, idVoucherPago);
    expect(pagoArr?.id).toBe(idVoucherPago);
    if (idProp !== idArr) {
      const liqProp = await comoPortalVoucher("propietario", idProp, idVoucherLiq);
      expect(liqProp?.id).toBe(idVoucherLiq);
    }
  });

  it("un tercero (otra persona) no alcanza ninguno de los dos", async () => {
    const otra = await comoTenant(tenantB, (tx) =>
      tx.persona.findFirst({ where: { tenantId: tenantB }, select: { id: true } }));
    const a = await comoPortalVoucher("arrendatario", otra!.id, idVoucherPago);
    const b = await comoPortalVoucher("propietario", otra!.id, idVoucherLiq);
    expect(a).toBeNull();
    expect(b).toBeNull();
  });
});
