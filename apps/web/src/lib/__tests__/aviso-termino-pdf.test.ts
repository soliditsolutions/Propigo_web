/**
 * Aviso de término en PDF (L-CM2, L-CM3).
 *
 * Renderiza de verdad con @react-pdf: prueba que el documento compile para los
 * dos caminos —desahucio con plazo calculado, y una causal sin plazo— y que la
 * advertencia legal (L-CM3) esté en el texto de origen.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { AvisoTerminoDocument, type AvisoTerminoData } from "../aviso-termino-pdf";

// Render real con @react-pdf (fuentes y layout): el primero de cada proceso
// puede tardar más de los 5 s por defecto cuando la suite corre en paralelo.
vi.setConfig({ testTimeout: 20_000 });

const base: AvisoTerminoData = {
  emisor: { nombre: "Corredora Demo SpA", rut: "76123456-0", giro: "Corretaje", direccion: "Av. Providencia 1234" },
  arrendatario: { nombre: "Ana Arrendataria", rut: "11111111-1" },
  propietario:  { nombre: "Pedro Propietario", rut: "22222222-2" },
  inmueble: { direccion: "Calle Falsa 123", comuna: "Santiago", rol: "573-24" },
  causal: "desahucio_arrendador",
  fechaTermino: new Date("2026-09-15"),
  fechaInicio: new Date("2024-01-01"),
  fechaNotificacionDesahucio: new Date("2026-07-15"),
  generadoEl: new Date("2026-07-15"),
};

const esPdf = (buf: Uint8Array) => Buffer.from(buf.slice(0, 5)).toString("latin1") === "%PDF-";

describe("AvisoTerminoDocument", () => {
  it("desahucio del arrendador (con plazo de restitución) renderiza", async () => {
    const buf = await renderToBuffer(AvisoTerminoDocument({ data: base }));
    expect(esPdf(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("mutuo acuerdo (sin plazo de restitución) renderiza", async () => {
    const buf = await renderToBuffer(AvisoTerminoDocument({
      data: { ...base, causal: "mutuo_acuerdo", fechaNotificacionDesahucio: null },
    }));
    expect(esPdf(buf)).toBe(true);
  });

  it("no pago de renta renderiza", async () => {
    const buf = await renderToBuffer(AvisoTerminoDocument({
      data: { ...base, causal: "no_pago_renta", fechaNotificacionDesahucio: null },
    }));
    expect(esPdf(buf)).toBe(true);
  });

  it("el documento incluye la advertencia legal de que no surte efecto por correo (L-CM3)", () => {
    // Se verifica en la fuente: el texto del aviso debe existir, no depender de
    // que alguien lo lea del PDF renderizado.
    const src = readFileSync(join(process.cwd(), "src", "lib", "aviso-termino-pdf.tsx"), "utf8");
    expect(src).toMatch(/no surte efecto\s+legal por sí solo ni por correo/i);
    expect(src).toMatch(/notificarse judicialmente o mediante notario/i);
  });
});
