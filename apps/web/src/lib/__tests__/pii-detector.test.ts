/**
 * Tests adversariales del detector de PII (gate fail-closed del paso "Validación
 * de borrador de contrato", ADR-0012).
 *
 * El objetivo del gate: un borrador que se supone SIN datos personales. Estos
 * tests cubren el caso feliz (borrador con placeholders → permitir), los
 * identificadores duros que DEBEN bloquear (RUT/email/teléfono), el caso realista
 * "el corredor sube el contrato real completo pese a la advertencia", y la
 * precisión (montos y placeholders NO deben gatillar falsos positivos).
 */
import { describe, it, expect } from "vitest";
import { detectarPii, enmascararPii } from "../pii-detector";

// RUTs de test con DV mod-11 válido (NO son personas reales): 11.111.111-1 y 1-9.
const RUT_VALIDO_DOTS = "11.111.111-1";
const RUT_VALIDO_DASH = "11111111-1";

describe("detectarPii() — caso feliz (borrador limpio)", () => {
  it("permite un borrador con placeholders (sin PII)", () => {
    const draft = `CONTRATO DE ARRIENDO. Entre [ARRENDADORA], RUT XX.XXX.XXX-X, y
      [ARRENDATARIO], RUT XX.XXX.XXX-X, domiciliado en [DIRECCION]. PRIMERO: ...`;
    const r = detectarPii(draft);
    expect(r.limpio).toBe(true);
    expect(r.decision).toBe("permitir");
    expect(r.hallazgos).toEqual([]);
  });

  it("permite texto de cláusulas puro sin identificadores", () => {
    const r = detectarPii("La garantía será equivalente a un mes de renta y se restituirá al término.");
    expect(r.decision).toBe("permitir");
  });
});

describe("detectarPii() — RUT (bloquea solo válidos mod-11)", () => {
  it("bloquea un RUT válido con puntos y guión", () => {
    const r = detectarPii(`cédula número ${RUT_VALIDO_DOTS} de la parte`);
    expect(r.decision).toBe("bloquear");
    expect(r.hallazgos.find((h) => h.tipo === "rut")?.cantidad).toBe(1);
  });

  it("bloquea un RUT válido con guión sin puntos", () => {
    const r = detectarPii(`RUN ${RUT_VALIDO_DASH}`);
    expect(r.decision).toBe("bloquear");
  });

  it("bloquea un RUT válido con DV = K", () => {
    // 10.000.013-K es válido mod-11 (verificado con el algoritmo de @propigo/core).
    const r = detectarPii("cédula 10.000.013-K");
    expect(r.hallazgos.find((h) => h.tipo === "rut")?.cantidad).toBe(1);
    expect(r.decision).toBe("bloquear");
  });

  it("NO bloquea un patrón tipo-RUT con DV inválido, pero lo reporta como posible", () => {
    const r = detectarPii("referencia 11.111.111-9"); // DV correcto es 1, no 9
    expect(r.limpio).toBe(true);
    expect(r.decision).toBe("permitir");
    expect(r.posiblesRut).toBe(1);
  });

  it("cuenta RUTs válidos únicos (no duplica el mismo)", () => {
    const r = detectarPii(`${RUT_VALIDO_DOTS} ... y de nuevo ${RUT_VALIDO_DOTS}`);
    expect(r.hallazgos.find((h) => h.tipo === "rut")?.cantidad).toBe(1);
  });

  it("bloquea un RUT escrito con dígitos fullwidth (evasión de \\d ASCII)", () => {
    // "11111111-1" con dígitos fullwidth U+FF11 — NFKC lo pliega a ASCII antes de detectar.
    const rutFullwidth = "１".repeat(8) + "-" + "１";
    const r = detectarPii(`cédula ${rutFullwidth}`);
    expect(r.decision).toBe("bloquear");
    expect(r.hallazgos.find((h) => h.tipo === "rut")?.cantidad).toBe(1);
  });
});

describe("detectarPii() — email y teléfono", () => {
  it("bloquea un email", () => {
    const r = detectarPii("correo electrónico juan.perez@example.cl para notificaciones");
    expect(r.decision).toBe("bloquear");
    expect(r.hallazgos.find((h) => h.tipo === "email")?.cantidad).toBe(1);
  });

  it("bloquea email con subdominio y +tag", () => {
    const r = detectarPii("contacto+arriendo@mail.co.cl");
    expect(r.hallazgos.find((h) => h.tipo === "email")?.cantidad).toBe(1);
  });

  it("bloquea un móvil chileno con +56 y espacios", () => {
    const r = detectarPii("teléfono +56 9 8765 4321");
    expect(r.decision).toBe("bloquear");
    expect(r.hallazgos.find((h) => h.tipo === "telefono")?.cantidad).toBe(1);
  });

  it("bloquea un móvil sin separadores (912345678)", () => {
    const r = detectarPii("llamar al 987654321");
    expect(r.hallazgos.find((h) => h.tipo === "telefono")?.cantidad).toBe(1);
  });
});

describe("detectarPii() — precisión (no falsos positivos en montos/placeholders)", () => {
  it("NO gatilla con montos con puntos de miles", () => {
    const r = detectarPii("La renta será de $450.000 y la garantía de $1.200.000 mensuales.");
    expect(r.limpio).toBe(true);
    expect(r.posiblesRut).toBe(0);
  });

  it("NO gatilla con un número grande escrito con puntos (no es teléfono ni RUT)", () => {
    const r = detectarPii("El avalúo fiscal asciende a 912.345.678 pesos.");
    expect(r.limpio).toBe(true);
  });

  it("NO gatilla con fechas ni artículos legales", () => {
    const r = detectarPii("Según el artículo 1915 del Código Civil y la Ley 18.101, a 30 de marzo de 2026.");
    expect(r.limpio).toBe(true);
  });
});

describe("detectarPii() — caso realista: el corredor sube el contrato REAL completo", () => {
  it("bloquea un párrafo de comparecencia con RUT + email + teléfono", () => {
    const parrafo = `Por una parte, doña MARÍA SOTO, cédula nacional de identidad número
      ${RUT_VALIDO_DOTS}, correo electrónico maria.soto@correo.cl, teléfono +56 9 1111 2222;
      y por la otra, don PEDRO DÍAZ, cédula ${RUT_VALIDO_DASH}...`;
    const r = detectarPii(parrafo);
    expect(r.decision).toBe("bloquear");
    const tipos = r.hallazgos.map((h) => h.tipo).sort();
    expect(tipos).toEqual(["email", "rut", "telefono"]);
  });
});

describe("detectarPii() — las muestras nunca exponen PII en claro", () => {
  it("enmascara el RUT en las muestras", () => {
    const r = detectarPii(RUT_VALIDO_DOTS);
    const muestra = r.hallazgos[0].muestras[0];
    expect(muestra).not.toContain("11111111");
    expect(muestra).toContain("…");
  });

  it("enmascara el email en las muestras", () => {
    const r = detectarPii("juan.perez@example.cl");
    const muestra = r.hallazgos[0].muestras[0];
    expect(muestra).not.toContain("juan.perez");
    expect(muestra).toContain("…@");
  });
});

describe("enmascararPii() — ayuda opcional", () => {
  it("reemplaza RUT válido, email y teléfono por placeholders y deja pasar el resto", () => {
    const { texto, reemplazos } = enmascararPii(
      `doña MARÍA SOTO, cédula ${RUT_VALIDO_DOTS}, correo maria@correo.cl, fono +56 9 1111 2222`,
    );
    expect(texto).toContain("[RUT]");
    expect(texto).toContain("[EMAIL]");
    expect(texto).toContain("[TELEFONO]");
    expect(texto).toContain("MARÍA SOTO"); // el nombre no es responsabilidad de este helper
    expect(reemplazos).toBe(3);
  });

  it("el resultado enmascarado pasa el gate como limpio", () => {
    const { texto } = enmascararPii(`cédula ${RUT_VALIDO_DASH} correo x@y.cl`);
    expect(detectarPii(texto).decision).toBe("permitir");
  });

  it("no toca un patrón tipo-RUT con DV inválido (queda para revisión humana)", () => {
    const { texto, reemplazos } = enmascararPii("referencia 11.111.111-9 sin datos");
    expect(texto).toContain("11.111.111-9");
    expect(reemplazos).toBe(0);
  });
});

describe("detectarPii() — entradas degeneradas", () => {
  it("maneja string vacío", () => {
    expect(detectarPii("").decision).toBe("permitir");
  });

  it("maneja null sin lanzar", () => {
    // @ts-expect-error prueba de robustez ante entrada no-string
    expect(() => detectarPii(null)).not.toThrow();
  });
});
