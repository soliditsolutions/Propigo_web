/**
 * Planes de suscripción — fuente única de precios y límites.
 *
 * PRECIOS EN UF + IVA (decisión D-01, ADR-0014). Antes estaban en USD, lo que
 * no servía: todas las pasarelas chilenas liquidan en CLP, y cotizar en dólares
 * habría hecho variar el precio mes a mes sin que el corredor aceptara ningún
 * alza. La UF es el estándar chileno para contratos recurrentes y absorbe la
 * inflación sin necesidad de "subir precios".
 *
 * El anual equivale a 10 meses (2 meses gratis ⇒ 16,7 % de descuento).
 *
 * LOS LÍMITES DE ACÁ SE APLICAN DE VERDAD. Hasta la Fase B0 eran solo texto de
 * marketing: se vendían "slots de propiedades" y "tokens de IA" que nada en el
 * código contaba. No se pueden cobrar precios diferenciados por límites que no
 * se aplican, así que cada número de este archivo tiene un helper de cupo y un
 * punto de enforcement en el servidor.
 */

/**
 * IVA chileno. La tasa vive en `@propigo/core` porque también la necesita el
 * IVA del arriendo amoblado, que es dominio financiero y no billing de Propigo.
 * Se reexporta acá para no romper a quien ya la importaba desde este módulo.
 */
import { IVA_PCT } from "@propigo/core";
export { IVA_PCT };

/** Meses que se pagan en el plan anual (12 − 2 de regalo). */
export const MESES_PAGADOS_ANUAL = 10;

export type PlanId = "bronze" | "silver" | "gold" | "diamond";

export type PlanFeature = {
  /** Línea corta que se muestra en la card (una feature = una línea). */
  text: string;
  /** Explicación de la jerga ("slots", "tokens") — se muestra como tooltip
   * junto a la feature, en vez de alargar la línea con paréntesis. */
  tooltip?: string;
};

export type Plan = {
  id: PlanId;
  name: string;
  /** Subtítulo de la card: a quién está dirigido el plan. */
  tagline: string;
  /** Precio mensual en UF, sin IVA. */
  mensualUf: number;
  /** Precio anual en UF, sin IVA (= mensualUf × MESES_PAGADOS_ANUAL). */
  anualUf: number;
  /** Etiqueta de ahorro que aparece al facturar anual. */
  annualSavings: string;
  features: PlanFeature[];
  /**
   * Cupo de propiedades del tenant. Cuenta TODAS las propiedades sin importar
   * su estado (borrador, disponible, reservada, arrendada) — coherente con el
   * tooltip ya publicado. Decisión N-05.
   */
  maxPropiedades: number;
  /** Cupo de usuarios del tenant (Manager incluido) — ADR-0013 Fase E. */
  maxUsuarios: number;
  /** Revisiones de contrato con IA por día. Se reinicia cada día. */
  tokensDiarios: number;
  /** Si el plan permite exportar información (CSV). */
  permiteExportar: boolean;
  /** Plan destacado visualmente ("Más popular"). */
  featured?: boolean;
};

const TOOLTIP_SLOTS =
  "Espacios para propiedades en arriendo — cuentan las disponibles, las arrendadas y las en pausa.";
const TOOLTIP_TOKENS =
  "Cada token equivale a una revisión de contrato con IA. El cupo se renueva todos los días.";

function propiedadesFeatureText(max: number): string {
  return `Hasta ${max} propiedades`;
}

function usuariosFeatureText(maxUsuarios: number): string {
  return maxUsuarios === 1
    ? "Acceso para 1 usuario"
    : `Acceso multiusuario: hasta ${maxUsuarios} usuarios`;
}

function tokensFeatureText(tokens: number): string {
  return `${tokens} tokens diarios de IA`;
}

/**
 * Única fuente de los 4 planes — la usa la parada "Nuestros Planes" del
 * escenario walkthrough (ver PlanesStop.tsx) y todo el enforcement de cupos.
 *
 * Nota sobre las features: describen SOLO lo que el producto hace hoy. Se
 * quitaron a propósito promesas que no existen todavía ("roles y permisos
 * configurables" — el sistema tiene exactamente dos roles fijos, Manager y
 * Colaborador, ver ADR-0013). Vender una capacidad inexistente se cae con el
 * primer cliente que la busque.
 */
export const PLANS: Plan[] = [
  {
    id: "bronze",
    name: "Bronze",
    tagline:
      "Ideal para corredores independientes que están comenzando a administrar sus primeras propiedades.",
    mensualUf: 0.25,
    anualUf: 2.5,
    annualSavings: "2 meses gratis",
    maxPropiedades: 10,
    maxUsuarios: 1,
    tokensDiarios: 3,
    permiteExportar: false,
    features: [
      { text: propiedadesFeatureText(10), tooltip: TOOLTIP_SLOTS },
      { text: usuariosFeatureText(1) },
      { text: tokensFeatureText(3), tooltip: TOOLTIP_TOKENS },
      { text: "Analítica básica de cartera" },
      { text: "Herramientas de administración y automatización" },
      { text: "Soporte técnico estándar" },
    ],
  },
  {
    id: "silver",
    name: "Silver",
    tagline:
      "Para corredores y pequeñas agencias que están haciendo crecer su cartera.",
    mensualUf: 0.5,
    anualUf: 5,
    annualSavings: "2 meses gratis",
    maxPropiedades: 25,
    maxUsuarios: 1,
    tokensDiarios: 10,
    permiteExportar: false,
    features: [
      { text: propiedadesFeatureText(25), tooltip: TOOLTIP_SLOTS },
      { text: usuariosFeatureText(1) },
      { text: tokensFeatureText(10), tooltip: TOOLTIP_TOKENS },
      { text: "Analítica intermedia de desempeño" },
      { text: "Herramientas de administración y automatización" },
      { text: "Soporte técnico estándar" },
    ],
  },
  {
    id: "gold",
    name: "Gold",
    tagline:
      "Para agencias en crecimiento que necesitan administrar su operación en equipo.",
    mensualUf: 0.9,
    anualUf: 9,
    annualSavings: "2 meses gratis",
    maxPropiedades: 75,
    maxUsuarios: 5,
    tokensDiarios: 30,
    permiteExportar: true,
    featured: true,
    features: [
      { text: propiedadesFeatureText(75), tooltip: TOOLTIP_SLOTS },
      { text: usuariosFeatureText(5) },
      { text: tokensFeatureText(30), tooltip: TOOLTIP_TOKENS },
      { text: "Analítica avanzada de cartera" },
      { text: "Exportación de información" },
      { text: "Herramientas avanzadas de administración y automatización" },
      { text: "Soporte prioritario" },
    ],
  },
  {
    id: "diamond",
    name: "Diamond",
    tagline:
      "Para agencias consolidadas y administradoras con grandes carteras de propiedades.",
    mensualUf: 1.7,
    anualUf: 17,
    annualSavings: "2 meses gratis",
    maxPropiedades: 200,
    maxUsuarios: 10,
    // "IA de alto uso" del brief comercial, aterrizado a un número: el sistema
    // necesita un tope concreto para poder aplicarlo, y "ilimitado" sería un
    // costo abierto contra la API de IA que no controlamos. Decisión N-02.
    tokensDiarios: 100,
    permiteExportar: true,
    features: [
      { text: propiedadesFeatureText(200), tooltip: TOOLTIP_SLOTS },
      { text: usuariosFeatureText(10) },
      { text: tokensFeatureText(100), tooltip: TOOLTIP_TOKENS },
      { text: "Analítica premium de cartera" },
      { text: "Exportación avanzada de información" },
      { text: "Herramientas completas de administración y automatización" },
      { text: "Migración asistida de cartera" },
      { text: "Onboarding y capacitación inicial al equipo" },
      { text: "Soporte prioritario" },
    ],
  },
];

const PLAN_POR_ID = new Map<PlanId, Plan>(PLANS.map((p) => [p.id, p]));

/**
 * Plan efectivo de un tenant a partir del string guardado.
 *
 * `Tenant.plan` es un string libre (todo signup nuevo recibe "Gratuito"), así
 * que cualquier valor desconocido cae en **Bronze**, el plan más bajo — nunca
 * en "sin límite". Es deliberado: un fallo o un dato corrupto en billing debe
 * restringir, jamás abrir permisos.
 */
export function getPlanEfectivo(plan: string | null): Plan {
  return PLAN_POR_ID.get(plan as PlanId) ?? PLAN_POR_ID.get("bronze")!;
}

/** Cupo de usuarios (Manager + Colaboradores activos + invitaciones pendientes). */
export function getCupoUsuarios(plan: string | null): number {
  return getPlanEfectivo(plan).maxUsuarios;
}

/** Cupo de propiedades del tenant (cuenta todos los estados — ver N-05). */
export function getCupoPropiedades(plan: string | null): number {
  return getPlanEfectivo(plan).maxPropiedades;
}

/** Revisiones de contrato con IA permitidas por día. */
export function getCupoTokensDiarios(plan: string | null): number {
  return getPlanEfectivo(plan).tokensDiarios;
}

/** Si el plan habilita exportar información (CSV). */
export function puedeExportar(plan: string | null): boolean {
  return getPlanEfectivo(plan).permiteExportar;
}

// ── Precios ────────────────────────────────────────────────────────────────

/** Precio en UF, sin IVA, según el ciclo elegido. */
export function precioUf(plan: Plan, ciclo: "mensual" | "anual"): number {
  return ciclo === "anual" ? plan.anualUf : plan.mensualUf;
}

/**
 * Convierte un precio en UF a su desglose en CLP (neto, IVA y total).
 *
 * El valor de la UF se recibe como parámetro en vez de leerse acá adentro: al
 * emitir un cargo hay que **congelar** la UF del día y guardarla junto al monto
 * (decisión N-03), y eso solo puede decidirlo quien emite el cargo. Una función
 * que fuera a buscar la UF por su cuenta daría un resultado distinto en cada
 * llamada y haría imposible reproducir un cobro pasado.
 *
 * Los montos en CLP son enteros: el peso chileno no tiene decimales.
 */
export function desglosarPrecioClp(
  montoUf: number,
  valorUfClp: number,
): { netoClp: number; ivaClp: number; totalClp: number } {
  const netoClp = Math.round(montoUf * valorUfClp);
  const ivaClp = Math.round((netoClp * IVA_PCT) / 100);
  return { netoClp, ivaClp, totalClp: netoClp + ivaClp };
}
