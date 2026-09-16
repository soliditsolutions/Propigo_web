/**
 * Retención de datos personales.
 *
 * Este módulo es la **única fuente** de los plazos: la página de privacidad los
 * publica leyendo de acá, y el proceso de purga los aplica leyendo de acá.
 *
 * Antes vivían como un arreglo de texto dentro de `privacidad/page.tsx` y no
 * existía ninguna purga, así que el sitio declaraba tres plazos que nadie
 * cumplía: los códigos de acceso «eliminados al expirar», los registros de
 * acceso a 90 días y la auditoría a 3 años. Ninguno se borraba nunca. Tener el
 * texto y el comportamiento en el mismo lugar es lo que impide que vuelvan a
 * separarse.
 *
 * Regla al agregar una categoría: si `automatica` es `true`, tiene que existir
 * la consulta que la borra en `purgarDatosVencidos`. El test lo comprueba.
 */

/** Categoría de dato con su plazo, tal como se publica y tal como se aplica. */
export type Retencion = {
  /** Identificador estable; no se muestra. */
  clave:
    | "otp" | "accesoPortal" | "auditoriaEquipo" | "cuenta" | "contratos" | "contable" | "dispositivos"
    | "codigosContacto" | "solicitudesDerecho";
  /** Cómo se le nombra a la persona que lee la política. */
  categoria: string;
  /** El plazo, en palabras. */
  periodo: string;
  /** Norma que lo fundamenta, cuando la hay. */
  fundamento?: string;
  /**
   * Si un proceso automático la borra. Lo que no es automático depende del
   * ciclo de vida de la cuenta o de un mínimo legal, y se resuelve a mano.
   */
  automatica: boolean;
  /** Antigüedad desde la cual se borra. Obligatorio si `automatica`. */
  dias?: number;
};

const ANIO = 365;

export const RETENCIONES: Retencion[] = [
  {
    clave: "otp",
    categoria: "Códigos de acceso de un solo uso",
    // El código deja de servir a los 10 minutos; la fila se borra al día
    // siguiente. Ese margen es holgura sobre la ventana de 10 minutos que usa
    // el control anti-abuso del portal, que cuenta filas recientes para limitar
    // a tres códigos por persona. Borrar antes lo dejaría sin qué contar.
    periodo: "Expiran a los 10 minutos y se eliminan dentro de las 24 horas siguientes",
    automatica: true,
    dias: 1,
  },
  {
    clave: "accesoPortal",
    categoria: "Registros de acceso al portal (incluye dirección IP)",
    periodo: "3 años",
    fundamento: "Ley 21.719",
    automatica: true,
    dias: 3 * ANIO,
  },
  {
    clave: "auditoriaEquipo",
    categoria: "Auditoría de acciones del equipo de la corredora (incluye IP)",
    periodo: "3 años",
    fundamento: "Ley 21.719",
    automatica: true,
    dias: 3 * ANIO,
  },
  {
    clave: "codigosContacto",
    categoria: "Códigos de verificación para rectificar correo o teléfono",
    // Mismo criterio que el OTP del portal: el código deja de servir a los 10
    // minutos, la fila se borra al día siguiente.
    periodo: "Expiran a los 10 minutos y se eliminan dentro de las 24 horas siguientes",
    automatica: true,
    dias: 1,
  },
  {
    clave: "solicitudesDerecho",
    categoria: "Solicitudes de ejercicio de derechos ARCO+",
    // Es la prueba de que la corredora respondió a tiempo a un derecho
    // ejercido — mismo plazo y mismo fundamento que la auditoría del equipo.
    periodo: "3 años",
    fundamento: "Ley 21.719",
    automatica: true,
    dias: 3 * ANIO,
  },
  {
    clave: "contable",
    categoria: "Registros de pagos y asientos contables",
    // Antes esta línea decía «7 años (Código Tributario art. 200)». El art. 200
    // fija SEIS. Citar una norma para un plazo que esa norma no dice es peor
    // que no citarla.
    periodo: "6 años",
    fundamento: "Código Tributario art. 200",
    automatica: false,
  },
  {
    clave: "contratos",
    categoria: "Contratos y documentos",
    periodo: "10 años desde el término",
    fundamento: "Código Civil art. 2514",
    automatica: false,
  },
  {
    clave: "cuenta",
    categoria: "Datos de cuenta del corredor",
    periodo: "Mientras la cuenta esté activa, más 5 años",
    automatica: false,
  },
  {
    clave: "dispositivos",
    categoria: "Tokens de dispositivo confiable",
    periodo: "Hasta que se revoque el dispositivo o se cierre la cuenta",
    automatica: false,
  },
];

/** Las que borra el proceso automático. */
export function retencionesAutomaticas(): (Retencion & { dias: number })[] {
  return RETENCIONES.filter(
    (r): r is Retencion & { dias: number } => r.automatica && r.dias !== undefined,
  );
}

/** Busca una categoría por su clave. Lanza si no existe: es un error de código. */
export function retencion(clave: Retencion["clave"]): Retencion {
  const r = RETENCIONES.find((x) => x.clave === clave);
  if (!r) throw new Error(`Retención desconocida: ${clave}`);
  return r;
}

/**
 * Instante a partir del cual un dato de esa antigüedad ya no se conserva.
 *
 * Se calcula en milisegundos y no restando meses o años del calendario, para
 * que el corte no dependa de en qué día del mes se ejecute la purga.
 */
export function fechaCorte(dias: number, ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() - dias * 24 * 60 * 60 * 1000);
}
