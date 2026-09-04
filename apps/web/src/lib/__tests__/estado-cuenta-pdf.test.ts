/**
 * Estado de cuenta de deuda en PDF (L-CM1). Renderiza de verdad con @react-pdf.
 */
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { EstadoCuentaDocument } from "../estado-cuenta-pdf";
import { construirEstadoCuenta } from "../estado-cuenta";

const esPdf = (buf: Uint8Array) => Buffer.from(buf.slice(0, 5)).toString("latin1") === "%PDF-";

const ec = construirEstadoCuenta(
  [
    { numero: 7, fechaVencimiento: new Date("2026-08-05"), arriendoClp: 450_000, gastoComunClp: 45_000 },
    { numero: 8, fechaVencimiento: new Date("2026-09-05"), arriendoClp: 450_000, gastoComunClp: 45_000 },
  ],
  { moraTasaPctMensual: 3, moraDiasGracia: 5 },
  new Date("2026-09-30T00:00:00Z"),
);

const data = {
  emisor: { nombre: "Corredora Demo SpA", rut: "76123456-0", giro: "Corretaje", direccion: "Av. Providencia 1234" },
  arrendatario: { nombre: "Ana Arrendataria", rut: "11111111-1" },
  propietario:  { nombre: "Pedro Propietario", rut: "22222222-2" },
  inmueble: { direccion: "Calle Falsa 123", comuna: "Santiago", rol: "573-24" },
  estadoCuenta: ec,
};

describe("EstadoCuentaDocument", () => {
  it("renderiza el estado de cuenta como PDF válido", async () => {
    const buf = await renderToBuffer(EstadoCuentaDocument({ data }));
    expect(esPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });
});
