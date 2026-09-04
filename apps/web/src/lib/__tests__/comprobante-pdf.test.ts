/**
 * Generación del PDF del comprobante (L-CP5, L-CP6).
 *
 * Renderiza de verdad con @react-pdf (no un mock): un PDF que no compila no se
 * descubre en un snapshot de props. Se comprueba que el buffer sea un PDF válido
 * y que un tipo desconocido falle en vez de emitir un documento vacío.
 */
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { ComprobantePdfDocument } from "../comprobante-pdf";
import {
  construirSnapshotPago, construirSnapshotLiquidacion,
  type EmisorSnapshot, type InmuebleSnapshot, type ParteSnapshot,
} from "../comprobante";

const emisor: EmisorSnapshot = {
  nombre: "Corredora Demo SpA", rut: "76123456-0", giro: "Corretaje",
  direccion: "Av. Providencia 1234", esPersonaJuridica: true,
};
const inmueble: InmuebleSnapshot = {
  direccion: "Calle Falsa 123", comuna: "Santiago", rol: "573-24", avaluoFiscalClp: 45_000_000,
};
const arr: ParteSnapshot = { nombre: "Ana Arrendataria", rut: "11111111-1" };
const prop: ParteSnapshot = { nombre: "Pedro Propietario", rut: "22222222-2" };
const base = { fecha: new Date("2026-09-15T12:00:00Z"), periodoNumero: 3, emisor, inmueble, arrendatario: arr, propietario: prop };

const esPdf = (buf: Uint8Array) => Buffer.from(buf.slice(0, 5)).toString("latin1") === "%PDF-";

describe("ComprobantePdfDocument", () => {
  it("renderiza el comprobante de pago como PDF válido", async () => {
    const snap = construirSnapshotPago({
      ...base, folio: "CP-2026-00001",
      arriendoClp: 450_000, interesClp: 9_000, diasAtraso: 12,
      montoGastoComunClp: 45_000, denominacion: "CLP", totalClp: 504_000,
    });
    const buf = await renderToBuffer(ComprobantePdfDocument({ snapshot: snap }));
    expect(esPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("renderiza la liquidación (comisión afecta a IVA) como PDF válido", async () => {
    const snap = construirSnapshotLiquidacion({
      ...base, folio: "LQ-2026-00001",
      arriendoClp: 450_000, comisionClp: 45_000,
      descuentoPropietarioClp: 30_000, netoPropietarioClp: 366_450,
      ajustes: [{ tipo: "descuento_propietario", descripcion: "Reparación", montoClp: 30_000 }],
    });
    const buf = await renderToBuffer(ComprobantePdfDocument({ snapshot: snap }));
    expect(esPdf(buf)).toBe(true);
  });

  it("renderiza la liquidación de una persona natural (comisión exenta)", async () => {
    const snap = construirSnapshotLiquidacion({
      ...base, folio: "LQ-2026-00002",
      emisor: { ...emisor, esPersonaJuridica: false },
      arriendoClp: 450_000, comisionClp: 45_000,
      descuentoPropietarioClp: 0, netoPropietarioClp: 405_000, ajustes: [],
    });
    const buf = await renderToBuffer(ComprobantePdfDocument({ snapshot: snap }));
    expect(esPdf(buf)).toBe(true);
  });

  it("comprobante de pago amoblado (con desglose de IVA incluido) renderiza", async () => {
    const snap = construirSnapshotPago({
      ...base, folio: "CP-2026-00050", esAmoblado: true,
      arriendoClp: 800_000, interesClp: 0, diasAtraso: 0,
      montoGastoComunClp: 0, denominacion: "CLP", totalClp: 800_000,
    });
    expect(snap.ivaArriendo).toBeDefined();
    const buf = await renderToBuffer(ComprobantePdfDocument({ snapshot: snap }));
    expect(esPdf(buf)).toBe(true);
  });

    it("un tipo desconocido falla en vez de emitir un PDF vacío", () => {
    // Guard contra un snapshot corrupto: mejor un error visible que un documento
    // en blanco que parezca válido.
    expect(() =>
      ComprobantePdfDocument({ snapshot: { tipo: "otro" } as never }),
    ).toThrow(/desconocido/i);
  });
});
