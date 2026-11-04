/**
 * Reglas del cambio de plan — P-B6 (upgrade/downgrade) y P-B7 (gate de downgrade)
 * del rowMap de pagos. Funciones puras: sin base ni pasarela.
 *
 * - D-18: el upgrade lo elige el Manager. (a) Al próximo ciclo, sin cobro extra,
 *   o (b) inmediato, pagando la diferencia COMPLETA del mes en curso entre ambos
 *   planes — sin prorrateo por días, coherente con D-13.
 * - D-05: el downgrade se agenda al fin del período pagado y solo si la cuenta
 *   YA cumple los límites del plan destino. El sistema nunca borra: es el
 *   Manager quien libera cupo (elimina propiedades, desactiva colaboradores).
 *
 * La diferencia se calcula sobre el precio mensual: hoy no existen suscripciones
 * anuales (el alta P-B3 está pendiente) y el upgrade inmediato de un plan anual
 * es una decisión abierta (D-19 en el rowMap).
 */
import { PLANS, type Plan } from "../plans";

export type TipoCambio = "upgrade" | "downgrade";
export type ModalidadUpgrade = "proximo_ciclo" | "inmediato";

export const MODALIDADES_UPGRADE: readonly ModalidadUpgrade[] = ["proximo_ciclo", "inmediato"];

/** Upgrade o downgrade según el orden de PLANS (de menor a mayor). Null si es el mismo plan. */
export function tipoDeCambio(origen: Plan, destino: Plan): TipoCambio | null {
  const i = PLANS.findIndex((p) => p.id === origen.id);
  const j = PLANS.findIndex((p) => p.id === destino.id);
  if (i === j) return null;
  return j > i ? "upgrade" : "downgrade";
}

/**
 * Lo que se paga al subir de plan de inmediato (D-18 b): la diferencia completa
 * del mes entre el plan nuevo y el actual, en UF y sin IVA.
 */
export function diferenciaUpgradeUf(origen: Plan, destino: Plan): number {
  if (tipoDeCambio(origen, destino) !== "upgrade") {
    throw new Error(`De ${origen.id} a ${destino.id} no es un upgrade.`);
  }
  // Redondeo a centésimas: los precios ya vienen con 2 decimales y la resta en
  // coma flotante deja colas (0.30000000000000004).
  return Math.round((destino.mensualUf - origen.mensualUf) * 100) / 100;
}

/** Uso actual de la cuenta, contado igual que en el enforcement (ver getUsoCupos). */
export type UsoCupos = { propiedades: number; usuarios: number };

export type Excedente = {
  recurso: "propiedades" | "usuarios";
  uso: number;
  max: number;
  /** Cuántos hay que liberar para poder bajar. */
  sobran: number;
};

/**
 * Gate de downgrade (P-B7): qué sobra para caber en el plan destino. Vacío =
 * puede bajar. Solo cuentan los límites que obligarían a borrar o desactivar
 * algo; perder una funcionalidad (exportar, tokens de IA) no bloquea.
 */
export function excedentesParaPlan(destino: Plan, uso: UsoCupos): Excedente[] {
  const excedentes: Excedente[] = [];
  if (uso.propiedades > destino.maxPropiedades) {
    excedentes.push({
      recurso: "propiedades", uso: uso.propiedades, max: destino.maxPropiedades,
      sobran: uso.propiedades - destino.maxPropiedades,
    });
  }
  if (uso.usuarios > destino.maxUsuarios) {
    excedentes.push({
      recurso: "usuarios", uso: uso.usuarios, max: destino.maxUsuarios,
      sobran: uso.usuarios - destino.maxUsuarios,
    });
  }
  return excedentes;
}
