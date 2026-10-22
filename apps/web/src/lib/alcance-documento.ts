/**
 * ADR-0013 (Fase D) — alcance del Colaborador sobre un Documento.
 *
 * Un documento cuelga de una sola entidad (propiedad, contrato, período,
 * voucher, reserva o comentario), y todas llevan a una propiedad. Un
 * Colaborador solo ve documentos de propiedades asignadas a él. Si no se puede
 * resolver la propiedad, se niega: el error seguro es no mostrar una cédula.
 */
import type { Actor } from "@/lib/queries";

type ConPropiedad = { propiedad: { asignadoAId: string | null } } | null;

/** `select` de Prisma con todos los caminos de un Documento a su propiedad. */
export const SELECT_ALCANCE_DOCUMENTO = {
  propiedad:  { select: { asignadoAId: true } },
  reserva:    { select: { propiedad: { select: { asignadoAId: true } } } },
  contrato:   { select: { propiedad: { select: { asignadoAId: true } } } },
  periodo:    { select: { contrato: { select: { propiedad: { select: { asignadoAId: true } } } } } },
  voucher:    { select: { contrato: { select: { propiedad: { select: { asignadoAId: true } } } } } },
  comentario: { select: { contrato: { select: { propiedad: { select: { asignadoAId: true } } } } } },
} as const;

export type AlcanceDocumento = {
  propiedad:  { asignadoAId: string | null } | null;
  reserva:    ConPropiedad;
  contrato:   ConPropiedad;
  periodo:    { contrato: ConPropiedad } | null;
  voucher:    { contrato: ConPropiedad } | null;
  comentario: { contrato: ConPropiedad } | null;
};

export function actorPuedeVerDocumento(
  actor: Pick<Actor, "rol" | "usuarioId">,
  doc: AlcanceDocumento,
): boolean {
  if (actor.rol === "manager") return true;
  const asignado =
    doc.propiedad?.asignadoAId ??
    doc.reserva?.propiedad.asignadoAId ??
    doc.contrato?.propiedad.asignadoAId ??
    doc.periodo?.contrato?.propiedad.asignadoAId ??
    doc.voucher?.contrato?.propiedad.asignadoAId ??
    doc.comentario?.contrato?.propiedad.asignadoAId ??
    null;
  return asignado !== null && asignado === actor.usuarioId;
}
