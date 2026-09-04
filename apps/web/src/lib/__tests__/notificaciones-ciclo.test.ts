/**
 * Colapso de notificaciones de ciclo de vida (observación de producto: no
 * enviar "firma tu contrato" cuando ya salió "tu contrato está vigente").
 */
import { describe, it, expect } from "vitest";
import {
  idsReemplazadas, esNotificacionDeCiclo, TIPOS_CICLO_CONTRATO, type NotifCiclo,
} from "../notificaciones-ciclo";

const t = (s: string) => new Date(s);
const n = (o: Partial<NotifCiclo> & { id: string }): NotifCiclo => ({
  tipo: "solicitud_firma", contratoId: "c1", createdAt: t("2026-01-01"),
  estado: "pendiente", ...o,
} as NotifCiclo);

describe("idsReemplazadas", () => {
  it("retira la firma pendiente cuando existe un 'nuevo contrato' posterior", () => {
    const r = idsReemplazadas([
      n({ id: "firma",  tipo: "solicitud_firma", createdAt: t("2026-01-01") }),
      n({ id: "nuevo",  tipo: "nuevo_contrato",  createdAt: t("2026-01-02") }),
    ]);
    expect(r).toEqual(["firma"]);
  });

  it("conserva la más reciente aunque también esté pendiente", () => {
    const r = idsReemplazadas([
      n({ id: "firma", tipo: "solicitud_firma", createdAt: t("2026-01-01") }),
      n({ id: "nuevo", tipo: "nuevo_contrato",  createdAt: t("2026-01-02") }),
    ]);
    expect(r).not.toContain("nuevo");
  });

  it("retira una pendiente aunque la más reciente YA se haya enviado", () => {
    // El "contrato vigente" ya salió por correo; la firma pendiente sobra.
    const r = idsReemplazadas([
      n({ id: "firma", tipo: "solicitud_firma", createdAt: t("2026-01-01"), estado: "pendiente" }),
      n({ id: "nuevo", tipo: "nuevo_contrato",  createdAt: t("2026-01-02"), estado: "enviada" }),
    ]);
    expect(r).toEqual(["firma"]);
  });

  it("no toca notificaciones de contratos distintos", () => {
    const r = idsReemplazadas([
      n({ id: "a-firma", contratoId: "A", tipo: "solicitud_firma", createdAt: t("2026-01-01") }),
      n({ id: "b-nuevo", contratoId: "B", tipo: "nuevo_contrato",  createdAt: t("2026-01-02") }),
    ]);
    expect(r).toEqual([]);
  });

  it("no colapsa avisos recurrentes: cada cobro y vencimiento importa", () => {
    const r = idsReemplazadas([
      n({ id: "cobro1", tipo: "cobro" as never,                    createdAt: t("2026-01-01") }),
      n({ id: "venc1",  tipo: "recordatorio_vencimiento" as never, createdAt: t("2026-01-02") }),
    ]);
    expect(r).toEqual([]);
  });

  it("ignora notificaciones sin contrato asociado", () => {
    const r = idsReemplazadas([
      n({ id: "x", contratoId: null, tipo: "solicitud_firma", createdAt: t("2026-01-01") }),
      n({ id: "y", contratoId: null, tipo: "nuevo_contrato",  createdAt: t("2026-01-02") }),
    ]);
    expect(r).toEqual([]);
  });

  it("con empate exacto de fecha no retira ninguna (no hay 'última' clara)", () => {
    const r = idsReemplazadas([
      n({ id: "a", tipo: "solicitud_firma", createdAt: t("2026-01-01T10:00:00Z") }),
      n({ id: "b", tipo: "nuevo_contrato",  createdAt: t("2026-01-01T10:00:00Z") }),
    ]);
    expect(r).toEqual([]);
  });

  it("colapsa una cadena de tres a solo la última", () => {
    const r = idsReemplazadas([
      n({ id: "firma", tipo: "solicitud_firma",     createdAt: t("2026-01-01") }),
      n({ id: "nuevo", tipo: "nuevo_contrato",      createdAt: t("2026-01-02") }),
      n({ id: "fin",   tipo: "termino_contrato",    createdAt: t("2026-01-03") }),
    ]);
    expect(r.sort()).toEqual(["firma", "nuevo"]);
  });
});

describe("esNotificacionDeCiclo", () => {
  it("reconoce los tipos de ciclo y descarta los recurrentes", () => {
    expect(esNotificacionDeCiclo("solicitud_firma")).toBe(true);
    expect(esNotificacionDeCiclo("nuevo_contrato")).toBe(true);
    expect(esNotificacionDeCiclo("termino_contrato")).toBe(true);
    expect(esNotificacionDeCiclo("cobro")).toBe(false);
    expect(esNotificacionDeCiclo("voucher_pago")).toBe(false);
    expect(esNotificacionDeCiclo("recordatorio_vencimiento")).toBe(false);
  });

  it("el set de ciclo no incluye avisos recurrentes ni comentarios", () => {
    expect(TIPOS_CICLO_CONTRATO.has("cobro" as never)).toBe(false);
    expect(TIPOS_CICLO_CONTRATO.has("comentario_corredor" as never)).toBe(false);
    expect(TIPOS_CICLO_CONTRATO.has("alerta_personalizada" as never)).toBe(false);
  });
});
