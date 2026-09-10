/**
 * Devolución de garantía con detalle de retenciones (L-CM5 / P-GA3).
 *
 * Al terminar un contrato, la garantía no se restituye como un número: se
 * descuenta un listado de retenciones, cada una con su motivo —como una boleta—,
 * y lo que sobra se devuelve al arrendatario. Este módulo hace solo el cálculo;
 * el asiento y el documento se arman a partir de su resultado.
 *
 * Si las retenciones suman más que la garantía disponible, el exceso NO se
 * cobra por la plataforma: queda informado como "saldo que el arrendatario debe
 * pagar", y el corredor lo gestiona por fuera.
 */

/** Un ítem del listado de retenciones: un motivo y su monto. */
export type RetencionGarantia = {
  descripcion: string;
  montoClp: number;
};

/** Cada retención con cuánto alcanzó a cubrir la garantía. */
export type RetencionResuelta = {
  descripcion: string;
  montoClp: number;
  /** Parte de `montoClp` que sale de la garantía. El resto es saldo pendiente. */
  cubiertoPorGarantiaClp: number;
};

export type DevolucionGarantia = {
  /** Garantía disponible hoy (ya revalorizada a la UF del día si se pactó en UF). */
  garantiaDisponibleClp: number;
  /** Diferencia UF entre lo recibido y lo que se restituye hoy (informativa). */
  reajusteClp: number;
  retenciones: RetencionResuelta[];
  /** Σ de todos los montos de retención (haya o no garantía que los cubra). */
  retencionesTotalClp: number;
  /** Lo que efectivamente sale de la garantía: `min(total, disponible)`. */
  retenidoDeGarantiaClp: number;
  /** Lo que se devuelve al arrendatario. */
  devolucionClp: number;
  /** Exceso de retenciones sobre la garantía. El corredor lo cobra por fuera. */
  saldoPendienteArrendatarioClp: number;
};

const entero = (n: number) => Math.round(n);

/**
 * Valida el listado antes de tocar nada. Devuelve el primer error, o `null` si
 * todo está bien. Mismo criterio que los ajustes de la liquidación: sin
 * descripción el cobro no queda identificado, así que no se acepta.
 */
export function validarRetenciones(items: RetencionGarantia[]): string | null {
  if (!Array.isArray(items)) return "Listado de retenciones inválido.";
  for (const it of items) {
    if (typeof it?.descripcion !== "string" || it.descripcion.trim().length === 0) {
      return "Cada retención necesita un motivo.";
    }
    if (it.descripcion.trim().length > 200) {
      return "El motivo de la retención es demasiado largo.";
    }
    if (!Number.isFinite(it.montoClp) || it.montoClp <= 0 || entero(it.montoClp) !== it.montoClp) {
      return "El monto de cada retención debe ser un número entero de pesos mayor que cero.";
    }
  }
  return null;
}

/**
 * Reparte la garantía disponible contra el listado de retenciones, en orden.
 * Cada retención se cubre con lo que queda de garantía; lo que no alcanza se
 * acumula como saldo pendiente del arrendatario.
 */
export function calcularDevolucionGarantia(input: {
  garantiaDisponibleClp: number;
  reajusteClp?: number;
  retenciones: RetencionGarantia[];
}): DevolucionGarantia {
  const garantiaDisponibleClp = Math.max(0, entero(input.garantiaDisponibleClp));
  const reajusteClp = entero(input.reajusteClp ?? 0);

  let restante = garantiaDisponibleClp;
  const retenciones: RetencionResuelta[] = input.retenciones.map((it) => {
    const monto = entero(it.montoClp);
    const cubierto = Math.min(monto, restante);
    restante -= cubierto;
    return { descripcion: it.descripcion.trim(), montoClp: monto, cubiertoPorGarantiaClp: cubierto };
  });

  const retencionesTotalClp = retenciones.reduce((s, r) => s + r.montoClp, 0);
  const retenidoDeGarantiaClp = garantiaDisponibleClp - restante;
  const devolucionClp = garantiaDisponibleClp - retenidoDeGarantiaClp;
  const saldoPendienteArrendatarioClp = retencionesTotalClp - retenidoDeGarantiaClp;

  return {
    garantiaDisponibleClp,
    reajusteClp,
    retenciones,
    retencionesTotalClp,
    retenidoDeGarantiaClp,
    devolucionClp,
    saldoPendienteArrendatarioClp,
  };
}
