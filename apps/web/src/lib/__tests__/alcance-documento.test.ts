/**
 * ADR-0013 — un Colaborador solo descarga documentos de propiedades asignadas
 * a él, sin importar de qué entidad cuelgue el documento.
 */
import { describe, it, expect } from "vitest";
import { actorPuedeVerDocumento, type AlcanceDocumento } from "../alcance-documento";

const MANAGER = { rol: "manager" as const, usuarioId: "u-manager" };
const COLAB   = { rol: "colaborador" as const, usuarioId: "u-colab" };

const vacio: AlcanceDocumento = {
  propiedad: null, reserva: null, contrato: null, periodo: null, voucher: null, comentario: null,
};
const prop = (asignadoAId: string | null) => ({ propiedad: { asignadoAId } });

const casos: [string, (a: string | null) => AlcanceDocumento][] = [
  ["propiedad",  (a) => ({ ...vacio, propiedad: { asignadoAId: a } })],
  ["reserva",    (a) => ({ ...vacio, reserva: prop(a) })],
  ["contrato",   (a) => ({ ...vacio, contrato: prop(a) })],
  ["período",    (a) => ({ ...vacio, periodo: { contrato: prop(a) } })],
  ["voucher",    (a) => ({ ...vacio, voucher: { contrato: prop(a) } })],
  ["comentario", (a) => ({ ...vacio, comentario: { contrato: prop(a) } })],
];

describe("actorPuedeVerDocumento", () => {
  it.each(casos)("documento de %s: el colaborador asignado lo ve", (_n, doc) => {
    expect(actorPuedeVerDocumento(COLAB, doc("u-colab"))).toBe(true);
  });

  it.each(casos)("documento de %s: otro colaborador NO lo ve", (_n, doc) => {
    expect(actorPuedeVerDocumento(COLAB, doc("u-otro"))).toBe(false);
  });

  it.each(casos)("documento de %s: propiedad sin asignar → el colaborador NO lo ve", (_n, doc) => {
    expect(actorPuedeVerDocumento(COLAB, doc(null))).toBe(false);
  });

  it("documento sin ninguna relación resoluble: se niega al colaborador", () => {
    expect(actorPuedeVerDocumento(COLAB, vacio)).toBe(false);
  });

  it("el manager ve todo el tenant, incluso sin relación", () => {
    expect(actorPuedeVerDocumento(MANAGER, vacio)).toBe(true);
    expect(actorPuedeVerDocumento(MANAGER, casos[2][1]("u-otro"))).toBe(true);
  });
});
