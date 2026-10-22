/**
 * Comprobante de devolución de garantía en PDF (L-CM5).
 * El render en sí se prueba aquí; la fidelidad del contenido, en el snapshot.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { DevolucionGarantiaDocument } from "../garantia-devolucion-pdf";
import { construirSnapshotGarantia } from "../comprobante";

// Render real con @react-pdf (fuentes y layout): el primero de cada proceso
// puede tardar más de los 5 s por defecto cuando la suite corre en paralelo.
vi.setConfig({ testTimeout: 20_000 });

const snap = (over: Partial<Parameters<typeof construirSnapshotGarantia>[0]> = {}) =>
  construirSnapshotGarantia({
    folio: "GA-2026-00001",
    fecha: new Date("2026-09-10"),
    emisor: { nombre: "Corredora Demo", rut: "76000000-0", giro: "Corretaje", direccion: "Av. 1", esPersonaJuridica: true },
    inmueble: { direccion: "Los Aromos 1234", comuna: "Ñuñoa", rol: "2145-18", avaluoFiscalClp: null },
    arrendatario: { nombre: "Pedro Arrendatario", rut: "15111222-6" },
    propietario: { nombre: "Juan Propietario", rut: "12345678-5" },
    causalTermino: "vencimiento_plazo",
    tipoTermino: "normal",
    fechaTermino: new Date("2026-09-10"),
    garantiaRecibidaClp: 500_000,
    garantiaDenominacion: "CLP",
    garantiaMontoBase: null,
    garantiaDisponibleClp: 500_000,
    retenciones: [{ descripcion: "Pintura del living", montoClp: 120_000 }],
    ...over,
  });

describe("DevolucionGarantiaDocument", () => {
  it("genera un PDF válido para el caso con retenciones", async () => {
    const buf = await renderToBuffer(DevolucionGarantiaDocument({ snapshot: snap() }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1500);
  });

  it("genera un PDF válido cuando se devuelve todo (sin retenciones)", async () => {
    const buf = await renderToBuffer(DevolucionGarantiaDocument({ snapshot: snap({ retenciones: [] }) }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("genera un PDF válido con saldo pendiente (retenciones > garantía)", async () => {
    const s = snap({
      garantiaDisponibleClp: 200_000,
      retenciones: [{ descripcion: "Daño estructural", montoClp: 350_000 }],
    });
    expect(s.saldoPendienteArrendatarioClp).toBe(150_000);
    const buf = await renderToBuffer(DevolucionGarantiaDocument({ snapshot: s }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("inyección: <script>, </Text>, & en el motivo y en los nombres no rompe el render", async () => {
    const mal = "<script>alert(1)</script> </Text> & { } \"x\"";
    const s = snap({
      emisor: { nombre: mal, rut: mal, giro: mal, direccion: mal, esPersonaJuridica: true },
      inmueble: { direccion: mal, comuna: mal, rol: mal, avaluoFiscalClp: null },
      arrendatario: { nombre: mal, rut: mal },
      propietario: { nombre: mal, rut: mal },
      retenciones: [{ descripcion: mal, montoClp: 50_000 }],
    });
    const buf = await renderToBuffer(DevolucionGarantiaDocument({ snapshot: s }));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
