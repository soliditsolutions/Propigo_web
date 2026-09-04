/**
 * Rol de Avalúo y cuentas de servicios — dominio.
 *
 * El riesgo que se vigila acá es el de un validador demasiado estricto: si
 * rechaza un rol legítimo, la propiedad no se puede cargar y el corredor se
 * queda fuera del sistema. Un rol mal tipeado, en cambio, se corrige en dos
 * clics. Por eso los casos incluyen los formatos raros pero reales.
 */
import { describe, it, expect } from "vitest";
import {
  normalizarRol,
  validarRol,
  validarCuentas,
  normalizarCuenta,
  validarRolesComplementarios,
  validarAvaluoFiscal,
  MAX_AVALUO_FISCAL,
  esCuentaObligatoria,
  nombreCuenta,
  SERVICIOS_OBLIGATORIOS,
  type EntradaCuenta,
} from "../propiedad-datos";

describe("validarRol — formatos reales del SII", () => {
  it.each([
    ["573-24",        "forma comunal habitual"],
    ["308-61",        "otra comunal"],
    ["1-1",           "bloques de UN dígito — rol real de Santiago Centro"],
    ["13101-573-24",  "forma nacional con código de comuna"],
    ["12345-12345",   "el tope de 5 dígitos por bloque"],
  ])("acepta %s (%s)", (rol) => {
    expect(validarRol(rol)).toBeNull();
  });

  it.each([
    ["",              /obligatorio/i],
    ["   ",           /obligatorio/i],
    ["57324",         /formato/i],          // sin guión
    ["573-24-11-2",   /formato/i],          // cuatro bloques
    ["573-",          /formato/i],
    ["-24",           /formato/i],
    ["123456-24",     /formato/i],          // seis dígitos
  ])("rechaza %s", (rol, patron) => {
    expect(validarRol(rol)).toMatch(patron);
  });

  it("rechaza letras con un mensaje que apunta a la confusión más probable", () => {
    // El error típico es pegar un RUT, que sí lleva K.
    const r = validarRol("12345678-K");
    expect(r).toMatch(/RUT/);
  });

  it("el rol NO tiene dígito verificador", () => {
    // Fijado a propósito: la recomendación original de este proyecto proponía
    // aceptar una K final, confundiendo el rol con el RUT.
    expect(validarRol("573-K")).not.toBeNull();
  });
});

describe("normalizarRol", () => {
  it.each([
    ["  573-24  ",  "573-24", "espacios alrededor"],
    ["573 - 24",    "573-24", "espacios internos"],
    ["573.24",      "57324",  "puntos: se quitan"],
    ["573–24",      "573-24", "guión tipográfico al copiar de un PDF"],
  ])("%s → %s (%s)", (entrada, esperado) => {
    expect(normalizarRol(entrada)).toBe(esperado);
  });

  it("un rol copiado de un certificado con guión largo queda válido", () => {
    expect(validarRol("573—24")).toBeNull();
  });
});

// ── Cuentas de servicios ────────────────────────────────────────────────

const COMPLETO: EntradaCuenta[] = SERVICIOS_OBLIGATORIOS.map((s) => ({
  tipo: s.tipo, estado: "registrada", numero: "123456", paga: "arrendatario",
}));

describe("validarCuentas", () => {
  it("acepta cuando los cuatro servicios están declarados con número", () => {
    expect(validarCuentas(COMPLETO)).toBeNull();
  });

  it("acepta 'no aplica' sin número — una casa sin gas de red no tiene cuenta", () => {
    const sinGas = COMPLETO.map((c) =>
      c.tipo === "gas" ? { ...c, estado: "no_aplica" as const, numero: null } : c);
    expect(validarCuentas(sinGas)).toBeNull();
  });

  it("rechaza si falta declarar un servicio, y dice qué hacer", () => {
    const faltaLuz = COMPLETO.filter((c) => c.tipo !== "luz");
    const r = validarCuentas(faltaLuz);
    expect(r).toMatch(/luz/i);
    expect(r).toMatch(/no aplica/i);   // ofrece la salida, no solo el reproche
  });

  it("rechaza 'registrada' sin número: el blanco no es una respuesta", () => {
    const vacia = COMPLETO.map((c) =>
      c.tipo === "agua" ? { ...c, numero: "  " } : c);
    expect(validarCuentas(vacia)).toMatch(/agua/i);
  });

  it("permite DOS cuentas del mismo tipo — una propiedad subdividida tiene dos medidores", () => {
    const dosLuces = [...COMPLETO, {
      tipo: "luz" as const, estado: "registrada" as const,
      numero: "999", paga: "arrendatario" as const,
    }];
    expect(validarCuentas(dosLuces)).toBeNull();
  });

  it("rechaza textos desmedidos", () => {
    const largo = COMPLETO.map((c) =>
      c.tipo === "agua" ? { ...c, titular: "x".repeat(200) } : c);
    expect(validarCuentas(largo)).toMatch(/demasiado largo/i);
  });
});

describe("normalizarCuenta", () => {
  it("un 'no aplica' no conserva datos residuales", () => {
    // Un "no aplica" con número guardado es una contradicción que alguien
    // después lee como dato bueno.
    const r = normalizarCuenta({
      tipo: "gas", estado: "no_aplica",
      numero: "123", empresa: "Metrogas", titular: "Ana", paga: "arrendatario",
    });
    expect(r.numero).toBeNull();
    expect(r.empresa).toBeNull();
    expect(r.titular).toBeNull();
  });

  it("recorta y convierte vacíos en null", () => {
    const r = normalizarCuenta({
      tipo: "luz", estado: "registrada",
      numero: "  456  ", empresa: "   ", paga: "propietario",
    });
    expect(r.numero).toBe("456");
    expect(r.empresa).toBeNull();
  });
});

// ── Roles complementarios ───────────────────────────────────────────────

describe("validarRolesComplementarios", () => {
  it("acepta una lista vacía — la mayoría de las casas no tiene ninguno", () => {
    expect(validarRolesComplementarios([])).toBeNull();
  });

  it("acepta estacionamiento y bodega con roles propios", () => {
    expect(validarRolesComplementarios([
      { tipo: "estacionamiento", rol: "573-25", descripcion: "Estac. 42" },
      { tipo: "bodega",          rol: "573-26" },
    ])).toBeNull();
  });

  it("valida el rol del complemento con el mismo rigor que el principal", () => {
    const r = validarRolesComplementarios([{ tipo: "bodega", rol: "no-es-un-rol" }]);
    expect(r).toMatch(/bodega/i);
  });

  it("rechaza dos unidades con el mismo rol", () => {
    // Dos unidades distintas no pueden compartir rol: o es un copy-paste, o
    // una de las dos está mal identificada.
    const r = validarRolesComplementarios([
      { tipo: "estacionamiento", rol: "573-25" },
      { tipo: "bodega",          rol: "573-25" },
    ]);
    expect(r).toMatch(/repetido/i);
  });

  it("detecta el repetido aunque venga escrito distinto", () => {
    const r = validarRolesComplementarios([
      { tipo: "estacionamiento", rol: "573-25" },
      { tipo: "bodega",          rol: " 573 - 25 " },
    ]);
    expect(r).toMatch(/repetido/i);
  });
});

describe("validarRol — hallazgos del barrido QA de 2026-08-26", () => {
  it("reconoce un RUT pegado por error, no solo los terminados en K", () => {
    // El mensaje sobre el RUT existía, pero solo se disparaba si había letras,
    // o sea únicamente con el dígito verificador K: uno de cada once. Con
    // cualquier otro RUT el corredor recibía el mensaje genérico de formato,
    // que no le dice qué confundió.
    for (const rut of ["13.579.246-8", "9.876.543-3", "16358920-6", "12345678-K"]) {
      expect(validarRol(rut), rut).toMatch(/parece un RUT|es otro dato/i);
    }
  });

  it("sigue aceptando roles válidos que se parecen a un RUT por el largo", () => {
    // Un rol con código de comuna tiene tres bloques, no dos: no debe caer en
    // la detección de RUT.
    expect(validarRol("13101-573-24")).toBeNull();
    expect(validarRol("12345-67890")).toBeNull();
  });

  it("rechaza un bloque en cero", () => {
    // `0-0` fue el valor con que la migración rellenó las filas existentes.
    // Aceptarlo hace que el relleno técnico sea indistinguible de un rol real.
    expect(validarRol("0-0")).toMatch(/cero/i);
    expect(validarRol("00-00")).toMatch(/cero/i);
    expect(validarRol("573-0")).toMatch(/cero/i);
    expect(validarRol("0-24")).toMatch(/cero/i);
  });

  it("no confunde un cero interior con un bloque en cero", () => {
    expect(validarRol("100-205")).toBeNull();
    expect(validarRol("10-20")).toBeNull();
  });

  it("normaliza los guiones que aparecen al copiar desde un PDF", () => {
    // De no separación (U+2011) y de unión (U+2010): a simple vista son
    // idénticos al guión común, así que el corredor no entendería el rechazo.
    expect(validarRol("573‑ 24")).toBeNull();
    expect(validarRol("573‐24")).toBeNull();
    expect(validarRol("573‒24")).toBeNull();
    expect(normalizarRol("573‑24")).toBe("573-24");
  });
});

describe("validarCuentas — tipo fuera del enum", () => {
  it("rechaza un tipo de servicio que la base no conoce", () => {
    // Sin esto llegaba tal cual a Prisma y reventaba con un error de enum en
    // vez de un mensaje que el corredor pueda entender.
    const conBasura = [...COMPLETO, {
      tipo: "internet" as never, estado: "registrada" as const,
      numero: "1", paga: "arrendatario" as const,
    }];
    expect(validarCuentas(conBasura)).toMatch(/no reconocemos/i);
  });
});

describe("validarRolesComplementarios — rol repetido del principal", () => {
  it("rechaza que una bodega use el mismo rol que la propiedad", () => {
    // Confirmado en la base durante el barrido QA: se pudo crear desde la UI
    // una propiedad con rol 573-24 y una bodega con rol 573-24. En el borrador
    // de contrato eso nombra dos inmuebles distintos con un solo rol.
    const e = validarRolesComplementarios(
      [{ tipo: "bodega", rol: "573-24", descripcion: "Bodega 5" }],
      "573-24",
    );
    expect(e).toMatch(/es el de la propiedad/i);
  });

  it("lo detecta aunque se escriba con otro formato", () => {
    expect(validarRolesComplementarios([{ tipo: "bodega", rol: "573 – 24" }], "573-24"))
      .toMatch(/es el de la propiedad/i);
  });

  it("acepta un complemento con rol distinto", () => {
    expect(validarRolesComplementarios([{ tipo: "bodega", rol: "573-25" }], "573-24")).toBeNull();
  });

  it("sin rol principal se comporta como antes", () => {
    // La comprobación es opcional para no romper a quien llame sin el dato.
    expect(validarRolesComplementarios([{ tipo: "bodega", rol: "573-24" }])).toBeNull();
  });

  it("rechaza un tipo de unidad fuera del enum", () => {
    expect(validarRolesComplementarios([{ tipo: "piscina" as never, rol: "573-25" }]))
      .toMatch(/no reconocemos/i);
  });
});

describe("cuentas adicionales y visibilidad (2026-08-26)", () => {
  const extra = (over: Partial<EntradaCuenta> = {}): EntradaCuenta => ({
    tipo: "otro", estado: "registrada", etiqueta: "Internet",
    numero: "VTR-1", paga: "arrendatario", ...over,
  });

  it("acepta una cuenta adicional con nombre y número", () => {
    expect(validarCuentas([...COMPLETO, extra()])).toBeNull();
  });

  it("exige nombre en la cuenta adicional", () => {
    // Los cuatro básicos se identifican por su tipo; una adicional sin nombre
    // es una fila que después nadie sabe leer.
    expect(validarCuentas([...COMPLETO, extra({ etiqueta: "" })])).toMatch(/nombre/i);
    expect(validarCuentas([...COMPLETO, extra({ etiqueta: "   " })])).toMatch(/nombre/i);
  });

  it("exige número en la cuenta adicional, y lo dice por su nombre", () => {
    // A diferencia de los básicos, acá no existe "no aplica": si no aplica,
    // se quita.
    const e = validarCuentas([...COMPLETO, extra({ numero: "" })]);
    expect(e).toMatch(/Internet/);
  });

  it("rechaza un nombre desmedido", () => {
    expect(validarCuentas([...COMPLETO, extra({ etiqueta: "x".repeat(41) })]))
      .toMatch(/demasiado largo/i);
  });

  it("no le exige nombre a los cuatro básicos", () => {
    // Se nombran solos por su tipo; pedirles etiqueta sería ruido.
    expect(validarCuentas(COMPLETO)).toBeNull();
  });
});

describe("esCuentaObligatoria y nombreCuenta", () => {
  it("los cuatro básicos son obligatorios y el resto no", () => {
    for (const t of ["agua", "luz", "gas", "gastos_comunes"] as const) {
      expect(esCuentaObligatoria(t), t).toBe(true);
    }
    expect(esCuentaObligatoria("otro")).toBe(false);
  });

  it("nombra los básicos por su tipo y las adicionales por su etiqueta", () => {
    expect(nombreCuenta({ tipo: "gastos_comunes", estado: "registrada", paga: "propietario" }))
      .toBe("Gastos comunes");
    expect(nombreCuenta({ tipo: "otro", estado: "registrada", etiqueta: "Alarma", paga: "propietario" }))
      .toBe("Alarma");
  });

  it("una adicional sin etiqueta no queda sin nombre en pantalla", () => {
    // Es un caso que la validación impide guardar, pero los datos viejos o una
    // fila a medio cargar no deben renderizar un hueco.
    expect(nombreCuenta({ tipo: "otro", estado: "registrada", paga: "propietario" }))
      .toBe("Otro servicio");
  });
});

describe("normalizarCuenta — etiqueta", () => {
  it("descarta la etiqueta en los básicos: su tipo ya los nombra", () => {
    const r = normalizarCuenta({
      tipo: "agua", estado: "registrada", numero: "1",
      etiqueta: "Agua potable", paga: "arrendatario",
    });
    expect(r.etiqueta).toBeNull();
  });

  it("conserva y recorta la etiqueta en las adicionales", () => {
    const r = normalizarCuenta({
      tipo: "otro", estado: "registrada", numero: "1",
      etiqueta: "  Internet  ", paga: "arrendatario",
    });
    expect(r.etiqueta).toBe("Internet");
  });
});

describe("validarAvaluoFiscal", () => {
  it("es opcional: sin valor no es un error", () => {
    // Hay propiedades cargadas antes de que el campo existiera, y un corredor
    // puede no tener las contribuciones a mano al dar de alta el inmueble.
    expect(validarAvaluoFiscal(undefined)).toBeNull();
    expect(validarAvaluoFiscal(null)).toBeNull();
  });

  it("acepta montos reales de vivienda", () => {
    for (const v of [2_500_000, 45_000_000, 380_000_000, MAX_AVALUO_FISCAL]) {
      expect(validarAvaluoFiscal(v), String(v)).toBeNull();
    }
  });

  it("rechaza cero y negativos, y sugiere dejarlo en blanco", () => {
    expect(validarAvaluoFiscal(0)).toMatch(/mayor que cero/);
    expect(validarAvaluoFiscal(0)).toMatch(/en blanco/);
    expect(validarAvaluoFiscal(-1)).toMatch(/mayor que cero/);
  });

  it("rechaza decimales: el peso chileno no los tiene", () => {
    expect(validarAvaluoFiscal(45_000_000.5)).toMatch(/sin decimales/);
  });

  it("atrapa el dedazo de los ceros de más", () => {
    // 45 millones tecleado con tres ceros extra. Es el error que el techo
    // existe para atajar, y el mensaje lo dice en esos términos.
    expect(validarAvaluoFiscal(45_000_000_000_0)).toMatch(/ceros de más/);
  });

  it("rechaza NaN e Infinity", () => {
    expect(validarAvaluoFiscal(Number.NaN)).toMatch(/debe ser un número/);
    expect(validarAvaluoFiscal(Number.POSITIVE_INFINITY)).toMatch(/debe ser un número/);
  });
});
