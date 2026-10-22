/**
 * La purga de retención, contra Postgres real.
 *
 * Los tests de `retencion.test.ts` comprueban que exista el borrado; este
 * comprueba que **borre**, y sobre todo que borre **solo lo vencido**. Un
 * proceso de retención que se pasa de largo destruye prueba judicial (ver
 * `documentos-de-pago-y-cumplimiento-sii.md` §5.2), así que el caso que más
 * importa acá no es el que borra sino el que NO borra.
 *
 * Va contra la base y no con mocks por el mismo motivo que el test de
 * aislamiento: un `deleteMany` mockeado no prueba que el `where` sea correcto.
 * Si la base no está levantada, el archivo se salta.
 */
import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { adaptadorPg } from "@/lib/pg-adaptador";
import { PrismaClient } from "../../generated/prisma/client";
import { purgarDatosVencidos, purgaVacia, sumarPurgas } from "../retencion-purga";
import { retencion, fechaCorte } from "../retencion";

let prisma: PrismaClient | null = null;
let tenantA = "";
let tenantB = "";
let personaA = "";
let propiedadA = "";
let usuarioA = "";

const AHORA = new Date("2026-09-03T12:00:00.000Z");
/** Un instante claramente dentro del plazo, y otro claramente fuera. */
const haceDias = (d: number) => new Date(AHORA.getTime() - d * 86_400_000);

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
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await prisma.$disconnect().catch(() => {});
    prisma = null;
    return false;
  }

  const tenants = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant LIMIT 2`;
  if (tenants.length < 2) throw new Error("Se necesitan dos corredoras. Corre `npm run db:seed`.");
  tenantA = tenants[0].id;
  tenantB = tenants[1].id;

  const ctx = await comoTenant(tenantA, async (tx) => {
    const p = await tx.persona.findFirst({ where: { tenantId: tenantA }, select: { id: true } });
    const pr = await tx.propiedad.findFirst({ where: { tenantId: tenantA }, select: { id: true } });
    const u = await tx.usuario.findFirst({ where: { tenantId: tenantA }, select: { id: true } });
    if (!p || !pr || !u) throw new Error("Falta data base; corre `npm run db:seed`.");
    return { p: p.id, pr: pr.id, u: u.id };
  });
  personaA = ctx.p; propiedadA = ctx.pr; usuarioA = ctx.u;
  return true;
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

/** Marca para reconocer y limpiar solo lo que crea este test. */
const MARCA = "qa_retencion";

async function sembrar(tenantId: string, personaId: string, propiedadId: string, usuarioId: string) {
  await comoTenant(tenantId, async (tx) => {
    const otp = retencion("otp").dias!;
    const acc = retencion("accesoPortal").dias!;
    const aud = retencion("auditoriaEquipo").dias!;
    const cod = retencion("codigosContacto").dias!;
    const sol = retencion("solicitudesDerecho").dias!;

    // Por cada categoría: uno vencido y uno dentro del plazo.
    await tx.accesoOtp.createMany({ data: [
      { tenantId, personaId, propiedadId, canal: "email", codigoHash: `${MARCA}_vencido`,
        expiraEn: haceDias(otp + 5) },
      { tenantId, personaId, propiedadId, canal: "email", codigoHash: `${MARCA}_vigente`,
        expiraEn: haceDias(0) },
    ] as never });

    await tx.accesoLog.createMany({ data: [
      { tenantId, personaId, accion: `${MARCA}_vencido`,  createdAt: haceDias(acc + 5) },
      { tenantId, personaId, accion: `${MARCA}_reciente`, createdAt: haceDias(1) },
    ] as never });

    await tx.auditoriaEquipo.createMany({ data: [
      { tenantId, actorId: usuarioId, accion: `${MARCA}_vencido`,  createdAt: haceDias(aud + 5) },
      { tenantId, actorId: usuarioId, accion: `${MARCA}_reciente`, createdAt: haceDias(1) },
    ] as never });

    await tx.codigoRectificacionPersona.createMany({ data: [
      { tenantId, personaId, campo: "email", valorNuevo: `${MARCA}_vencido@qa.local`,
        codigoHash: `${MARCA}_vencido`, expiraAt: haceDias(cod + 5) },
      { tenantId, personaId, campo: "email", valorNuevo: `${MARCA}_vigente@qa.local`,
        codigoHash: `${MARCA}_vigente`, expiraAt: haceDias(0) },
    ] as never });

    await tx.solicitudDerechoPersona.createMany({ data: [
      { tenantId, personaId, derecho: "rectificacion", detalle: `${MARCA}_vencido`, createdAt: haceDias(sol + 5) },
      { tenantId, personaId, derecho: "rectificacion", detalle: `${MARCA}_reciente`, createdAt: haceDias(1) },
    ] as never });
  });
}

async function limpiar() {
  if (!prisma) return;
  for (const t of [tenantA, tenantB].filter(Boolean)) {
    await comoTenant(t, async (tx) => {
      await tx.accesoOtp.deleteMany({ where: { codigoHash: { startsWith: MARCA } } });
      await tx.accesoLog.deleteMany({ where: { accion: { startsWith: MARCA } } });
      await tx.auditoriaEquipo.deleteMany({ where: { accion: { startsWith: MARCA } } });
      await tx.codigoRectificacionPersona.deleteMany({ where: { codigoHash: { startsWith: MARCA } } });
      await tx.solicitudDerechoPersona.deleteMany({ where: { detalle: { startsWith: MARCA } } });
    });
  }
}

afterAll(async () => {
  await limpiar();
  await prisma?.$disconnect();
});

cuando("purga lo vencido y solo lo vencido", () => {
  it("borra lo que superó el plazo y conserva lo que no", async () => {
    await limpiar();
    // Se purga ANTES de sembrar. La base local acumula datos vencidos de otras
    // pruebas —al escribir esto había 9 códigos de acceso de hace 8 días— y sin
    // este barrido previo los conteos de abajo no serían deterministas. El
    // primer intento de este test falló justamente por eso.
    await comoTenant(tenantA, (tx) => purgarDatosVencidos(tx, tenantA, AHORA));
    await sembrar(tenantA, personaA, propiedadA, usuarioA);

    const r = await comoTenant(tenantA, (tx) => purgarDatosVencidos(tx, tenantA, AHORA));

    // Borró exactamente uno de cada categoría: el vencido.
    expect(r.otp).toBe(1);
    expect(r.accesoPortal).toBe(1);
    expect(r.auditoriaEquipo).toBe(1);
    expect(r.codigosContacto).toBe(1);
    expect(r.solicitudesDerecho).toBe(1);

    // Y el que estaba dentro del plazo sigue ahí. Esta es la mitad que
    // importa: una purga que borra de más destruye prueba.
    const quedan = await comoTenant(tenantA, async (tx) => ({
      otp: await tx.accesoOtp.count({ where: { codigoHash: { startsWith: MARCA } } }),
      acc: await tx.accesoLog.count({ where: { accion: { startsWith: MARCA } } }),
      aud: await tx.auditoriaEquipo.count({ where: { accion: { startsWith: MARCA } } }),
      cod: await tx.codigoRectificacionPersona.count({ where: { codigoHash: { startsWith: MARCA } } }),
      sol: await tx.solicitudDerechoPersona.count({ where: { detalle: { startsWith: MARCA } } }),
    }));
    expect(quedan).toEqual({ otp: 1, acc: 1, aud: 1, cod: 1, sol: 1 });

    const sobrevivientes = await comoTenant(tenantA, (tx) =>
      tx.accesoLog.findMany({ where: { accion: { startsWith: MARCA } }, select: { accion: true } }));
    expect(sobrevivientes[0].accion).toContain("reciente");
  });

  it("una segunda corrida no borra nada más", async () => {
    // Idempotencia: el cron corre a diario y no debe ir comiéndose datos
    // vigentes en cada pasada.
    const r = await comoTenant(tenantA, (tx) => purgarDatosVencidos(tx, tenantA, AHORA));
    expect(r).toEqual({ otp: 0, accesoPortal: 0, auditoriaEquipo: 0, codigosContacto: 0, solicitudesDerecho: 0 });
  });

  it("justo en el límite del plazo todavía NO se borra", async () => {
    await limpiar();
    const dias = retencion("accesoPortal").dias!;
    await comoTenant(tenantA, (tx) => tx.accesoLog.create({
      data: { tenantId: tenantA, personaId: personaA, accion: `${MARCA}_limite`,
        createdAt: fechaCorte(dias, AHORA) } as never,
    }));

    const r = await comoTenant(tenantA, (tx) => purgarDatosVencidos(tx, tenantA, AHORA));
    expect(r.accesoPortal).toBe(0);
  });

  it("el OTP se mide por su expiración, no por cuándo se pidió", async () => {
    await limpiar();
    // Pedido hace mucho pero con expiración futura: no se toca.
    await comoTenant(tenantA, (tx) => tx.accesoOtp.create({
      data: { tenantId: tenantA, personaId: personaA, propiedadId: propiedadA, canal: "email",
        codigoHash: `${MARCA}_viejo_pero_vigente`, createdAt: haceDias(30),
        expiraEn: new Date(AHORA.getTime() + 600_000) } as never,
    }));

    const r = await comoTenant(tenantA, (tx) => purgarDatosVencidos(tx, tenantA, AHORA));
    expect(r.otp).toBe(0);
  });
});

cuando("la purga no cruza de corredora", () => {
  it("purgar la corredora A no toca los datos de B", async () => {
    await limpiar();
    // Solo se siembra `accesoLog`, que necesita persona y nada más. La persona
    // es propia del test: la corredora B del seed puede no tener ninguna (en
    // una base recién sembrada, como la de CI, no tiene), y depender de eso
    // ataría el test a datos cargados a mano.
    const personaB = await comoTenant(tenantB, async (tx) =>
      (await tx.persona.create({
        data: { tenantId: tenantB, rut: `${MARCA}_B`, nombre: "Retención QA (fixture)" },
        select: { id: true },
      })).id);
    try {
      const dias = retencion("accesoPortal").dias!;
      await comoTenant(tenantB, (tx) => tx.accesoLog.createMany({ data: [
        { tenantId: tenantB, personaId: personaB, accion: `${MARCA}_vencido`,  createdAt: haceDias(dias + 5) },
        { tenantId: tenantB, personaId: personaB, accion: `${MARCA}_reciente`, createdAt: haceDias(1) },
      ] as never }));

      // Se purga A, que en esta prueba no sembró nada.
      await comoTenant(tenantA, (tx) => purgarDatosVencidos(tx, tenantA, AHORA));

      // Lo de B sigue intacto, incluido lo vencido: la purga de una corredora no
      // alcanza a la otra.
      const enB = await comoTenant(tenantB, (tx) =>
        tx.accesoLog.count({ where: { accion: { startsWith: MARCA } } }));
      expect(enB).toBe(2);
    } finally {
      await limpiar();
      await comoTenant(tenantB, (tx) => tx.persona.delete({ where: { id: personaB } }));
    }
  });
});

describe("acumulador del resumen", () => {
  it("empieza en cero y suma por categoría", () => {
    expect(purgaVacia()).toEqual({ otp: 0, accesoPortal: 0, auditoriaEquipo: 0, codigosContacto: 0, solicitudesDerecho: 0 });
    expect(sumarPurgas(
      { otp: 1, accesoPortal: 2, auditoriaEquipo: 3, codigosContacto: 4, solicitudesDerecho: 5 },
      { otp: 10, accesoPortal: 20, auditoriaEquipo: 30, codigosContacto: 40, solicitudesDerecho: 50 },
    )).toEqual({ otp: 11, accesoPortal: 22, auditoriaEquipo: 33, codigosContacto: 44, solicitudesDerecho: 55 });
  });
});
