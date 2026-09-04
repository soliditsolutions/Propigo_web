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
import { ivaComision } from "@housing/core";

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
};

/** Pie obligatorio: el comprobante no es un documento tributario (L-CP10). */
export const PIE_COMPROBANTE =
  "Comprobante de gestión. No constituye documento tributario.";

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
}): SnapshotPago {
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
  };
}
