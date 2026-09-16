/**
 * Registro de actividades de tratamiento (L-DP8).
 *
 * Lo que importa probar no es la prosa: es que el registro no pueda mentir.
 * Cada `retencionClaves` tiene que resolver a una fila real de `RETENCIONES`
 * —la misma fuente que aplica la purga automática—, así que un plazo nunca
 * puede quedar declarado acá sin que el sistema lo cumpla de verdad.
 */
import { describe, it, expect } from "vitest";
import { ACTIVIDADES_TRATAMIENTO, retencionesDe } from "../registro-tratamiento";
import { RETENCIONES } from "../retencion";

describe("ACTIVIDADES_TRATAMIENTO", () => {
  it("toda actividad tiene finalidad, base legal, datos y titulares", () => {
    for (const a of ACTIVIDADES_TRATAMIENTO) {
      expect(a.actividad.length).toBeGreaterThan(0);
      expect(a.finalidad.length).toBeGreaterThan(0);
      expect(a.baseLegal.length).toBeGreaterThan(0);
      expect(a.categoriasDatos.length).toBeGreaterThan(0);
      expect(a.categoriasTitulares.length).toBeGreaterThan(0);
      expect(a.medidasSeguridad.length).toBeGreaterThan(0);
    }
  });

  it("no hay actividades con el mismo nombre (cada fila es una actividad distinta)", () => {
    const nombres = ACTIVIDADES_TRATAMIENTO.map((a) => a.actividad);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("cada clave de retención citada existe de verdad en RETENCIONES", () => {
    const clavesValidas = new Set(RETENCIONES.map((r) => r.clave));
    for (const a of ACTIVIDADES_TRATAMIENTO) {
      for (const clave of a.retencionClaves) {
        expect(clavesValidas.has(clave), `${a.actividad}: clave "${clave}" no existe en RETENCIONES`).toBe(true);
      }
    }
  });

  it("retencionesDe() resuelve a la misma fila que RETENCIONES, sin inventar un plazo aparte", () => {
    for (const a of ACTIVIDADES_TRATAMIENTO) {
      const resueltas = retencionesDe(a);
      expect(resueltas).toHaveLength(a.retencionClaves.length);
      resueltas.forEach((r, i) => {
        expect(r).toBe(RETENCIONES.find((x) => x.clave === a.retencionClaves[i]));
      });
    }
  });

  it("las actividades que salen a un tercero lo nombran explícitamente", () => {
    const conTercero = ACTIVIDADES_TRATAMIENTO.filter((a) => a.destinatarios !== null);
    expect(conTercero.length).toBeGreaterThan(0);
    for (const a of conTercero) {
      expect(a.destinatarios!.length).toBeGreaterThan(0);
      for (const d of a.destinatarios!) expect(d.length).toBeGreaterThan(0);
    }
  });
});
