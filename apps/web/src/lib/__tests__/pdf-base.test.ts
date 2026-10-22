/**
 * Ningún PDF debe partir palabras con guion: el guionado por defecto de
 * react-pdf (patrones en inglés, más un corte en cada unión sin espacio entre
 * fragmentos de texto) cortaba el RUT del arrendatario en el borrador de
 * contrato como "16.444.555-0-", alterando un dato identificatorio.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const MODULOS = [
  "../aviso-termino-pdf",
  "../boleta-demo-pdf",
  "../comprobante-pdf",
  "../contrato-pdf",
  "../estado-cuenta-pdf",
  "../export-datos-persona-pdf",
  "../garantia-devolucion-pdf",
];

describe("PDF — sin guionado automático", () => {
  beforeEach(() => vi.resetModules());

  it.each(MODULOS)("%s deja cada palabra entera (RUT, folios, montos)", async (ruta) => {
    await import(ruta);
    const { Font } = await import("@react-pdf/renderer");
    const cortar = Font.getHyphenationCallback();
    expect(cortar).not.toBeNull();
    for (const palabra of ["16.444.555-0,", "Arrendadora", "GA-2026-00003", "$1.184.703"]) {
      expect(cortar!(palabra)).toEqual([palabra]);
    }
  });

  it("el Text común prohíbe los cortes con guion y respeta lo que se le pase", async () => {
    const { Text, SIN_GUIONADO } = await import("../pdf-base");
    const el = Text({ children: "RUT 16.444.555-0," }) as { props: Record<string, unknown> };
    expect(el.props.hyphenationPenalty).toBe(SIN_GUIONADO);
    expect(el.props.children).toBe("RUT 16.444.555-0,");
    const conEstilo = Text({ style: { fontSize: 9 }, fixed: true }) as { props: Record<string, unknown> };
    expect(conEstilo.props.style).toEqual({ fontSize: 9 });
    expect(conEstilo.props.fixed).toBe(true);
  });
});
