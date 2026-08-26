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
