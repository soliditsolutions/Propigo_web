/**
 * Retención de datos personales (L-DP1 / L-DP11).
 *
 * El bug que originó esto: `privacidad/page.tsx` publicaba tres plazos —códigos
 * de acceso «eliminados al expirar», registros de acceso a 90 días, auditoría a
 * 3 años— y ninguno se cumplía. No existía `accesoOtp.delete`, `accesoLog.delete`
 * ni `auditoriaEquipo.delete` en todo el código. Eran tres afirmaciones falsas
 * publicadas en una página legal.
 *
 * La causa raíz no fue el olvido de un borrado: fue que el texto vivía en un
 * arreglo dentro de la página, separado de cualquier código que pudiera
 * cumplirlo. Por eso el test que más importa acá es el que amarra las dos cosas.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RETENCIONES, retencion, retencionesAutomaticas, fechaCorte,
} from "../retencion";

describe("catálogo de retenciones", () => {
  it("toda categoría automática declara su plazo en días", () => {
    // Sin esto, una categoría podría decir «automática» y no tener con qué
    // calcular el corte.
    for (const r of RETENCIONES.filter((x) => x.automatica)) {
      expect(r.dias, r.clave).toBeTypeOf("number");
      expect(r.dias, r.clave).toBeGreaterThan(0);
    }
  });

  it("ninguna categoría manual declara días", () => {
    // Un plazo en días sobre algo que nadie borra da a entender que sí se borra.
    for (const r of RETENCIONES.filter((x) => !x.automatica)) {
      expect(r.dias, r.clave).toBeUndefined();
    }
  });

  it("las claves no se repiten", () => {
    const claves = RETENCIONES.map((r) => r.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("cada categoría tiene texto publicable", () => {
    for (const r of RETENCIONES) {
      expect(r.categoria.length, r.clave).toBeGreaterThan(3);
      expect(r.periodo.length, r.clave).toBeGreaterThan(3);
    }
  });

  it("busca por clave y falla fuerte si no existe", () => {
    expect(retencion("otp").clave).toBe("otp");
    // Un typo en una clave es un error de código, no un caso a tolerar.
    expect(() => retencion("inexistente" as never)).toThrow(/desconocida/i);
  });

  it("el plazo contable cita el art. 200 con SEIS años", () => {
    // La política decía «7 años (Código Tributario art. 200)». El artículo fija
    // seis. Citar una norma para un plazo que no dice es peor que no citarla.
    const r = retencion("contable");
    expect(r.periodo).toContain("6");
    expect(r.periodo).not.toContain("7");
    expect(r.fundamento).toMatch(/art\. 200/);
  });
});

describe("la purga cubre TODO lo que la política promete borrar", () => {
  /**
   * Este es el test que evita que el bug vuelva. Si alguien agrega una
   * categoría automática y no escribe su borrado, o cambia una clave, esto
   * falla — sin depender de que alguien se acuerde de revisar la página.
   */
  const purga = readFileSync(
    join(process.cwd(), "src", "lib", "retencion-purga.ts"), "utf8",
  );

  it.each(retencionesAutomaticas().map((r) => r.clave))(
    "existe el borrado de «%s»", (clave) => {
      expect(
        purga.includes(`retencion("${clave}")`),
        `La política publica un plazo automático para "${clave}" y ` +
        "retencion-purga.ts no lo borra. O se escribe el borrado, o la " +
        "categoría deja de ser automática: publicar un plazo que nadie " +
        "aplica es lo que se está corrigiendo acá.",
      ).toBe(true);
    },
  );

  it("la purga devuelve un conteo por cada categoría automática", () => {
    // Si una categoría se borra pero no se cuenta, no hay forma de verificar
    // desde afuera que el proceso hizo algo.
    for (const r of retencionesAutomaticas()) {
      expect(purga, r.clave).toMatch(new RegExp(`${r.clave}:\\s`));
    }
  });

  it("hay al menos tres categorías automáticas", () => {
    // Guarda contra un refactor que vacíe la lista y deje los tests en verde
    // sin proteger nada.
    expect(retencionesAutomaticas().length).toBeGreaterThanOrEqual(3);
  });
});

describe("la página de privacidad lee del módulo, no de un arreglo propio", () => {
  const pagina = readFileSync(
    join(process.cwd(), "src", "app", "privacidad", "page.tsx"), "utf8",
  );

  it("importa RETENCIONES", () => {
    expect(pagina).toContain('from "@/lib/retencion"');
    expect(pagina).toContain("RETENCIONES.map");
  });

  it("ya no trae los plazos escritos a mano", () => {
    // Las tres frases que eran falsas. Si reaparecen como literal, alguien
    // volvió a escribir la tabla a mano.
    for (const frase of [
      "Eliminados automáticamente al expirar",
      "Logs de IP y navegación",
      "7 años (Código Tributario art. 200)",
    ]) {
      expect(pagina.includes(frase), frase).toBe(false);
    }
  });
});

describe("fechaCorte", () => {
  const AHORA = new Date("2026-09-03T12:00:00.000Z");

  it("resta los días exactos", () => {
    expect(fechaCorte(1, AHORA).toISOString()).toBe("2026-09-02T12:00:00.000Z");
    expect(fechaCorte(90, AHORA).toISOString()).toBe("2026-06-05T12:00:00.000Z");
  });

  it("no depende del calendario: tres años son 1095 días", () => {
    // Restar «3 años» del calendario haría que el corte se moviera según los
    // años bisiestos y el día del mes en que corra la purga.
    const corte = fechaCorte(3 * 365, AHORA);
    const dias = Math.round((AHORA.getTime() - corte.getTime()) / 86_400_000);
    expect(dias).toBe(1095);
  });

  it("el corte siempre queda en el pasado", () => {
    for (const r of retencionesAutomaticas()) {
      expect(fechaCorte(r.dias, AHORA).getTime(), r.clave).toBeLessThan(AHORA.getTime());
    }
  });
});
