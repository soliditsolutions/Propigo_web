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
import { renderToBuffer } from "@react-pdf/renderer";
import {
  construirExportDatosPersona,
  nombreArchivoExport,
  PersonaNoEncontrada,
  type ExportDatosPersona,
} from "../export-datos-persona";
import { ExportDatosPersonaDocument } from "../export-datos-persona-pdf";

describe("nombreArchivoExport", () => {
  it("arma el nombre con el RUT limpio y la fecha", () => {
    const n = nombreArchivoExport("11.111.111-1", "json");
    expect(n).toMatch(/^datos-personales-11111111-1-\d{4}-\d{2}-\d{2}\.json$/);
  });
  it("respeta la extensión pedida", () => {
    expect(nombreArchivoExport("5.126.663-3", "pdf")).toMatch(/\.pdf$/);
  });
});

describe("ExportDatosPersonaDocument — D3 inyección en el PDF", () => {
  it("un nombre/dirección con <script>, </Text> y & no rompe el render", async () => {
    const mal = "<script>alert(1)</script> </Text> & { } \"x\"";
    const datos: ExportDatosPersona = {
      meta: { generadoEl: new Date().toISOString(), fundamento: "Ley 21.719", responsable: { nombre: mal, rut: "1-9" }, alcance: mal },
      identidad: { nombre: mal, rut: mal, email: mal, telefono: mal, canalDeAccesoPreferido: mal, registradaEl: new Date().toISOString() },
      contratos: [{
        rol: "arrendatario", estado: "vigente",
        inmueble: { direccion: mal, comuna: mal, rolAvaluo: mal },
        contraparte: { nombre: mal },
        denominacion: "CLP", valorArriendo: "1", cobraGastoComun: false,
        comisionCorredorPct: "0", esAmoblado: false,
        fechaInicio: "2026-01-01", fechaFin: null, fechaTermino: null, causalTermino: null,
        firmadoAnteNotario: false,
        periodos: [{ numero: 1, vencimiento: "2026-02-01", montoBase: "1", montoGastoComun: "0", estado: "pagado", pagadoEl: "2026-01-30" }],
        comprobantes: [{ folio: mal, tipo: "pago", fecha: "2026-01-30", montoCLP: "1" }],
      }],
      cuentasBancarias: [{ banco: mal, tipo: mal, numero: mal, titular: mal, rutTitular: mal, email: mal, esDeLaCorredora: false }],
      documentos: [{ nombre: mal, tipo: mal, fecha: "2026-01-01", via: "contrato" }],
      comunicaciones: [{ fecha: new Date().toISOString(), tipo: mal, canal: mal, asunto: mal, estado: mal }],
      registrosDeAcceso: [{ fecha: new Date().toISOString(), accion: mal, ip: mal }],
      solicitudesDeCodigoDeAcceso: [{ fecha: new Date().toISOString(), canal: mal, ip: mal, usado: true }],
      reservas: [{ inmueble: mal, fechaReserva: "2026-01-01", vigenteHasta: null, estado: mal }],
      preferenciaDeNotificacion: { suscrito: true, bajaHasta: null, motivo: mal, actualizadaEl: new Date().toISOString() },
      valoraciones: [{ fecha: new Date().toISOString(), estrellas: 4, comentario: mal, visible: true }],
    };
    const buf = await renderToBuffer(ExportDatosPersonaDocument({ data: datos }));
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
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
      // Un comprobante de LIQUIDACIÓN (del propietario) sobre el mismo contrato:
      // el arrendatario NO debe verlo en su export.
      await tx.voucher.create({
        data: {
          tenantId: tenantA, contratoId: c.id, arrendatarioId: idPersona,
          tipo: "liquidacion", montoClp: 405000, fecha: new Date(`${MARCA}-02-04`),
          folio: `LQ-${MARCA}-00001`, snapshot: { emisor: { nombre: "QA" } },
        },
      });
      // Valoración vía contrato: la deja el arrendatario. En el export del
      // PROPIETARIO no debe aparecer.
      await tx.valoracionCorredor.create({
        data: {
          tenantId: tenantA, contratoId: c.id, nombre: "Persona", apellido: "Export QA",
          estrellas: 4, comentario: "OPINION-SOLO-DEL-ARRENDATARIO", esVisible: true,
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
      await tx.valoracionCorredor.deleteMany({ where: { contratoId: idContrato } });
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

  it("C2 — el arrendatario ve solo el comprobante de PAGO, no la liquidación", async () => {
    const exp = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idPersona));
    const folios = exp.contratos[0].comprobantes.map((v) => v.folio);
    expect(folios).toEqual([`CP-${MARCA}-00001`]);
    expect(JSON.stringify(exp)).not.toContain(`LQ-${MARCA}-00001`);
  });

  it("C2b — el propietario ve solo la LIQUIDACIÓN, no el comprobante de pago", async () => {
    const exp = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idContraparte));
    expect(exp.contratos[0].rol).toBe("propietario");
    const folios = exp.contratos[0].comprobantes.map((v) => v.folio);
    expect(folios).toEqual([`LQ-${MARCA}-00001`]);
    expect(JSON.stringify(exp)).not.toContain(`CP-${MARCA}-00001`);
  });

  it("C3 — la valoración solo sale en el export del arrendatario", async () => {
    const arr = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idPersona));
    expect(arr.valoraciones.map((v) => v.comentario)).toContain("OPINION-SOLO-DEL-ARRENDATARIO");

    const prop = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idContraparte));
    expect(prop.valoraciones).toHaveLength(0);
    expect(JSON.stringify(prop)).not.toContain("OPINION-SOLO-DEL-ARRENDATARIO");
  });

  it("C4 — las cuentas bancarias del export son solo las de la persona", async () => {
    const prop = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idContraparte));
    expect(prop.cuentasBancarias).toHaveLength(0); // la cuenta es del arrendatario
    const arr = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idPersona));
    expect(arr.cuentasBancarias.every((c) => c.esDeLaCorredora === false)).toBe(true);
  });

  it("D4 — un payload en el nombre se conserva como texto literal en el JSON", async () => {
    await comoTenant(tenantA, (tx) => tx.persona.update({
      where: { id: idPersona }, data: { nombre: "<script>alert(1)</script> & </Text>" },
    }));
    const exp = await comoTenant(tenantA, (tx) => construirExportDatosPersona(tx, tenantA, idPersona));
    expect(exp.identidad.nombre).toBe("<script>alert(1)</script> & </Text>");
    // JSON.stringify escapa; el string vuelve entero al parsear.
    const round = JSON.parse(JSON.stringify(exp));
    expect(round.identidad.nombre).toBe("<script>alert(1)</script> & </Text>");
    await comoTenant(tenantA, (tx) => tx.persona.update({
      where: { id: idPersona }, data: { nombre: "Persona Export QA" },
    }));
  });
});
