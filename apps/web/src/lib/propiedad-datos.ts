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
    // Guiones tipográficos → guión normal. Además del largo y el medio, entran
    // el de no separación y el de unión: son los que aparecen al copiar desde
    // un PDF de contribuciones, y a simple vista no se distinguen del común.
    .replace(/[‐‑‒–—]/g, "-");
}

/**
 * Forma de un RUT chileno: 7 u 8 dígitos, guión y dígito verificador.
 *
 * Se detecta aparte porque es la confusión más frecuente y el mensaje genérico
 * de formato no ayuda a alguien que acaba de pegar un RUT. Mirar solo si hay
 * letras no alcanza: eso únicamente atrapa los RUT terminados en K, que son
 * uno de cada once.
 */
const RE_RUT = /^\d{7,8}-[\dkK]$/;

/** null si el rol es válido; si no, el motivo en el idioma del corredor. */
export function validarRol(valor: string): string | null {
  const rol = normalizarRol(valor);
  if (!rol) return "El rol de avalúo es obligatorio.";
  if (RE_RUT.test(rol))
    return "Eso parece un RUT. El rol de avalúo es otro dato: viene en las contribuciones, con el formato 573-24.";
  if (/[a-zA-Z]/.test(rol))
    return "El rol de avalúo son solo números y guiones. Si estás copiando un RUT, ese es otro dato.";
  if (!RE_ROL.test(rol))
    return "Revisa el formato del rol: son dos bloques de números separados por guión, por ejemplo 573-24.";
  // La manzana y el predio se numeran desde 1, así que un bloque en cero no
  // corresponde a ningún predio. Importa además porque `0-0` fue el valor con
  // que la migración rellenó las filas existentes: sin este control, el relleno
  // técnico es indistinguible de un rol cargado de verdad.
  if (rol.split("-").some((b) => Number(b) === 0))
    return "Revisa el rol: ni la manzana ni el predio pueden ser cero.";
  return null;
}

// ── Avalúo fiscal ───────────────────────────────────────────────────────

/**
 * Techo del avalúo aceptado, en pesos.
 *
 * No es un límite legal: es un detector de dedazos. Un avalúo de vivienda en
 * Chile se cuenta en decenas o cientos de millones, así que cien mil millones
 * deja pasar cualquier caso real —incluido un edificio completo— y atrapa el
 * error de tipeo que agrega ceros de más.
 */
export const MAX_AVALUO_FISCAL = 100_000_000_000;

/**
 * null si el avalúo es válido; si no, el motivo.
 *
 * Es opcional a nivel de dato —hay propiedades cargadas antes de que este campo
 * existiera— pero deja de serlo en cuanto el contrato se marca como amoblado:
 * ahí la deducción del 11 % del DL 825 art. 17 lo necesita, y sin él la única
 * salida sería gravar la renta completa. Esa exigencia se aplica en el
 * contrato, no acá, porque es el contrato el que decide si está afecto.
 */
export function validarAvaluoFiscal(valor: number | null | undefined): string | null {
  if (valor === null || valor === undefined) return null;
  if (!Number.isFinite(valor)) return "El avalúo fiscal debe ser un número.";
  if (!Number.isInteger(valor))
    return "El avalúo fiscal va en pesos enteros, sin decimales.";
  if (valor <= 0)
    return "El avalúo fiscal debe ser mayor que cero. Si no lo tienes a mano, déjalo en blanco.";
  if (valor > MAX_AVALUO_FISCAL)
    return "Revisa el avalúo fiscal: ese monto parece tener ceros de más.";
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

/** Los valores que acepta el enum de la base. Nada fuera de acá se guarda. */
export const TIPOS_SERVICIO: TipoServicio[] = ["agua", "luz", "gas", "gastos_comunes", "otro"];

export type EntradaCuenta = {
  tipo:    TipoServicio;
  estado:  "registrada" | "no_aplica";
  numero?: string | null;
  empresa?: string | null;
  titular?: string | null;
  paga:    "arrendatario" | "propietario";
  /**
   * Cómo se llama el servicio cuando `tipo` es "otro" — internet, alarma, TV
   * cable. Los cuatro básicos se nombran solos y no la usan.
   */
  etiqueta?: string | null;
  /**
   * Si las partes del contrato la ven en el portal. El corredor la ve siempre:
   * esto decide qué comparte, no qué guarda. Por omisión se comparte, porque
   * ocultar es la excepción y no el punto de partida.
   */
  visibleEnPortal?: boolean;
};

/** Los cuatro básicos no se pueden quitar; el resto sí. */
export function esCuentaObligatoria(tipo: TipoServicio): boolean {
  return SERVICIOS_OBLIGATORIOS.some((s) => s.tipo === tipo);
}

/**
 * Nombre visible de una cuenta. Para las adicionales es lo que escribió el
 * corredor; si lo dejó en blanco no hay nada mejor que "Otro servicio".
 */
export function nombreCuenta(c: EntradaCuenta): string {
  const basico = SERVICIOS_OBLIGATORIOS.find((s) => s.tipo === c.tipo);
  if (basico) return basico.etiqueta;
  return c.etiqueta?.trim() || "Otro servicio";
}

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
    // Repetir un tipo es válido a propósito: una propiedad subdividida tiene
    // dos medidores de luz. Lo que no puede pasar es un tipo que el enum de la
    // base no conoce — sin este control llegaba tal cual a Prisma.
    if (!TIPOS_SERVICIO.includes(c.tipo))
      return "Hay un tipo de servicio que no reconocemos.";

    // Una cuenta adicional sin nombre es una fila que nadie sabe leer después:
    // los cuatro básicos se identifican por su tipo, ésta no tiene otra cosa.
    if (!esCuentaObligatoria(c.tipo)) {
      if (!c.etiqueta?.trim())
        return "Ponle nombre a la cuenta adicional (por ejemplo, Internet o Alarma).";
      if (!c.numero?.trim())
        return `Ingresa el número de la cuenta de ${c.etiqueta.trim()}, o quítala.`;
    }

    if (c.etiqueta && c.etiqueta.length > 40) return "El nombre de la cuenta es demasiado largo.";
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
    numero:   c.numero?.trim()   || null,
    empresa:  c.empresa?.trim()  || null,
    titular:  c.titular?.trim()  || null,
    etiqueta: esCuentaObligatoria(c.tipo) ? null : (c.etiqueta?.trim() || null),
  };
}

// ── Roles complementarios ───────────────────────────────────────────────

export type TipoRolComplementario = "estacionamiento" | "bodega" | "otro";

/** Los valores que acepta el enum de la base. */
export const TIPOS_COMPLEMENTO: TipoRolComplementario[] = ["estacionamiento", "bodega", "otro"];

export type EntradaRolComplementario = {
  tipo: TipoRolComplementario;
  rol: string;
  descripcion?: string | null;
  /** Igual que en las cuentas: decide qué ve el portal, no qué se guarda. */
  visibleEnPortal?: boolean;
};

/**
 * Los complementos son opcionales (G-06): la mayoría de las casas no tiene
 * ninguno. Pero si se declara uno, su rol se valida igual que el principal —
 * un rol mal escrito no sirve para nada aunque sea el de la bodega.
 */
export function validarRolesComplementarios(
  roles: EntradaRolComplementario[],
  /**
   * Rol de la propiedad. Se pasa para poder rechazar que una bodega repita el
   * rol del inmueble: el SII asigna uno distinto a cada unidad, y con el mismo
   * valor en ambos el borrador de contrato termina nombrando dos cosas
   * distintas con un solo rol.
   */
  rolPrincipal?: string,
): string | null {
  for (const r of roles) {
    if (!TIPOS_COMPLEMENTO.includes(r.tipo))
      return "Hay una unidad adicional de un tipo que no reconocemos.";
    const error = validarRol(r.rol);
    if (error) return `Rol de ${r.tipo === "otro" ? "la unidad adicional" : r.tipo}: ${error}`;
    if (r.descripcion && r.descripcion.length > 80)
      return "La descripción de la unidad es demasiado larga.";
  }

  const normalizados = roles.map((r) => normalizarRol(r.rol));

  const repetidos = normalizados.filter((rol, i, arr) => arr.indexOf(rol) !== i);
  if (repetidos.length > 0)
    return `El rol ${repetidos[0]} está repetido. Cada unidad tiene el suyo.`;

  if (rolPrincipal) {
    const principal = normalizarRol(rolPrincipal);
    if (normalizados.includes(principal))
      return `El rol ${principal} es el de la propiedad. Cada estacionamiento o bodega tiene el suyo.`;
  }

  return null;
}
