/**
 * Rol de Avalúo y cuentas de servicios básicos — dominio.
 *
 * Módulo puro: no toca la base ni la sesión, así que se prueba sin mocks.
 *
 * ── Sobre el Rol de Avalúo (decisión G-01) ──────────────────────────────
 * Es el identificador **tributario** que el SII asigna a cada predio; sirve
 * para las contribuciones y es distinto de la inscripción en el Conservador
 * (fojas/número/año).
 *
 * Estructura: `comuna – manzana – predio`. En la práctica se usa la forma
 * comunal de dos bloques, porque la comuna se sobreentiende:
 *
 *   573-24          manzana 573, predio 24
 *   13101-573-24    con el código SII de comuna (13101 = Santiago Centro)
 *
 * Dos cosas que conviene tener presentes, porque contradicen la intuición:
 *  - **No tiene dígito verificador.** Eso es del RUT. Un rol es solo dígitos.
 *  - **Los bloques no tienen largo fijo.** `1-1` es un rol real y válido, así
 *    que exigir cuatro dígitos rechazaría propiedades legítimas.
 *
 * El SII no publica un diccionario de datos accesible con los largos máximos,
 * así que el tope de 5 dígitos por bloque es un margen amplio elegido por
 * nosotros, no una cifra oficial. Si algún día aparece un rol legítimo que
 * esto rechaza, el reporte traerá el ejemplo concreto y se relaja con
 * evidencia.
 */

/** Bloques de 1 a 5 dígitos; el de comuna es opcional. */
const RE_ROL = /^(\d{1,5}-)?\d{1,5}-\d{1,5}$/;

/**
 * Deja el rol en su forma canónica antes de validarlo o guardarlo.
 * La gente lo escribe con espacios, puntos o guiones largos según de dónde lo
 * copie (un certificado, un correo, el portal del SII).
 */
export function normalizarRol(valor: string): string {
  return valor
    .trim()
    .replace(/[.\s]/g, "")
    .replace(/[–—]/g, "-");   // guiones tipográficos → guión normal
}

/** null si el rol es válido; si no, el motivo en el idioma del corredor. */
export function validarRol(valor: string): string | null {
  const rol = normalizarRol(valor);
  if (!rol) return "El rol de avalúo es obligatorio.";
  if (/[a-zA-Z]/.test(rol))
    return "El rol de avalúo son solo números y guiones. Si estás copiando un RUT, ese es otro dato.";
  if (!RE_ROL.test(rol))
    return "Revisa el formato del rol: son dos bloques de números separados por guión, por ejemplo 573-24.";
  return null;
}

// ── Cuentas de servicios básicos ────────────────────────────────────────

export type TipoServicio = "agua" | "luz" | "gas" | "gastos_comunes" | "otro";

/**
 * Servicios que deben quedar declarados al dar de alta una propiedad
 * (decisión G-02 + G-05). "otro" no está: es para agregar de más, no un
 * casillero que haya que responder.
 */
export const SERVICIOS_OBLIGATORIOS: { tipo: TipoServicio; etiqueta: string }[] = [
  { tipo: "agua",           etiqueta: "Agua" },
  { tipo: "luz",            etiqueta: "Luz" },
  { tipo: "gas",            etiqueta: "Gas" },
  { tipo: "gastos_comunes", etiqueta: "Gastos comunes" },
];

export type EntradaCuenta = {
  tipo:    TipoServicio;
  estado:  "registrada" | "no_aplica";
  numero?: string | null;
  empresa?: string | null;
  titular?: string | null;
  paga:    "arrendatario" | "propietario";
};

/**
 * Valida el conjunto de cuentas de una propiedad.
 *
 * "Obligatorio" no significa que las cuatro tengan número: una casa sin gas
 * de red no puede tener cuenta de gas. Significa que las cuatro estén
 * **declaradas** — con datos o marcadas "no aplica". El blanco no es una
 * respuesta porque no distingue "todavía no lo tengo" de "acá no existe".
 */
export function validarCuentas(cuentas: EntradaCuenta[]): string | null {
  for (const s of SERVICIOS_OBLIGATORIOS) {
    const declaradas = cuentas.filter((c) => c.tipo === s.tipo);
    if (declaradas.length === 0)
      return `Falta declarar la cuenta de ${s.etiqueta.toLowerCase()}. Si la propiedad no tiene ese servicio, márcala como "no aplica".`;

    for (const c of declaradas) {
      if (c.estado === "registrada" && !c.numero?.trim())
        return `Ingresa el número de la cuenta de ${s.etiqueta.toLowerCase()}, o márcala como "no aplica".`;
    }
  }

  for (const c of cuentas) {
    if (c.numero && c.numero.length > 60)  return "El número de cuenta es demasiado largo.";
    if (c.empresa && c.empresa.length > 80) return "El nombre de la empresa es demasiado largo.";
    if (c.titular && c.titular.length > 120) return "El nombre del titular es demasiado largo.";
  }

  return null;
}

/** Deja la cuenta lista para guardar: sin datos residuales si no aplica. */
export function normalizarCuenta(c: EntradaCuenta): EntradaCuenta {
  if (c.estado === "no_aplica") {
    // Un "no aplica" con número guardado es una contradicción que después
    // alguien lee como dato bueno.
    return { ...c, numero: null, empresa: null, titular: null };
  }
  return {
    ...c,
    numero:  c.numero?.trim()  || null,
    empresa: c.empresa?.trim() || null,
    titular: c.titular?.trim() || null,
  };
}

// ── Roles complementarios ───────────────────────────────────────────────

export type TipoRolComplementario = "estacionamiento" | "bodega" | "otro";

export type EntradaRolComplementario = {
  tipo: TipoRolComplementario;
  rol: string;
  descripcion?: string | null;
};

/**
 * Los complementos son opcionales (G-06): la mayoría de las casas no tiene
 * ninguno. Pero si se declara uno, su rol se valida igual que el principal —
 * un rol mal escrito no sirve para nada aunque sea el de la bodega.
 */
export function validarRolesComplementarios(roles: EntradaRolComplementario[]): string | null {
  for (const r of roles) {
    const error = validarRol(r.rol);
    if (error) return `Rol de ${r.tipo === "otro" ? "la unidad adicional" : r.tipo}: ${error}`;
    if (r.descripcion && r.descripcion.length > 80)
      return "La descripción de la unidad es demasiado larga.";
  }

  const repetidos = roles
    .map((r) => normalizarRol(r.rol))
    .filter((rol, i, arr) => arr.indexOf(rol) !== i);
  if (repetidos.length > 0)
    return `El rol ${repetidos[0]} está repetido. Cada unidad tiene el suyo.`;

  return null;
}
