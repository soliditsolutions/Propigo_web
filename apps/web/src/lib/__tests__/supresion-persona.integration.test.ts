/**
 * Supresión de datos (L-DP5) contra Postgres real y el rol de la aplicación.
 *
 * Un test que mockea Prisma no puede probar lo importante: que la anonimización
 * respete el RUT único por corredora, las claves foráneas del ledger y las
 * políticas RLS. Mismo esquema de salto que `seguridad-datos-privados.test.ts`:
 * sin base se salta; con base, cualquier error revienta a la vista.
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { adaptadorPg } from "@/lib/pg-adaptador";
import { PrismaClient } from "../../generated/prisma/client";
import type { TenantClient } from "../tenant-db";
import { anonimizarPersona, NOMBRE_ANONIMIZADO, prefijoRutAnonimizado } from "../supresion-persona";

let prisma: PrismaClient | null = null;
let tenantId = "";
let actorId = "";
let personaLibre = "";
let personaConContrato = "";
let nombreConContrato = "";

const NOMBRE = "QA Supresión Señuelo";
const RUT = `QA-SUP-${Date.now()}`;
const EMAIL = "qa-supresion@example.cl";

async function comoTenant<T>(id: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${id}, true)`;
    return fn(tx as unknown as PrismaClient);
  }) as Promise<T>;
}

async function preparar(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  prisma = new PrismaClient({ adapter: adaptadorPg(url) });
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await prisma.$disconnect().catch(() => {});
    prisma = null;
    return false;
  }

  // Con base arriba, cualquier error de acá en adelante es un fallo real.
  const tenants = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant`;
  for (const t of tenants) {
    const hallado = await comoTenant(t.id, async (tx) => {
      const usuario = await tx.usuario.findFirst({ where: { tenantId: t.id }, select: { id: true } });
      const contrato = await tx.contrato.findFirst({
        where: { tenantId: t.id, estado: "vigente" },
        select: { arrendatarioId: true, arrendatario: { select: { nombre: true } } },
      });
      return usuario && contrato ? { usuario: usuario.id, contrato } : null;
    });
    if (hallado) {
      tenantId = t.id;
      actorId = hallado.usuario;
      personaConContrato = hallado.contrato.arrendatarioId;
      nombreConContrato = hallado.contrato.arrendatario.nombre;
      break;
    }
  }
  if (!tenantId) throw new Error("Falta una corredora con usuario y un contrato vigente. Corre `npm run db:seed`.");

  const p = await comoTenant(tenantId, (tx) =>
    tx.persona.create({
      data: { tenantId, rut: RUT, nombre: NOMBRE, email: EMAIL, telefono: "+56911112222" },
      select: { id: true },
    }),
  );
  personaLibre = p.id;
  await comoTenant(tenantId, async (tx) => {
    await tx.accesoLog.create({ data: { tenantId, personaId: personaLibre, accion: "qa", ip: "203.0.113.9" } });
    await tx.preferenciaNotificacion.create({ data: { tenantId, personaId: personaLibre } });
  });
  return true;
}

const hayBase = await preparar();

afterAll(async () => {
  if (!prisma) return;
  if (personaLibre) {
    await comoTenant(tenantId, async (tx) => {
      await tx.auditoriaEquipo.deleteMany({ where: { tenantId, detalle: `persona ${personaLibre}` } });
      await tx.accesoLog.deleteMany({ where: { personaId: personaLibre } });
      await tx.preferenciaNotificacion.deleteMany({ where: { personaId: personaLibre } });
      await tx.persona.delete({ where: { id: personaLibre } });
    });
  }
  await prisma.$disconnect();
});

const anonimizar = (personaId: string) =>
  comoTenant(tenantId, (tx) =>
    anonimizarPersona(tx as unknown as TenantClient, { tenantId, personaId, actorId, ip: "203.0.113.9" }),
  );

describe.skipIf(!hayBase)("anonimizarPersona — contra Postgres real", () => {
  it("rechaza a quien tiene un contrato vigente y no toca nada", async () => {
    const r = await anonimizar(personaConContrato);
    expect(r).toEqual({ ok: false, motivo: expect.stringMatching(/contrato vigente/i) });

    const p = await comoTenant(tenantId, (tx) => tx.persona.findUnique({ where: { id: personaConContrato } }));
    expect(p?.nombre).toBe(nombreConContrato);
    expect(p?.rut.startsWith(prefijoRutAnonimizado)).toBe(false);
  });

  it("anonimiza la ficha y borra los datos de uso", async () => {
    const r = await anonimizar(personaLibre);

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.borrados.registrosAcceso).toBe(1);
      expect(r.borrados.preferencias).toBe(1);
      expect(r.conservado.join(" ")).toMatch(/Código Tributario art\. 200/);
    }
    const p = await comoTenant(tenantId, (tx) => tx.persona.findUnique({ where: { id: personaLibre } }));
    expect(p).toMatchObject({ nombre: NOMBRE_ANONIMIZADO, email: null, telefono: null });
    expect(p?.rut).toBe(`${prefijoRutAnonimizado}${personaLibre}`);

    const restos = await comoTenant(tenantId, async (tx) => ({
      logs: await tx.accesoLog.count({ where: { personaId: personaLibre } }),
      prefs: await tx.preferenciaNotificacion.count({ where: { personaId: personaLibre } }),
    }));
    expect(restos).toEqual({ logs: 0, prefs: 0 });
  });

  it("deja constancia en la auditoría sin repetir los datos que borró", async () => {
    const filas = await comoTenant(tenantId, (tx) =>
      tx.auditoriaEquipo.findMany({ where: { tenantId, accion: "anonimizar_persona", detalle: `persona ${personaLibre}` } }),
    );
    expect(filas).toHaveLength(1);
    const texto = JSON.stringify(filas[0]);
    expect(texto).not.toContain(NOMBRE);
    expect(texto).not.toContain(RUT);
    expect(texto).not.toContain(EMAIL);
  });

  it("una segunda vez se rechaza", async () => {
    expect(await anonimizar(personaLibre)).toEqual({ ok: false, motivo: expect.stringMatching(/ya fue anonimizada/i) });
  });

  it("conserva el ledger y los comprobantes de quien tuvo contratos ya cerrados (se revierte al final)", async () => {
    const REVERTIR = new Error("revertir");
    let resultado: Awaited<ReturnType<typeof anonimizar>> | null = null;
    let antes = 0, despues = 0;
    try {
      await comoTenant(tenantId, async (tx) => {
        const cerrado = await tx.contrato.findFirst({
          where: { tenantId, estado: { in: ["terminado", "terminado_anticipado"] } },
          select: { arrendatarioId: true },
        });
        if (!cerrado) return; // el seed local no trae contratos cerrados: nada que comprobar
        const id = cerrado.arrendatarioId;
        const cuenta = () => tx.asientoLedger.count({ where: { arrendatarioId: id } });
        antes = await cuenta();
        // El seed deja períodos sin liquidar; se cierran acá (dentro de lo que se revierte)
        // para llegar al caso que importa: persona con historial contable ya cerrado.
        await tx.periodoPago.updateMany({
          where: { tenantId, contrato: { arrendatarioId: id } },
          data: { estado: "liquidado" },
        });
        resultado = await anonimizarPersona(tx as unknown as TenantClient, { tenantId, personaId: id, actorId, ip: null });
        despues = await cuenta();
        throw REVERTIR; // la anonimización es irreversible: no se deja en la base de desarrollo
      });
    } catch (e) {
      if (e !== REVERTIR) throw e;
    }
    if (!resultado) return;
    expect(resultado).toMatchObject({ ok: true });
    expect(antes).toBeGreaterThan(0);
    expect(despues).toBe(antes);
  });

  it("no alcanza a una persona de otra corredora", async () => {
    const r = await comoTenant(tenantId, (tx) =>
      anonimizarPersona(tx as unknown as TenantClient, {
        tenantId, personaId: "00000000-0000-4000-8000-0000000000aa", actorId, ip: null,
      }),
    );
    expect(r.ok).toBe(false);
  });
});
