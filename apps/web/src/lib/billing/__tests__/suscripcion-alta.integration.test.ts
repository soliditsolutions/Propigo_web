/**
 * Alta de suscripción con tarjeta — contra Postgres real y el fake gateway.
 *
 * Va contra la base (no mocks) por lo mismo que los otros tests de billing: la
 * idempotencia del cargo se apoya en un índice único REAL, y un mock no prueba
 * que exista. El caso que más importa acá es que reintentar el alta NO cobre dos
 * veces —un doble cobro al corredor es de los peores fallos posibles—.
 *
 * Si la base no está levantada, el archivo se salta.
 */
import "dotenv/config";
import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { adaptadorPg } from "@/lib/pg-adaptador";
import { PrismaClient } from "../../../generated/prisma/client";
import { FakeBillingGateway } from "../fake-gateway";
import {
  activarSuscripcionConTarjeta, claveCobroSuscripcion, etiquetaPeriodo, periodoHasta,
} from "../suscripcion";

let prisma: PrismaClient | null = null;
let tenantId = "";
const UF = 39_000;
const AHORA = new Date("2026-09-15T00:00:00.000Z");

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
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant LIMIT 1`;
  if (rows.length < 1) throw new Error("Falta un tenant; corre `npm run db:seed`.");
  tenantId = rows[0].id;
  return true;
}

async function limpiarBilling() {
  if (!prisma) return;
  await comoTenant(tenantId, async (tx) => {
    // El cargo referencia la suscripción: primero los cargos de prueba.
    await tx.cargoBilling.deleteMany({ where: { tenantId, tipo: "suscripcion" } });
    await tx.suscripcionTenant.deleteMany({ where: { tenantId } });
  });
}

/** Inscribe una tarjeta en el fake y devuelve su token, como haría el retorno real. */
async function tokenTarjeta(gateway: FakeBillingGateway): Promise<string> {
  const r = await gateway.inscribirMedioPago({
    tenantId, referenciaCliente: "qa@test.local", urlRetorno: "https://x/return",
  });
  if (r.estado !== "redireccion_requerida") throw new Error("inscripción fake no devolvió token");
  return r.tokenInscripcion;
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

beforeEach(async () => { await limpiarBilling(); });
afterAll(async () => { await limpiarBilling(); await prisma?.$disconnect(); });

cuando("activarSuscripcionConTarjeta — camino feliz", () => {
  it("deja la suscripción activa, el cargo pagado y el período extendido", async () => {
    const gateway = new FakeBillingGateway();
    const token = await tokenTarjeta(gateway);

    const res = await comoTenant(tenantId, (tx) =>
      activarSuscripcionConTarjeta({
        tx, gateway, tenantId, planId: "gold", ciclo: "mensual",
        tokenInscripcion: token, valorUfClp: UF, ahora: AHORA,
      }));

    expect(res.ok).toBe(true);

    const sub = await comoTenant(tenantId, (tx) =>
      tx.suscripcionTenant.findFirst({ where: { tenantId } }));
    expect(sub?.estado).toBe("activa");
    expect(sub?.planId).toBe("gold");
    expect(sub?.medioPagoRef).toBeTruthy();
    expect(sub?.periodoActualHasta.toISOString()).toBe(periodoHasta("mensual", AHORA).toISOString());

    const cargo = await comoTenant(tenantId, (tx) =>
      tx.cargoBilling.findUnique({ where: { idempotencyKey: claveCobroSuscripcion(tenantId, etiquetaPeriodo(AHORA)) } }));
    expect(cargo?.estado).toBe("pagado");
    expect(cargo?.pagadoEn).toBeTruthy();
    expect(gateway.llamadasACobrar).toBe(1);
  });
});

cuando("activarSuscripcionConTarjeta — idempotencia", () => {
  it("reintentar el alta del mismo período NO cobra dos veces", async () => {
    const gateway = new FakeBillingGateway();
    const token = await tokenTarjeta(gateway);

    const primera = await comoTenant(tenantId, (tx) =>
      activarSuscripcionConTarjeta({
        tx, gateway, tenantId, planId: "gold", ciclo: "mensual",
        tokenInscripcion: token, valorUfClp: UF, ahora: AHORA,
      }));
    expect(primera.ok).toBe(true);

    // Segundo intento (el usuario recargó la página de retorno, p. ej.).
    const segunda = await comoTenant(tenantId, (tx) =>
      activarSuscripcionConTarjeta({
        tx, gateway, tenantId, planId: "gold", ciclo: "mensual",
        tokenInscripcion: token, valorUfClp: UF, ahora: AHORA,
      }));
    expect(segunda.ok).toBe(true);

    // Una sola suscripción y un solo cargo pagado.
    const subs = await comoTenant(tenantId, (tx) => tx.suscripcionTenant.count({ where: { tenantId } }));
    const cargos = await comoTenant(tenantId, (tx) =>
      tx.cargoBilling.count({ where: { tenantId, tipo: "suscripcion", estado: "pagado" } }));
    expect(subs).toBe(1);
    expect(cargos).toBe(1);
  });
});

cuando("activarSuscripcionConTarjeta — cobro rechazado", () => {
  it("deja el cargo fallido y la suscripción sin activar (sin acceso)", async () => {
    const gateway = new FakeBillingGateway();
    // Se inscribe con el comportamiento normal y recién ENTONCES se configura el
    // rechazo: el fake también rechaza la inscripción si ya está en modo rechazar.
    const token = await tokenTarjeta(gateway);
    gateway.configurar({ tipo: "rechazar", categoria: "rechazo", mensaje: "Sin fondos (fake)" });

    const res = await comoTenant(tenantId, (tx) =>
      activarSuscripcionConTarjeta({
        tx, gateway, tenantId, planId: "silver", ciclo: "mensual",
        tokenInscripcion: token, valorUfClp: UF, ahora: AHORA,
      }));

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reintentable).toBe(true);

    const sub = await comoTenant(tenantId, (tx) =>
      tx.suscripcionTenant.findFirst({ where: { tenantId } }));
    // Se creó la suscripción pero quedó en pago_pendiente, sin período pagado.
    expect(sub?.estado).toBe("pago_pendiente");
    expect(sub?.periodoActualHasta.toISOString()).toBe(AHORA.toISOString());

    const cargo = await comoTenant(tenantId, (tx) =>
      tx.cargoBilling.findUnique({ where: { idempotencyKey: claveCobroSuscripcion(tenantId, etiquetaPeriodo(AHORA)) } }));
    expect(cargo?.estado).toBe("fallido");
    expect(cargo?.ultimoErrorCategoria).toBe("rechazo");
  });
});

cuando("activarSuscripcionConTarjeta — plan inválido", () => {
  it("rechaza sin tocar la base cuando el plan no existe", async () => {
    const gateway = new FakeBillingGateway();
    const token = await tokenTarjeta(gateway);
    const res = await comoTenant(tenantId, (tx) =>
      activarSuscripcionConTarjeta({
        tx, gateway, tenantId, planId: "Gratuito", ciclo: "mensual",
        tokenInscripcion: token, valorUfClp: UF, ahora: AHORA,
      }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reintentable).toBe(false);
    const subs = await comoTenant(tenantId, (tx) => tx.suscripcionTenant.count({ where: { tenantId } }));
    expect(subs).toBe(0);
  });
});
