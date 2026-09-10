/**
 * Devolución de garantía con detalle de retenciones (L-CM5 / P-GA3 / P-GA5).
 *
 * El cálculo es puro. Lo que importa probar: que la boleta cuadre
 * (recibido + reajuste − retenido = devuelto), que el exceso de retenciones
 * sobre la garantía quede como saldo pendiente y no como devolución negativa,
 * y que el validador rechace lo malformado.
 */
import { describe, it, expect } from "vitest";
import {
  validarRetenciones,
  calcularDevolucionGarantia,
} from "../garantia-devolucion";
import { construirSnapshotGarantia } from "../comprobante";

describe("validarRetenciones", () => {
  it("acepta un listado vacío (se devuelve todo)", () => {
    expect(validarRetenciones([])).toBeNull();
  });
  it("rechaza una retención sin motivo", () => {
    expect(validarRetenciones([{ descripcion: "  ", montoClp: 1000 }])).toMatch(/motivo/i);
  });
  it("rechaza un monto no entero, cero o negativo", () => {
    expect(validarRetenciones([{ descripcion: "x", montoClp: 0 }])).toMatch(/entero/i);
    expect(validarRetenciones([{ descripcion: "x", montoClp: -5 }])).toMatch(/entero/i);
    expect(validarRetenciones([{ descripcion: "x", montoClp: 10.5 }])).toMatch(/entero/i);
  });
  it("rechaza un motivo larguísimo", () => {
    expect(validarRetenciones([{ descripcion: "a".repeat(201), montoClp: 1 }])).toMatch(/largo/i);
  });
});

describe("calcularDevolucionGarantia", () => {
  it("sin retenciones: se devuelve toda la garantía", () => {
    const d = calcularDevolucionGarantia({ garantiaDisponibleClp: 500_000, retenciones: [] });
    expect(d.retenidoDeGarantiaClp).toBe(0);
    expect(d.devolucionClp).toBe(500_000);
    expect(d.saldoPendienteArrendatarioClp).toBe(0);
  });

  it("retenciones dentro de la garantía: cuadra", () => {
    const d = calcularDevolucionGarantia({
      garantiaDisponibleClp: 500_000,
      retenciones: [
        { descripcion: "Pintura living", montoClp: 120_000 },
        { descripcion: "Reposición llaves", montoClp: 30_000 },
      ],
    });
    expect(d.retencionesTotalClp).toBe(150_000);
    expect(d.retenidoDeGarantiaClp).toBe(150_000);
    expect(d.devolucionClp).toBe(350_000);
    expect(d.saldoPendienteArrendatarioClp).toBe(0);
    // recibido = retenido + devuelto
    expect(d.retenidoDeGarantiaClp + d.devolucionClp).toBe(d.garantiaDisponibleClp);
    // cada ítem quedó íntegramente cubierto
    expect(d.retenciones.every((r) => r.cubiertoPorGarantiaClp === r.montoClp)).toBe(true);
  });

  it("retenciones que EXCEDEN la garantía: el sobrante es saldo pendiente, la devolución no baja de 0", () => {
    const d = calcularDevolucionGarantia({
      garantiaDisponibleClp: 200_000,
      retenciones: [
        { descripcion: "Daño muro", montoClp: 150_000 },
        { descripcion: "Reparación puerta", montoClp: 100_000 },
      ],
    });
    expect(d.retencionesTotalClp).toBe(250_000);
    expect(d.retenidoDeGarantiaClp).toBe(200_000);
    expect(d.devolucionClp).toBe(0);
    expect(d.saldoPendienteArrendatarioClp).toBe(50_000);
    // el primer ítem se cubre entero, el segundo solo en parte
    expect(d.retenciones[0].cubiertoPorGarantiaClp).toBe(150_000);
    expect(d.retenciones[1].cubiertoPorGarantiaClp).toBe(50_000);
    // invariante: Σ cubierto = retenido de garantía
    expect(d.retenciones.reduce((s, r) => s + r.cubiertoPorGarantiaClp, 0)).toBe(d.retenidoDeGarantiaClp);
  });

  it("reajuste UF: se refleja en el disponible, la boleta sigue cuadrando", () => {
    const d = calcularDevolucionGarantia({
      garantiaDisponibleClp: 520_000, reajusteClp: 20_000,
      retenciones: [{ descripcion: "Aseo", montoClp: 40_000 }],
    });
    expect(d.reajusteClp).toBe(20_000);
    expect(d.retenidoDeGarantiaClp + d.devolucionClp).toBe(520_000);
    expect(d.devolucionClp).toBe(480_000);
  });
});

describe("construirSnapshotGarantia — P-GA5: el snapshot cuadra", () => {
  const base = {
    folio: "GA-2026-00001",
    fecha: new Date("2026-09-10"),
    emisor: { nombre: "Corredora", rut: "76000000-0", giro: null, direccion: null, esPersonaJuridica: true },
    inmueble: { direccion: "Calle 1", comuna: "Ñuñoa", rol: "123-4", avaluoFiscalClp: null },
    arrendatario: { nombre: "Arr", rut: "11111111-1" },
    propietario: { nombre: "Prop", rut: "22222222-2" },
    causalTermino: "vencimiento_plazo",
    tipoTermino: "normal" as const,
    fechaTermino: new Date("2026-09-10"),
  };

  it("recibido + reajuste − retenido = devuelto", () => {
    const s = construirSnapshotGarantia({
      ...base,
      garantiaRecibidaClp: 500_000,
      garantiaDenominacion: "CLP",
      garantiaMontoBase: null,
      garantiaDisponibleClp: 500_000,
      retenciones: [{ descripcion: "Pintura", montoClp: 80_000 }],
    });
    expect(s.tipo).toBe("garantia");
    expect(s.garantiaRecibidaClp + s.reajusteClp - s.retenidoDeGarantiaClp).toBe(s.devolucionClp);
    expect(s.devolucionClp).toBe(420_000);
    expect(s.saldoPendienteArrendatarioClp).toBe(0);
  });

  it("garantía UF revalorizada: el reajuste entra en el cuadre", () => {
    const s = construirSnapshotGarantia({
      ...base,
      garantiaRecibidaClp: 480_000,
      garantiaDenominacion: "UF",
      garantiaMontoBase: 12,
      garantiaDisponibleClp: 500_000, // revalorizada a la UF de hoy
      retenciones: [],
    });
    expect(s.reajusteClp).toBe(20_000);
    expect(s.garantiaRecibidaClp + s.reajusteClp).toBe(s.garantiaDisponibleClp);
    expect(s.devolucionClp).toBe(500_000);
  });
});
