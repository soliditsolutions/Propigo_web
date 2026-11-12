/**
 * Derecho de supresión (L-DP5, Ley 21.719): anonimización irreversible de una
 * persona sin romper el ledger inmutable. Criterio L-05, pendiente de confirmar
 * por el abogado.
 *
 * Qué se hace: la ficha de la persona queda sin identidad (nombre, RUT, correo,
 * teléfono) y se borran sus datos de contacto y de uso (avisos, códigos de
 * acceso, registros con IP, preferencias, cuentas bancarias, solicitudes de
 * derechos del portal).
 *
 * Qué NO se hace, a propósito: los asientos del ledger y los comprobantes
 * (`Voucher`) se conservan. El ledger es append-only por trigger de base, y los
 * comprobantes son respaldo civil y tributario: la ley permite conservar datos
 * que una norma obliga a guardar (Código Tributario art. 200: 6 años). Esos
 * documentos congelaron nombre y RUT al emitirse, así que **el nombre sigue
 * apareciendo ahí hasta que venza ese plazo**. La respuesta al titular debe
 * decirlo.
 *
 * Cuándo se rechaza: mientras la persona tenga algo en curso. Eliminarla en
 * medio de un contrato vigente o con dinero sin liquidar dejaría a la corredora
 * sin saber a quién cobrar o pagar, y el tratamiento que hace falta para
 * ejecutar un contrato no requiere consentimiento ni cede ante la supresión.
 */
import type { TenantClient } from "./tenant-db";

export const NOMBRE_ANONIMIZADO = "Persona anonimizada";
export const prefijoRutAnonimizado = "anonimizado-";

export type ResultadoSupresion =
  | { ok: true; borrados: Record<string, number>; conservado: string[] }
  | { ok: false; motivo: string };

/** Lo que se conserva por obligación legal; se le informa a la persona. */
export const CONSERVADO_POR_LEY = [
  "Asientos contables y comprobantes de pago (Código Tributario art. 200, 6 años). Los comprobantes ya emitidos conservan el nombre y el RUT con que se emitieron.",
  "Contratos y sus documentos (Código Civil art. 2514, 10 años desde el término).",
] as const;

export const esAnonimizada = (rut: string) => rut.startsWith(prefijoRutAnonimizado);

export async function anonimizarPersona(
  tx: TenantClient,
  p: { tenantId: string; personaId: string; actorId: string; ip: string | null },
): Promise<ResultadoSupresion> {
  const persona = await tx.persona.findFirst({
    where: { id: p.personaId, tenantId: p.tenantId },
    select: { id: true, rut: true },
  });
  if (!persona) return { ok: false, motivo: "No encontramos a esa persona en tu corredora." };
  if (esAnonimizada(persona.rut)) return { ok: false, motivo: "Esta persona ya fue anonimizada." };

  const parte = { OR: [{ arrendatarioId: p.personaId }, { propietarioId: p.personaId }] };

  const contratosEnCurso = await tx.contrato.count({
    where: { tenantId: p.tenantId, estado: { in: ["borrador", "vigente"] }, ...parte },
  });
  if (contratosEnCurso > 0) {
    return {
      ok: false,
      motivo: "Tiene un contrato vigente o en borrador. Primero hay que terminarlo o cancelarlo: el tratamiento necesario para ejecutar un contrato no puede suprimirse.",
    };
  }

  const propiedadesActivas = await tx.propiedad.count({
    where: { tenantId: p.tenantId, propietarioId: p.personaId, estado: { in: ["disponible", "reservada", "arrendada"] } },
  });
  if (propiedadesActivas > 0) {
    return {
      ok: false,
      motivo: "Es propietaria de una propiedad publicada o arrendada. Cambia la titularidad o pásala a borrador antes de anonimizarla.",
    };
  }

  const periodosPendientes = await tx.periodoPago.count({
    where: { tenantId: p.tenantId, estado: { in: ["pendiente", "atrasado", "en_revision", "pagado"] }, contrato: parte },
  });
  if (periodosPendientes > 0) {
    return {
      ok: false,
      motivo: "Tiene períodos de pago sin liquidar. Hay que cerrarlos antes: la corredora los necesita para cobrar o pagar.",
    };
  }

  const reservasActivas = await tx.reserva.count({
    where: { tenantId: p.tenantId, personaId: p.personaId, estado: "activa" },
  });
  if (reservasActivas > 0) {
    return { ok: false, motivo: "Tiene una reserva activa. Hay que cerrarla o cancelarla antes de anonimizarla." };
  }

  const donde = { personaId: p.personaId };
  const borrados = {
    avisos:            (await tx.notificacion.deleteMany({ where: { tenantId: p.tenantId, ...donde } })).count,
    codigosAcceso:     (await tx.accesoOtp.deleteMany({ where: { tenantId: p.tenantId, ...donde } })).count,
    registrosAcceso:   (await tx.accesoLog.deleteMany({ where: { tenantId: p.tenantId, ...donde } })).count,
    preferencias:      (await tx.preferenciaNotificacion.deleteMany({ where: { tenantId: p.tenantId, ...donde } })).count,
    cuentasBancarias:  (await tx.cuentaBancaria.deleteMany({ where: { tenantId: p.tenantId, ...donde } })).count,
    codigosContacto:   (await tx.codigoRectificacionPersona.deleteMany({ where: { tenantId: p.tenantId, ...donde } })).count,
    solicitudesPortal: (await tx.solicitudDerechoPersona.deleteMany({ where: { tenantId: p.tenantId, ...donde } })).count,
    // Las reservas quedan (historial de la propiedad) pero sin las notas libres.
    notasDeReservas:   (await tx.reserva.updateMany({ where: { tenantId: p.tenantId, ...donde, notas: { not: null } }, data: { notas: null } })).count,
  };

  // El RUT es único por corredora: el marcador lleva el id para no chocar nunca.
  await tx.persona.update({
    where: { id: p.personaId },
    data: {
      nombre: NOMBRE_ANONIMIZADO,
      rut: `${prefijoRutAnonimizado}${p.personaId}`,
      email: null,
      telefono: null,
      canalAccesoPref: null,
    },
  });

  // Sin datos personales en el detalle: dejaría escrito justo lo que se borró.
  await tx.auditoriaEquipo.create({
    data: {
      tenantId: p.tenantId,
      actorId: p.actorId,
      accion: "anonimizar_persona",
      detalle: `persona ${p.personaId}`,
      ip: p.ip,
    },
  });

  return { ok: true, borrados, conservado: [...CONSERVADO_POR_LEY] };
}
