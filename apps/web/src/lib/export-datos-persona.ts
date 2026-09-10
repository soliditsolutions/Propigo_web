/**
 * Derecho de acceso y portabilidad — Ley 21.719, Título III (L-DP2 / L-DP3).
 *
 * Reúne, para una persona y dentro de una corredora, todo lo que la plataforma
 * guarda sobre ella. El resultado alimenta dos entregas:
 *   · el JSON estructurado (portabilidad: reutilizable por máquina);
 *   · el PDF legible (acceso: copia intelligible para la persona).
 *
 * Minimización de la contraparte: un contrato involucra a dos personas. En el
 * export de una de ellas la otra aparece **solo por su nombre** —que la persona
 * ya conoce por haber firmado el contrato—, nunca su RUT, contacto ni cuenta.
 *
 * Se ejecuta dentro de `withTenant(...)`: el `tx` ya está acotado por RLS a la
 * corredora, y además se filtra por `tenantId` en cada consulta.
 */
import type { TenantClient } from "./tenant-db";

/** Instantánea de datos personales lista para serializar. */
export type ExportDatosPersona = {
  meta: {
    generadoEl: string;
    fundamento: string;
    responsable: { nombre: string; rut: string };
    alcance: string;
  };
  identidad: {
    nombre: string;
    rut: string;
    email: string | null;
    telefono: string | null;
    canalDeAccesoPreferido: string | null;
    registradaEl: string;
  };
  contratos: ContratoExport[];
  cuentasBancarias: CuentaExport[];
  documentos: DocumentoExport[];
  comunicaciones: ComunicacionExport[];
  registrosDeAcceso: AccesoExport[];
  solicitudesDeCodigoDeAcceso: SolicitudCodigoExport[];
  reservas: ReservaExport[];
  preferenciaDeNotificacion: PreferenciaExport | null;
  valoraciones: ValoracionExport[];
};

type ContratoExport = {
  rol: "arrendatario" | "propietario";
  estado: string;
  inmueble: { direccion: string; comuna: string | null; rolAvaluo: string };
  contraparte: { nombre: string };
  denominacion: string;
  valorArriendo: string;
  cobraGastoComun: boolean;
  comisionCorredorPct: string;
  esAmoblado: boolean;
  fechaInicio: string;
  fechaFin: string | null;
  fechaTermino: string | null;
  causalTermino: string | null;
  firmadoAnteNotario: boolean;
  periodos: {
    numero: number;
    vencimiento: string;
    montoBase: string;
    montoGastoComun: string;
    estado: string;
    pagadoEl: string | null;
  }[];
  comprobantes: { folio: string | null; tipo: string; fecha: string; montoCLP: string }[];
};

type CuentaExport = {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  rutTitular: string;
  email: string | null;
  esDeLaCorredora: boolean;
};

type DocumentoExport = { nombre: string; tipo: string; fecha: string; via: string };
type ComunicacionExport = { fecha: string; tipo: string; canal: string; asunto: string; estado: string };
type AccesoExport = { fecha: string; accion: string; ip: string | null };
type SolicitudCodigoExport = { fecha: string; canal: string; ip: string | null; usado: boolean };
type ReservaExport = { inmueble: string; fechaReserva: string; vigenteHasta: string | null; estado: string };
type PreferenciaExport = { suscrito: boolean; bajaHasta: string | null; motivo: string | null; actualizadaEl: string };
type ValoracionExport = { fecha: string; estrellas: number; comentario: string | null; visible: boolean };

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const dec = (v: unknown) => (v == null ? "0" : String(v));

/** No existe: es un error de programación pedir el export de una persona ajena. */
export class PersonaNoEncontrada extends Error {
  constructor() {
    super("Persona no encontrada en esta corredora.");
    this.name = "PersonaNoEncontrada";
  }
}

export async function construirExportDatosPersona(
  tx: TenantClient,
  tenantId: string,
  personaId: string,
): Promise<ExportDatosPersona> {
  const persona = await tx.persona.findFirst({
    where: { id: personaId, tenantId },
    select: {
      nombre: true, rut: true, email: true, telefono: true,
      canalAccesoPref: true, createdAt: true,
    },
  });
  if (!persona) throw new PersonaNoEncontrada();

  const tenant = await tx.tenant.findFirstOrThrow({
    where: { id: tenantId }, select: { nombre: true, rut: true },
  });

  const contratosRaw = await tx.contrato.findMany({
    where: { tenantId, OR: [{ arrendatarioId: personaId }, { propietarioId: personaId }] },
    orderBy: { fechaInicio: "asc" },
    select: {
      id: true, estado: true, denominacion: true, valorArriendo: true,
      cobraGastoComun: true, comisionCorredorPct: true, esAmoblado: true,
      fechaInicio: true, fechaFin: true, fechaTermino: true, causalTermino: true,
      firmadoAnteNotario: true, arrendatarioId: true,
      arrendatario: { select: { nombre: true } },
      propietario: { select: { nombre: true } },
      propiedad: { select: { direccion: true, comuna: true, rol: true } },
      periodos: {
        orderBy: { numero: "asc" },
        select: {
          numero: true, fechaVencimiento: true, montoBase: true,
          montoGastoComun: true, estado: true, fechaPagoReal: true,
        },
      },
      vouchers: {
        orderBy: { fecha: "asc" },
        select: { folio: true, tipo: true, fecha: true, montoClp: true },
      },
    },
  });

  const contratos: ContratoExport[] = contratosRaw.map((c) => {
    const esArrendatario = c.arrendatarioId === personaId;
    return {
      rol: esArrendatario ? "arrendatario" : "propietario",
      estado: c.estado,
      inmueble: { direccion: c.propiedad.direccion, comuna: c.propiedad.comuna, rolAvaluo: c.propiedad.rol },
      contraparte: { nombre: esArrendatario ? c.propietario.nombre : c.arrendatario.nombre },
      denominacion: c.denominacion,
      valorArriendo: dec(c.valorArriendo),
      cobraGastoComun: c.cobraGastoComun,
      comisionCorredorPct: dec(c.comisionCorredorPct),
      esAmoblado: c.esAmoblado,
      fechaInicio: ymd(c.fechaInicio)!,
      fechaFin: ymd(c.fechaFin),
      fechaTermino: ymd(c.fechaTermino),
      causalTermino: c.causalTermino,
      firmadoAnteNotario: c.firmadoAnteNotario,
      periodos: c.periodos.map((p) => ({
        numero: p.numero,
        vencimiento: ymd(p.fechaVencimiento)!,
        montoBase: dec(p.montoBase),
        montoGastoComun: dec(p.montoGastoComun),
        estado: p.estado,
        pagadoEl: ymd(p.fechaPagoReal),
      })),
      comprobantes: c.vouchers.map((v) => ({
        folio: v.folio,
        tipo: v.tipo,
        fecha: ymd(v.fecha)!,
        montoCLP: dec(v.montoClp),
      })),
    };
  });

  const contratoIds = contratosRaw.map((c) => c.id);

  const cuentasRaw = await tx.cuentaBancaria.findMany({
    where: { tenantId, personaId },
    select: { banco: true, tipo: true, numero: true, titular: true, rutTitular: true, email: true },
  });
  const cuentasBancarias: CuentaExport[] = cuentasRaw.map((c) => ({
    banco: c.banco, tipo: c.tipo, numero: c.numero, titular: c.titular,
    rutTitular: c.rutTitular, email: c.email, esDeLaCorredora: false,
  }));

  // Documentos: no tienen `personaId`; se llegan por un contrato de la persona.
  const documentosRaw = contratoIds.length
    ? await tx.documento.findMany({
        where: { tenantId, contratoId: { in: contratoIds } },
        orderBy: { createdAt: "asc" },
        select: { nombre: true, tipo: true, createdAt: true },
      })
    : [];
  const documentos: DocumentoExport[] = documentosRaw.map((d) => ({
    nombre: d.nombre, tipo: d.tipo, fecha: ymd(d.createdAt)!, via: "contrato",
  }));

  const notifsRaw = await tx.notificacion.findMany({
    where: { tenantId, personaId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, tipo: true, canal: true, asunto: true, estado: true },
  });
  const comunicaciones: ComunicacionExport[] = notifsRaw.map((n) => ({
    fecha: iso(n.createdAt)!, tipo: n.tipo, canal: n.canal, asunto: n.asunto, estado: n.estado,
  }));

  const accesosRaw = await tx.accesoLog.findMany({
    where: { tenantId, personaId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, accion: true, ip: true },
  });
  const registrosDeAcceso: AccesoExport[] = accesosRaw.map((a) => ({
    fecha: iso(a.createdAt)!, accion: a.accion, ip: a.ip,
  }));

  // OTP: se conserva el hecho de la solicitud, nunca el hash del código.
  const otpRaw = await tx.accesoOtp.findMany({
    where: { tenantId, personaId },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, canal: true, ipSolicitud: true, usadoEn: true },
  });
  const solicitudesDeCodigoDeAcceso: SolicitudCodigoExport[] = otpRaw.map((o) => ({
    fecha: iso(o.createdAt)!, canal: o.canal, ip: o.ipSolicitud, usado: o.usadoEn != null,
  }));

  const reservasRaw = await tx.reserva.findMany({
    where: { tenantId, personaId },
    orderBy: { createdAt: "asc" },
    select: {
      fechaReserva: true, vigenteHasta: true, estado: true,
      propiedad: { select: { direccion: true } },
    },
  });
  const reservas: ReservaExport[] = reservasRaw.map((r) => ({
    inmueble: r.propiedad.direccion,
    fechaReserva: ymd(r.fechaReserva)!,
    vigenteHasta: ymd(r.vigenteHasta),
    estado: r.estado,
  }));

  const prefRaw = await tx.preferenciaNotificacion.findFirst({
    where: { tenantId, personaId },
    select: { suscrito: true, bajaHasta: true, motivo: true, actualizadoEn: true },
  });
  const preferenciaDeNotificacion: PreferenciaExport | null = prefRaw
    ? {
        suscrito: prefRaw.suscrito,
        bajaHasta: ymd(prefRaw.bajaHasta),
        motivo: prefRaw.motivo,
        actualizadaEl: iso(prefRaw.actualizadoEn)!,
      }
    : null;

  // Valoraciones: sin `personaId`; se asocian por el contrato de la persona.
  const valoracionesRaw = contratoIds.length
    ? await tx.valoracionCorredor.findMany({
        where: { tenantId, contratoId: { in: contratoIds } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, estrellas: true, comentario: true, esVisible: true },
      })
    : [];
  const valoraciones: ValoracionExport[] = valoracionesRaw.map((v) => ({
    fecha: iso(v.createdAt)!, estrellas: v.estrellas, comentario: v.comentario, visible: v.esVisible,
  }));

  return {
    meta: {
      generadoEl: new Date().toISOString(),
      fundamento:
        "Ley 21.719 sobre protección de datos personales, Título III — derechos de acceso y de portabilidad.",
      responsable: { nombre: tenant.nombre, rut: tenant.rut },
      alcance:
        "Todos los datos personales tratados por la corredora responsable a través de la plataforma Housing SOLIDIT. " +
        "Los datos de la contraparte de cada contrato se limitan a su nombre.",
    },
    identidad: {
      nombre: persona.nombre,
      rut: persona.rut,
      email: persona.email,
      telefono: persona.telefono,
      canalDeAccesoPreferido: persona.canalAccesoPref,
      registradaEl: iso(persona.createdAt)!,
    },
    contratos,
    cuentasBancarias,
    documentos,
    comunicaciones,
    registrosDeAcceso,
    solicitudesDeCodigoDeAcceso,
    reservas,
    preferenciaDeNotificacion,
    valoraciones,
  };
}

/** Nombre de archivo para la descarga: `datos-personales-11111111-1-2026-09-10`. */
export function nombreArchivoExport(rut: string, ext: "json" | "pdf"): string {
  const rutLimpio = rut.replace(/[^0-9kK-]/g, "");
  const fecha = new Date().toISOString().slice(0, 10);
  return `datos-personales-${rutLimpio}-${fecha}.${ext}`;
}
