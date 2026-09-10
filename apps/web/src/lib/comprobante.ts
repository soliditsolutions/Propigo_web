/**
 * Snapshot de los comprobantes (L-CP1, L-CP2, L-CP3).
 *
 * El snapshot es la fuente de verdad congelada del documento: lo que se imprime
 * en el PDF sale de acá, no de las tablas vivas (L-CP7). Por eso guarda TODO lo
 * que el documento muestra en el momento del hecho —quién emite, sobre qué
 * inmueble, entre qué partes, con qué montos y ajustes—: si mañana cambia el
 * RUT de la corredora o la dirección del inmueble, el comprobante de ayer debe
 * seguir diciendo lo que decía ayer.
 *
 * Bajo la Ley 21.461 el comprobante fija el monto adeudado en el procedimiento
 * monitorio; un documento que no puede reconstruir sus propios números no sirve
 * como prueba. De ahí que el desglose se guarde entero, no como un total suelto.
 *
 * Estos builders son puros: no tocan base. La acción de cobros arma los datos y
 * los pasa; así el contenido del documento se puede probar sin la base.
 */
import { ivaComision, ivaArriendoIncluido } from "@housing/core";
import {
  calcularDevolucionGarantia,
  type RetencionGarantia,
  type RetencionResuelta,
} from "./garantia-devolucion";

export type EmisorSnapshot = {
  nombre: string;
  rut: string;
  giro: string | null;
  direccion: string | null;
  esPersonaJuridica: boolean;
};

export type ParteSnapshot = {
  nombre: string;
  rut: string;
};

export type InmuebleSnapshot = {
  direccion: string;
  comuna: string | null;
  rol: string;
  avaluoFiscalClp: number | null;
};

/**
 * Cuenta bancaria de destino, congelada en el documento (L-DT6). El titular
 * puede no ser el propietario (una sociedad, un apoderado), así que se guarda
 * aparte y no se deriva.
 */
export type CuentaDestinoSnapshot = {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  rutTitular: string;
};

/** Un ajuste tal como se imprime: qué es, y cuánto (L-CP1, L-CP2). */
export type AjusteSnapshot = {
  tipo: string;
  descripcion: string;
  montoClp: number;
};

type Base = {
  folio: string;
  /** Fecha del documento, ISO. */
  fecha: string;
  periodoNumero: number;
  emisor: EmisorSnapshot;
  inmueble: InmuebleSnapshot;
  arrendatario: ParteSnapshot;
  propietario: ParteSnapshot;
};

export type SnapshotPago = Base & {
  tipo: "pago";
  arriendoClp: number;
  interesClp: number;
  diasAtraso: number;
  montoGastoComunClp: number;
  denominacion: string;
  ufAplicada?: number;
  ajustes: AjusteSnapshot[];
  /** Lo efectivamente pagado. */
  totalClp: number;
  /**
   * Desglose del IVA del arriendo amoblado (L-IV4). Solo presente si el contrato
   * es amoblado. El IVA va INCLUIDO en la renta —el arrendatario paga lo mismo—;
   * esto solo muestra cómo se reparte para el SII: parte exenta (11 % del avalúo),
   * neto e IVA contenido.
   */
  ivaArriendo?: {
    exentoClp: number;
    netoClp: number;
    ivaClp: number;
    deduccionAvaluoClp: number;
  };
};

export type SnapshotLiquidacion = Base & {
  tipo: "liquidacion";
  arriendoClp: number;
  comisionClp: number;
  /** IVA de la comisión (L-IV2). 0 si la corredora es persona natural (exenta). */
  ivaComisionClp: number;
  /** Si la comisión de esta corredora va afecta a IVA (L-IV1). */
  comisionAfectaIva: boolean;
  /** Suma de descuentos y retenciones que reducen el neto al propietario. */
  descuentoPropietarioClp: number;
  /** Lo que recibe el propietario. */
  netoPropietarioClp: number;
  ajustes: AjusteSnapshot[];
  /**
   * Cuenta a la que se abona la liquidación (L-DT6). Presente solo si el
   * propietario tiene una cargada; se congela para que el documento de un mes
   * pasado siga mostrando la cuenta que se usó entonces.
   */
  cuentaPropietario?: CuentaDestinoSnapshot;
};

/** Pie obligatorio: el comprobante no es un documento tributario (L-CP10). */
export const PIE_COMPROBANTE =
  "Comprobante de gestión. No constituye documento tributario.";

/**
 * Comprobante de devolución de garantía (L-CM5). Congela el estado de cuenta
 * de la garantía al terminar el contrato: qué se recibió, cómo se reajustó, qué
 * se retuvo (con el motivo de cada retención) y qué se devuelve. Si las
 * retenciones exceden la garantía, `saldoPendienteArrendatarioClp` es lo que el
 * arrendatario aún debe —la plataforma no lo cobra, solo lo informa—.
 */
export type SnapshotGarantia = {
  tipo: "garantia";
  folio: string;
  fecha: string;
  emisor: EmisorSnapshot;
  inmueble: InmuebleSnapshot;
  arrendatario: ParteSnapshot;
  propietario: ParteSnapshot;
  /** Cómo y cuándo terminó el contrato — contexto del cierre. */
  causalTermino: string;
  tipoTermino: "normal" | "anticipado";
  fechaTermino: string;
  /** Lo depositado al inicio (asiento GARANTIA_RECIBIDA). */
  garantiaRecibidaClp: number;
  garantiaDenominacion: string | null;
  garantiaMontoBase: number | null;
  /** Diferencia UF entre lo recibido y lo restituible hoy. */
  reajusteClp: number;
  /** Garantía a restituir hoy (recibido + reajuste). */
  garantiaDisponibleClp: number;
  retenciones: RetencionResuelta[];
  retencionesTotalClp: number;
  retenidoDeGarantiaClp: number;
  devolucionClp: number;
  saldoPendienteArrendatarioClp: number;
};

export function construirSnapshotGarantia(datos: {
  folio: string;
  fecha: Date;
  emisor: EmisorSnapshot;
  inmueble: InmuebleSnapshot;
  arrendatario: ParteSnapshot;
  propietario: ParteSnapshot;
  causalTermino: string;
  tipoTermino: "normal" | "anticipado";
  fechaTermino: Date;
  garantiaRecibidaClp: number;
  garantiaDenominacion: string | null;
  garantiaMontoBase: number | null;
  garantiaDisponibleClp: number;
  retenciones: RetencionGarantia[];
}): SnapshotGarantia {
  const reajusteClp = datos.garantiaDisponibleClp - datos.garantiaRecibidaClp;
  const d = calcularDevolucionGarantia({
    garantiaDisponibleClp: datos.garantiaDisponibleClp,
    reajusteClp,
    retenciones: datos.retenciones,
  });
  return {
    tipo: "garantia",
    folio: datos.folio,
    fecha: datos.fecha.toISOString(),
    emisor: datos.emisor,
    inmueble: datos.inmueble,
    arrendatario: datos.arrendatario,
    propietario: datos.propietario,
    causalTermino: datos.causalTermino,
    tipoTermino: datos.tipoTermino,
    fechaTermino: datos.fechaTermino.toISOString(),
    garantiaRecibidaClp: datos.garantiaRecibidaClp,
    garantiaDenominacion: datos.garantiaDenominacion,
    garantiaMontoBase: datos.garantiaMontoBase,
    reajusteClp: d.reajusteClp,
    garantiaDisponibleClp: d.garantiaDisponibleClp,
    retenciones: d.retenciones,
    retencionesTotalClp: d.retencionesTotalClp,
    retenidoDeGarantiaClp: d.retenidoDeGarantiaClp,
    devolucionClp: d.devolucionClp,
    saldoPendienteArrendatarioClp: d.saldoPendienteArrendatarioClp,
  };
}

export function construirSnapshotPago(datos: {
  folio: string;
  fecha: Date;
  periodoNumero: number;
  emisor: EmisorSnapshot;
  inmueble: InmuebleSnapshot;
  arrendatario: ParteSnapshot;
  propietario: ParteSnapshot;
  arriendoClp: number;
  interesClp: number;
  diasAtraso: number;
  montoGastoComunClp: number;
  denominacion: string;
  ufAplicada?: number;
  ajustes?: AjusteSnapshot[];
  totalClp: number;
  /** Si el contrato es amoblado — activa el desglose de IVA del arriendo (L-IV4). */
  esAmoblado?: boolean;
}): SnapshotPago {
  // Arriendo amoblado: el IVA va incluido en la renta. Se descompone para el
  // documento (el cobro no cambia). Sin avalúo no se puede, así que solo se
  // calcula cuando ambos datos están; en su ausencia el comprobante sale sin
  // el desglose en vez de fallar (un pago no debe caerse por esto).
  let ivaArriendo: SnapshotPago["ivaArriendo"];
  if (datos.esAmoblado && datos.inmueble.avaluoFiscalClp != null) {
    const d = ivaArriendoIncluido({
      esAmoblado: true, rentaCLP: datos.arriendoClp, avaluoFiscalCLP: datos.inmueble.avaluoFiscalClp,
    });
    ivaArriendo = {
      exentoClp: d.exentoCLP, netoClp: d.netoCLP, ivaClp: d.ivaCLP, deduccionAvaluoClp: d.deduccionAvaluoCLP,
    };
  }
  return {
    tipo: "pago",
    folio: datos.folio,
    fecha: datos.fecha.toISOString(),
    periodoNumero: datos.periodoNumero,
    emisor: datos.emisor,
    inmueble: datos.inmueble,
    arrendatario: datos.arrendatario,
    propietario: datos.propietario,
    arriendoClp: datos.arriendoClp,
    interesClp: datos.interesClp,
    diasAtraso: datos.diasAtraso,
    montoGastoComunClp: datos.montoGastoComunClp,
    denominacion: datos.denominacion,
    ...(datos.ufAplicada !== undefined ? { ufAplicada: datos.ufAplicada } : {}),
    ajustes: datos.ajustes ?? [],
    totalClp: datos.totalClp,
    ...(ivaArriendo ? { ivaArriendo } : {}),
  };
}

export function construirSnapshotLiquidacion(datos: {
  folio: string;
  fecha: Date;
  periodoNumero: number;
  emisor: EmisorSnapshot;
  inmueble: InmuebleSnapshot;
  arrendatario: ParteSnapshot;
  propietario: ParteSnapshot;
  arriendoClp: number;
  comisionClp: number;
  descuentoPropietarioClp: number;
  netoPropietarioClp: number;
  ajustes: AjusteSnapshot[];
  /** Cuenta del propietario, o null si no tiene una cargada. */
  cuentaPropietario?: CuentaDestinoSnapshot | null;
}): SnapshotLiquidacion {
  // El IVA de la comisión se deriva de la naturaleza jurídica de la corredora
  // (L-IV1): afecta si es persona jurídica, exenta si es persona natural que
  // presta un servicio personal (DL 825 art. 12 E N° 8). Se calcula acá, sobre
  // la comisión, para que quede escrito en el documento (L-IV2).
  const iva = ivaComision(datos.comisionClp, datos.emisor.esPersonaJuridica);
  return {
    tipo: "liquidacion",
    folio: datos.folio,
    fecha: datos.fecha.toISOString(),
    periodoNumero: datos.periodoNumero,
    emisor: datos.emisor,
    inmueble: datos.inmueble,
    arrendatario: datos.arrendatario,
    propietario: datos.propietario,
    arriendoClp: datos.arriendoClp,
    comisionClp: datos.comisionClp,
    ivaComisionClp: iva.ivaCLP,
    comisionAfectaIva: iva.afecto,
    descuentoPropietarioClp: datos.descuentoPropietarioClp,
    netoPropietarioClp: datos.netoPropietarioClp,
    ajustes: datos.ajustes,
    ...(datos.cuentaPropietario ? { cuentaPropietario: datos.cuentaPropietario } : {}),
  };
}
