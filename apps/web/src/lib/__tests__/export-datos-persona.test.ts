/**
 * Derecho de acceso / portabilidad — `construirExportDatosPersona` (L-DP2/L-DP3).
 *
 * La parte de formato es pura. El armado toca base: se siembra una persona con
 * un contrato, su contraparte, un período y un comprobante, y se comprueba que
 *   · el export trae los datos de la persona;
 *   · la contraparte aparece SOLO por su nombre (sin RUT ni contacto);
 *   · pedir una persona de otra corredora lanza `PersonaNoEncontrada`.
 *
 * Si la base no está levantada, la parte de integración se salta.
 */
import "dotenv/config";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import {
  construirExportDatosPersona,
  nombreArchivoExport,
  PersonaNoEncontrada,
} from "../export-datos-persona";

describe("nombreArchivoExport", () => {
  it("arma el nombre con el RUT limpio y la fecha", () => {
    const n = nombreArchivoExport("11.111.111-1", "json");
    expect(n).toMatch(/^datos-personales-11111111-1-\d{4}-\d{2}-\d{2}\.json$/);
  });
  it("respeta la extensión pedida", () => {
    expect(nombreArchivoExport("5.126.663-3", "pdf")).toMatch(/\.pdf$/);
  });
});

let prisma: PrismaClient | null = null;
let tenantA = "";
let tenantB = "";
const MARCA = 2089;
const RUT_TITULAR = "EXPORT-QA";
let idPersona = "";
let idContraparte = "";
let idPropiedad = "";
let idContrato = "";

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
  if (tenants.length < 2) return false;
  tenantA = tenants[0].id;
  tenantB = tenants[1].id;
  return true;
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

cuando("construirExportDatosPersona", () => {
  beforeAll(async () => {
    await comoTenant(tenantA, async (tx) => {
      const p = await tx.persona.create({
        data: { tenantId: tenantA, rut: "EXPORT-QA-1", nombre: "Persona Export QA", email: "export.qa@local", telefono: "+56 9 0000 0000" },
        select: { id: true },
      });
      idPersona = p.id;
      const cp = await tx.persona.create({
        data: { tenantId: tenantA, rut: "EXPORT-QA-2", nombre: "Contraparte Export QA", email: "otra.qa@local", telefono: "+56 9 1111 1111" },
        select: { id: true },
      });
      idContraparte = cp.id;
      const prop = await tx.propiedad.create({
        data: { tenantId: tenantA, propietarioId: cp.id, tipo: "casa", rol: `EX-${MARCA}-1`, direccion: "Export QA 123", comuna: "Ñuñoa" },
        select: { id: true },
      });
      idPropiedad = prop.id;
      const c = await tx.contrato.create({
        data: {
          tenantId: tenantA, propiedadId: prop.id,
          arrendatarioId: idPersona, propietarioId: cp.id,
          estado: "vigente", denominacion: "CLP", valorArriendo: 450000,
          diaVencimiento: 5, fechaInicio: new Date(`${MARCA}-01-05`),
        },
        select: { id: true },
      });
      idContrato = c.id;
      await tx.periodoPago.create({
        data: {
          tenantId: tenantA, contratoId: c.id, numero: 1,
          fechaInicio: new Date(`${MARCA}-01-05`), fechaVencimiento: new Date(`${MARCA}-02-05`),
          montoBase: 450000, estado: "pagado", fechaPagoReal: new Date(`${MARCA}-02-03`),
        },
      });
      await tx.voucher.create({
        data: {
          tenantId: tenantA, contratoId: c.id, arrendatarioId: idPersona,
          tipo: "pago", montoClp: 450000, fecha: new Date(`${MARCA}-02-03`),
          folio: `CP-${MARCA}-00001`, snapshot: { emisor: { nombre: "QA" } },
        },
      });
      await tx.cuentaBancaria.create({
        data: {
          tenantId: tenantA, personaId: idPersona, banco: "Banco QA",
          tipo: "corriente", numero: "1234567", titular: "Persona Export QA", rutTitular: RUT_TITULAR,
        },
      });
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await comoTenant(tenantA, async (tx) => {
      await tx.voucher.deleteMany({ where: { contratoId: idContrato } });
      await tx.periodoPago.deleteMany({ where: { contratoId: idContrato } });
      await tx.cuentaBancaria.deleteMany({ where: { rutTitular: RUT_TITULAR } });
      await tx.contrato.deleteMany({ where: { id: idContrato } });
      await tx.propiedad.deleteMany({ where: { id: idPropiedad } });
      await tx.persona.deleteMany({ where: { id: { in: [idPersona, idContraparte] } } });
    });
    await prisma.$disconnect();
  });

  it("trae la identidad y el contrato de la persona", async () => {
    const exp = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idPersona));
    expect(exp.identidad.rut).toBe("EXPORT-QA-1");
    expect(exp.identidad.email).toBe("export.qa@local");
    expect(exp.contratos).toHaveLength(1);
    expect(exp.contratos[0].rol).toBe("arrendatario");
    expect(exp.contratos[0].periodos).toHaveLength(1);
    expect(exp.contratos[0].comprobantes[0].folio).toBe(`CP-${MARCA}-00001`);
    expect(exp.cuentasBancarias[0].numero).toBe("1234567");
  });

  it("la contraparte aparece SOLO por su nombre", async () => {
    const exp = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idPersona));
    const c = exp.contratos[0];
    expect(c.contraparte).toEqual({ nombre: "Contraparte Export QA" });
    // Nada del export puede contener el RUT ni el correo de la contraparte.
    const txt = JSON.stringify(exp);
    expect(txt).not.toContain("EXPORT-QA-2");
    expect(txt).not.toContain("otra.qa@local");
    expect(txt).not.toContain("+56 9 1111 1111");
  });

  it("una persona de otra corredora → PersonaNoEncontrada", async () => {
    await expect(
      comoTenant(tenantB, (tx) => construirExportDatosPersona(tx, tenantB, idPersona)),
    ).rejects.toBeInstanceOf(PersonaNoEncontrada);
  });

  it("el meta identifica al responsable y cita la Ley 21.719", async () => {
    const exp = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idPersona));
    expect(exp.meta.responsable.nombre).toBeTruthy();
    expect(exp.meta.fundamento).toMatch(/21\.719/);
  });
});
