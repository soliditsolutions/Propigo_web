/**
 * Contenido de los comprobantes (L-CP1, L-CP2, L-CP3, L-IV2).
 *
 * Lo que se prueba acá es que el snapshot lleve TODO lo que el documento debe
 * imprimir: emisor, inmueble, partes, y el desglose completo con los ajustes uno
 * por uno. Un documento que no puede reconstruir sus números no sirve como
 * prueba en el monitorio (Ley 21.461).
 */
import { describe, it, expect } from "vitest";
import {
  construirSnapshotPago, construirSnapshotLiquidacion, PIE_COMPROBANTE,
  type EmisorSnapshot, type InmuebleSnapshot, type ParteSnapshot,
} from "../comprobante";

const emisorSpA: EmisorSnapshot = {
  nombre: "Corredora Demo SpA", rut: "76123456-0", giro: "Corretaje",
  direccion: "Av. Providencia 1234", esPersonaJuridica: true,
};
const emisorNatural: EmisorSnapshot = {
  nombre: "Juan Corredor", rut: "16358920-6", giro: null,
  direccion: null, esPersonaJuridica: false,
};
const inmueble: InmuebleSnapshot = {
  direccion: "Calle Falsa 123", comuna: "Santiago", rol: "573-24", avaluoFiscalClp: 45_000_000,
};
const arr: ParteSnapshot = { nombre: "Ana Arrendataria", rut: "11111111-1" };
const prop: ParteSnapshot = { nombre: "Pedro Propietario", rut: "22222222-2" };

const base = {
  fecha: new Date("2026-09-15T12:00:00Z"),
  periodoNumero: 3,
  emisor: emisorSpA, inmueble, arrendatario: arr, propietario: prop,
};

describe("construirSnapshotPago", () => {
  it("congela emisor, inmueble y partes al momento del hecho (L-CP3)", () => {
    const snap = construirSnapshotPago({
      ...base, folio: "CP-2026-00001",
      arriendoClp: 450_000, interesClp: 0, diasAtraso: 0,
      montoGastoComunClp: 0, denominacion: "CLP", totalClp: 450_000,
    });
    expect(snap.emisor.rut).toBe("76123456-0");
    expect(snap.inmueble.rol).toBe("573-24");           // L-CP9: el rol va en el comprobante
    expect(snap.inmueble.avaluoFiscalClp).toBe(45_000_000);
    expect(snap.arrendatario.nombre).toBe("Ana Arrendataria");
    expect(snap.propietario.rut).toBe("22222222-2");
    expect(snap.folio).toBe("CP-2026-00001");
    expect(snap.fecha).toBe("2026-09-15T12:00:00.000Z");
  });

  it("guarda mora y gasto común cuando existen", () => {
    const snap = construirSnapshotPago({
      ...base, folio: "CP-2026-00002",
      arriendoClp: 450_000, interesClp: 9_000, diasAtraso: 12,
      montoGastoComunClp: 45_000, denominacion: "CLP", totalClp: 504_000,
    });
    expect(snap.interesClp).toBe(9_000);
    expect(snap.diasAtraso).toBe(12);
    expect(snap.montoGastoComunClp).toBe(45_000);
    expect(snap.totalClp).toBe(504_000);
  });

  it("los ajustes por defecto son una lista vacía, no undefined (L-CP1)", () => {
    const snap = construirSnapshotPago({
      ...base, folio: "CP-2026-00003",
      arriendoClp: 450_000, interesClp: 0, diasAtraso: 0,
      montoGastoComunClp: 0, denominacion: "CLP", totalClp: 450_000,
    });
    expect(snap.ajustes).toEqual([]);
  });

  it("incluye la UF aplicada solo cuando la hay", () => {
    const conUf = construirSnapshotPago({
      ...base, folio: "CP-2026-00004", arriendoClp: 450_000, interesClp: 0,
      diasAtraso: 0, montoGastoComunClp: 0, denominacion: "UF", ufAplicada: 39_000, totalClp: 450_000,
    });
    expect(conUf.ufAplicada).toBe(39_000);
    const sinUf = construirSnapshotPago({
      ...base, folio: "CP-2026-00005", arriendoClp: 450_000, interesClp: 0,
      diasAtraso: 0, montoGastoComunClp: 0, denominacion: "CLP", totalClp: 450_000,
    });
    expect(sinUf.ufAplicada).toBeUndefined();
  });
});

describe("construirSnapshotLiquidacion", () => {
  const ajustes = [
    { tipo: "descuento_propietario", descripcion: "Reparación gasfitería", montoClp: 30_000 },
    { tipo: "retencion", descripcion: "Retención garantía parcial", montoClp: 20_000 },
  ];

  it("guarda los ajustes uno por uno, con su descripción (L-CP2)", () => {
    const snap = construirSnapshotLiquidacion({
      ...base, folio: "LQ-2026-00001",
      arriendoClp: 450_000, comisionClp: 45_000,
      descuentoPropietarioClp: 50_000, netoPropietarioClp: 355_000, ajustes,
    });
    expect(snap.ajustes).toHaveLength(2);
    expect(snap.ajustes[0].descripcion).toBe("Reparación gasfitería");
    expect(snap.ajustes[1].montoClp).toBe(20_000);
  });

  it("una corredora persona jurídica emite comisión AFECTA a IVA (L-IV1/L-IV2)", () => {
    const snap = construirSnapshotLiquidacion({
      ...base, folio: "LQ-2026-00002", emisor: emisorSpA,
      arriendoClp: 450_000, comisionClp: 45_000,
      descuentoPropietarioClp: 0, netoPropietarioClp: 405_000, ajustes: [],
    });
    expect(snap.comisionAfectaIva).toBe(true);
    expect(snap.ivaComisionClp).toBe(Math.round((45_000 * 19) / 100));
  });

  it("una corredora persona natural emite comisión EXENTA (Art. 12 E N°8)", () => {
    const snap = construirSnapshotLiquidacion({
      ...base, folio: "LQ-2026-00003", emisor: emisorNatural,
      arriendoClp: 450_000, comisionClp: 45_000,
      descuentoPropietarioClp: 0, netoPropietarioClp: 405_000, ajustes: [],
    });
    expect(snap.comisionAfectaIva).toBe(false);
    expect(snap.ivaComisionClp).toBe(0);
  });

  it("conserva el neto al propietario y la comisión", () => {
    const snap = construirSnapshotLiquidacion({
      ...base, folio: "LQ-2026-00004",
      arriendoClp: 450_000, comisionClp: 45_000,
      descuentoPropietarioClp: 50_000, netoPropietarioClp: 355_000, ajustes,
    });
    expect(snap.comisionClp).toBe(45_000);
    expect(snap.netoPropietarioClp).toBe(355_000);
    expect(snap.descuentoPropietarioClp).toBe(50_000);
  });
});

describe("pie del comprobante (L-CP10)", () => {
  it("deja claro que no es un documento tributario", () => {
    expect(PIE_COMPROBANTE).toMatch(/no constituye documento tributario/i);
  });
});
