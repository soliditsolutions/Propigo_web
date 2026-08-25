/**
 * Preferencias de notificación — dominio.
 *
 * Lo que se prueba es la regla que decide si un correo sale o no. Los dos
 * errores posibles tienen costos muy distintos: enviarle a alguien que pidió
 * la baja es un incumplimiento (art. 28 B, Ley 19.496); dejar de enviarle a
 * quien nunca la pidió lo deja sin avisos de su propio arriendo. Ninguno es
 * aceptable, así que se fijan ambos bordes.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  puedeRecibir,
  describirPreferencia,
  calcularBajaHasta,
  firmarTokenBaja,
  verificarTokenBaja,
  DURACIONES,
  MAX_CORREOS_POR_DIA,
  esEsencial,
  bajaTotal,
  TIPOS_ESENCIALES,
  TIPOS_OPCIONALES,
  ALCANCES,
} from "../notificacion-preferencias";

const HOY = new Date("2026-08-19T12:00:00Z");

describe("puedeRecibir — la baja por defecto NO alcanza lo esencial", () => {
  const ESENCIAL = "recordatorio_vencimiento";
  const OPCIONAL = "alerta_personalizada";

  it("sin preferencia registrada, recibe todo", () => {
    // La ausencia de fila significa suscrito: nadie queda sin avisos porque
    // el alta se haya olvidado de crear el registro.
    expect(puedeRecibir(null, ESENCIAL, HOY)).toBe(true);
    expect(puedeRecibir(null, OPCIONAL, HOY)).toBe(true);
  });

  it("suscrito explícito, recibe todo", () => {
    const p = { suscrito: true, bajaHasta: null };
    expect(puedeRecibir(p, ESENCIAL, HOY)).toBe(true);
    expect(puedeRecibir(p, OPCIONAL, HOY)).toBe(true);
  });

  it("baja de alcance normal: corta lo opcional, DEJA pasar lo esencial", () => {
    // Es el corazón de la separación: quien pidió "menos correos" no puede
    // dejar de enterarse de que su arriendo venció.
    const p = { suscrito: false, bajaHasta: null, alcance: "solo_opcionales" as const };
    expect(puedeRecibir(p, OPCIONAL, HOY)).toBe(false);
    expect(puedeRecibir(p, ESENCIAL, HOY)).toBe(true);
  });

  it("baja total: corta absolutamente todo", () => {
    const p = { suscrito: false, bajaHasta: null, alcance: "todos" as const };
    expect(puedeRecibir(p, OPCIONAL, HOY)).toBe(false);
    expect(puedeRecibir(p, ESENCIAL, HOY)).toBe(false);
  });

  it("baja temporal vigente respeta el alcance", () => {
    const futuro = new Date("2026-09-30T00:00:00Z");
    const parcial = { suscrito: false, bajaHasta: futuro, alcance: "solo_opcionales" as const };
    expect(puedeRecibir(parcial, ESENCIAL, HOY)).toBe(true);
    expect(puedeRecibir(parcial, OPCIONAL, HOY)).toBe(false);
  });

  it("baja temporal ya vencida, vuelve a recibir todo sin intervención", () => {
    const pasado = new Date("2026-07-01T00:00:00Z");
    const p = { suscrito: false, bajaHasta: pasado, alcance: "todos" as const };
    expect(puedeRecibir(p, ESENCIAL, HOY)).toBe(true);
    expect(puedeRecibir(p, OPCIONAL, HOY)).toBe(true);
  });

  it("el mismo día del término todavía NO recibe lo opcional", () => {
    // Se resuelve a favor de la persona: la pausa se respeta completa.
    const hoyMismo = new Date("2026-08-19T12:00:00Z");
    expect(puedeRecibir({ suscrito: false, bajaHasta: hoyMismo }, "alerta_personalizada", HOY)).toBe(false);
  });

  it("sin alcance guardado se comporta como parcial (valor por defecto de la BD)", () => {
    // Las filas creadas antes de existir la columna no deben quedar cortando
    // avisos esenciales por omisión.
    const p = { suscrito: false, bajaHasta: null };
    expect(puedeRecibir(p, ESENCIAL, HOY)).toBe(true);
    expect(puedeRecibir(p, OPCIONAL, HOY)).toBe(false);
  });
});

describe("esEsencial", () => {
  it.each([...TIPOS_ESENCIALES])("%s es esencial", (t) => {
    expect(esEsencial(t)).toBe(true);
  });

  it.each([...TIPOS_OPCIONALES])("%s es opcional", (t) => {
    expect(esEsencial(t)).toBe(false);
  });

  it("un tipo desconocido se trata como esencial", () => {
    // Lado seguro del error: recibir un correo de más es peor que no
    // enterarse de algo que afecta el bolsillo.
    expect(esEsencial("tipo_que_alguien_agregue_manana")).toBe(true);
  });

  it("ningún tipo está en ambas listas", () => {
    const cruce = [...TIPOS_ESENCIALES].filter((t) => TIPOS_OPCIONALES.has(t));
    expect(cruce).toEqual([]);
  });
});

describe("bajaTotal", () => {
  it("distingue la baja total de la parcial", () => {
    expect(bajaTotal({ suscrito: false, bajaHasta: null, alcance: "todos" }, HOY)).toBe(true);
    expect(bajaTotal({ suscrito: false, bajaHasta: null, alcance: "solo_opcionales" }, HOY)).toBe(false);
    expect(bajaTotal(null, HOY)).toBe(false);
    expect(bajaTotal({ suscrito: true, bajaHasta: null }, HOY)).toBe(false);
  });

  it("una baja total ya vencida deja de serlo", () => {
    const pasado = new Date("2026-07-01T00:00:00Z");
    expect(bajaTotal({ suscrito: false, bajaHasta: pasado, alcance: "todos" }, HOY)).toBe(false);
  });
});

describe("calcularBajaHasta", () => {
  it("permanente devuelve null", () => {
    expect(calcularBajaHasta("permanente", HOY)).toBeNull();
  });

  it.each([["1m", 30], ["3m", 90]])("%s suma %i días", (clave, dias) => {
    const hasta = calcularBajaHasta(clave, HOY)!;
    const diff = Math.round((hasta.getTime() - HOY.getTime()) / 86400000);
    expect(diff).toBe(dias);
  });

  it("lanza ante una duración desconocida en vez de asumir permanente", () => {
    // Asumir permanente silenciaría para siempre a quien pidió una pausa.
    expect(() => calcularBajaHasta("para-siempre-jamas", HOY)).toThrow(/desconocida/i);
  });

  it("todas las duraciones publicadas se pueden calcular", () => {
    for (const d of DURACIONES) {
      expect(() => calcularBajaHasta(d.clave, HOY)).not.toThrow();
    }
  });
});

describe("token de baja", () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = "x".repeat(48);
  });

  it("ida y vuelta: se firma y se verifica", async () => {
    const t = await firmarTokenBaja("persona-1", "tenant-1");
    const p = await verificarTokenBaja(t);
    expect(p?.personaId).toBe("persona-1");
    expect(p?.tenantId).toBe("tenant-1");
  });

  it("rechaza un token manipulado", async () => {
    const t = await firmarTokenBaja("persona-1", "tenant-1");
    const roto = t.slice(0, -3) + "abc";
    expect(await verificarTokenBaja(roto)).toBeNull();
  });

  it("rechaza basura", async () => {
    expect(await verificarTokenBaja("no-es-un-token")).toBeNull();
    expect(await verificarTokenBaja("")).toBeNull();
  });

  it("un token de baja NO sirve como sesión de portal", async () => {
    // Ámbitos separados por prefijo de secreto: si esto fallara, un enlace de
    // un correo archivado sería una llave al portal de la persona.
    const t = await firmarTokenBaja("persona-1", "tenant-1");
    const { verifyPortalToken } = await import("../portal-auth");
    expect(await verifyPortalToken(t)).toBeNull();
  });
});

describe("describirPreferencia", () => {
  it("distingue suscrito, baja parcial y baja total", () => {
    expect(describirPreferencia(null, HOY)).toMatch(/recibes todos/i);
    expect(describirPreferencia({ suscrito: false, bajaHasta: null, alcance: "solo_opcionales" }, HOY))
      .toMatch(/informativos/i);
    expect(describirPreferencia({ suscrito: false, bajaHasta: null, alcance: "todos" }, HOY))
      .toMatch(/incluidos los de tu contrato/i);
  });

  it("en baja parcial deja claro que lo del contrato sigue llegando", () => {
    const t = describirPreferencia({ suscrito: false, bajaHasta: null, alcance: "solo_opcionales" }, HOY);
    expect(t).toMatch(/siguen llegando/i);
  });

  it("menciona la fecha cuando la baja es temporal", () => {
    const t = describirPreferencia(
      { suscrito: false, bajaHasta: new Date("2026-09-30T00:00:00Z"), alcance: "solo_opcionales" }, HOY);
    expect(t).toMatch(/hasta el/i);
  });
});

describe("alcances publicados", () => {
  it("el alcance recomendado va primero", () => {
    // El orden es la recomendación implícita: lo que no se lee, se acepta.
    expect(ALCANCES[0].clave).toBe("solo_opcionales");
  });

  it("el alcance total advierte la consecuencia real", () => {
    expect(ALCANCES[1].detalle).toMatch(/vence|impago/i);
  });
});

describe("tope de volumen", () => {
  it("es un número bajo y explícito", () => {
    // El valor puede discutirse; que exista un tope, no.
    expect(MAX_CORREOS_POR_DIA).toBeGreaterThan(0);
    expect(MAX_CORREOS_POR_DIA).toBeLessThanOrEqual(5);
  });
});
