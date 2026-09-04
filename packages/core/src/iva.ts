import { redondearPeso, type CLP } from "./dinero";

/**
 * IVA del arriendo y de la comisión (DL 825).
 *
 * Hasta acá el proyecto solo conocía el IVA de la suscripción a Housing
 * (`apps/web/src/lib/plans.ts`). Ese es otro dinero: lo que Housing le cobra al
 * corredor. Este módulo trata el IVA del **arriendo**, que es plata de las
 * partes del contrato y por eso vive en el núcleo junto al resto del dominio
 * financiero. La tasa pasó a estar acá y `plans.ts` la reexporta, para que siga
 * habiendo un solo lugar donde vive.
 *
 * Dos reglas independientes, que se resuelven por separado:
 *
 *  1. **El arriendo.** Por regla general el arrendamiento de inmuebles es
 *     exento. El DL 825 art. 8 letra g) lo grava cuando el inmueble se arrienda
 *     **amoblado**, o con instalaciones o maquinarias que permitan ejercer una
 *     actividad comercial o industrial. Housing hoy solo modela el caso
 *     amoblado (`Contrato.esAmoblado`); el de instalaciones comerciales queda
 *     fuera del alcance del producto, que es arriendo habitacional.
 *
 *  2. **La comisión de la corredora.** Afecta a IVA si la corredora es persona
 *     jurídica. Si es persona natural que emite boleta de honorarios, sus
 *     ingresos caen bajo el art. 42 de la Ley de la Renta y el DL 825
 *     art. 12 letra E N° 8 los exime. De ahí que `Tenant.esPersonaJuridica`
 *     sea un dato y no una preferencia.
 *
 * La deducción del 11 % (art. 17) es lo que hace que este cálculo no sea
 * «renta × 19 %»: sobre un arriendo amoblado, el impuesto no se aplica a la
 * renta completa sino a lo que queda después de descontar el valor imputado al
 * inmueble desnudo. Ignorarla significa cobrarle de más al arrendatario.
 *
 * Este módulo calcula; no decide si el contrato está afecto. Esa decisión es
 * del corredor al marcar el contrato, y su abogado la respalda
 * (ver `Docs/funcional/documentos-de-pago-y-cumplimiento-sii.md`).
 */

/**
 * Tasa del IVA en Chile. Fuente única del proyecto: tanto la suscripción a
 * Housing como el arriendo la leen de acá.
 */
export const IVA_PCT = 19;

/**
 * Porcentaje **anual** del avalúo fiscal deducible de la renta para determinar
 * la base imponible (DL 825 art. 17, inciso segundo). Se prorratea al período:
 * un mes deduce la doceava parte.
 */
export const DEDUCCION_AVALUO_PCT_ANUAL = 11;

/** Desglose de un monto afecto —o exento— de IVA. */
export type DesgloseIva = {
  /** Si la operación está gravada. Cuando es `false` el IVA es 0. */
  afecto: boolean;
  /** Monto sobre el cual se aplica la tasa. */
  baseImponibleCLP: CLP;
  /** Impuesto resultante. */
  ivaCLP: CLP;
  /** Lo que efectivamente se cobra: base + IVA. */
  totalCLP: CLP;
  /**
   * Deducción del 11 % aplicada. Se devuelve para poder imprimirla en el
   * comprobante: sin ella el arrendatario no puede reconstruir la base y el
   * documento no le sirve como respaldo.
   */
  deduccionAvaluoCLP: CLP;
};

/**
 * Deducción del avalúo correspondiente a un período.
 *
 * `mesesDelPeriodo` existe porque el art. 17 habla de un 11 % **anual** y manda
 * usar «la proporción correspondiente» cuando el arrendamiento es por períodos
 * distintos de un año. El caso normal de Housing es mensual (1).
 */
export function deduccionAvaluo(
  avaluoFiscalCLP: CLP,
  mesesDelPeriodo = 1,
): CLP {
  if (!Number.isFinite(avaluoFiscalCLP) || avaluoFiscalCLP < 0) {
    throw new Error("deduccionAvaluo: el avalúo fiscal no puede ser negativo");
  }
  if (!Number.isFinite(mesesDelPeriodo) || mesesDelPeriodo <= 0) {
    throw new Error("deduccionAvaluo: el período debe ser mayor que cero");
  }
  return redondearPeso(
    (avaluoFiscalCLP * DEDUCCION_AVALUO_PCT_ANUAL / 100) * (mesesDelPeriodo / 12),
  );
}

export type ArriendoIvaInput = {
  /** Lo que marca al contrato como gravado (DL 825 art. 8 g). */
  esAmoblado: boolean;
  /** Renta del período, ya convertida a pesos si venía en UF. */
  rentaCLP: CLP;
  /**
   * Avalúo fiscal del inmueble. Puede faltar en un contrato no amoblado, donde
   * no se usa; en uno amoblado es obligatorio y su ausencia es un error.
   */
  avaluoFiscalCLP?: CLP | null;
  /** Proporción del año que cubre el período. Mensual = 1. */
  mesesDelPeriodo?: number;
};

/**
 * IVA de la renta de un período.
 *
 * Falla —en vez de asumir cero— cuando el contrato es amoblado y no hay
 * avalúo: sin ese dato la única salida sería gravar la renta completa, que es
 * cobrarle de más al arrendatario. Es un error de datos que hay que atajar
 * antes, al marcar el contrato como amoblado, no acá.
 */
export function ivaArriendo(input: ArriendoIvaInput): DesgloseIva {
  const { esAmoblado, rentaCLP, avaluoFiscalCLP = null, mesesDelPeriodo = 1 } = input;

  if (!Number.isFinite(rentaCLP) || rentaCLP < 0) {
    throw new Error("ivaArriendo: la renta no puede ser negativa");
  }

  if (!esAmoblado) {
    return {
      afecto: false,
      baseImponibleCLP: rentaCLP,
      ivaCLP: 0,
      totalCLP: rentaCLP,
      deduccionAvaluoCLP: 0,
    };
  }

  if (avaluoFiscalCLP === null || avaluoFiscalCLP === undefined) {
    throw new Error(
      "ivaArriendo: un arriendo amoblado necesita el avalúo fiscal de la " +
      "propiedad para calcular la deducción del 11 % (DL 825 art. 17)",
    );
  }

  const deduccionAvaluoCLP = deduccionAvaluo(avaluoFiscalCLP, mesesDelPeriodo);

  // La deducción puede superar la renta —un avalúo alto con una renta baja— y
  // en ese caso la base es cero, no negativa: el art. 17 permite descontar,
  // no generar un impuesto a favor.
  const baseImponibleCLP = Math.max(0, rentaCLP - deduccionAvaluoCLP);
  const ivaCLP = redondearPeso((baseImponibleCLP * IVA_PCT) / 100);

  return {
    afecto: true,
    baseImponibleCLP,
    ivaCLP,
    // El total es la renta pactada más el impuesto. La deducción reduce la
    // base sobre la que se calcula el IVA, no lo que el arrendatario paga de
    // arriendo: la renta se cobra completa.
    totalCLP: rentaCLP + ivaCLP,
    deduccionAvaluoCLP,
  };
}

/**
 * IVA de la comisión de la corredora.
 *
 * `esPersonaJuridica` decide: una SpA o Ltda presta un servicio afecto; una
 * persona natural que emite boleta de honorarios queda exenta por el
 * DL 825 art. 12 E N° 8.
 */
export function ivaComision(
  comisionCLP: CLP,
  esPersonaJuridica: boolean,
): DesgloseIva {
  if (!Number.isFinite(comisionCLP) || comisionCLP < 0) {
    throw new Error("ivaComision: la comisión no puede ser negativa");
  }

  const ivaCLP = esPersonaJuridica
    ? redondearPeso((comisionCLP * IVA_PCT) / 100)
    : 0;

  return {
    afecto: esPersonaJuridica,
    baseImponibleCLP: comisionCLP,
    ivaCLP,
    totalCLP: comisionCLP + ivaCLP,
    deduccionAvaluoCLP: 0,
  };
}
