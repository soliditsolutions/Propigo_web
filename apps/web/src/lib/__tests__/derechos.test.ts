import { describe, expect, it, vi } from "vitest";
import { avisarSolicitudesPorVencer, type DbDerechos } from "../derechos-avisos";
import {
  calcularVencimiento, CLAVES_DERECHO, DERECHOS, diasParaVencer, etiquetaDerecho, generarFolio,
  PLAZO_RESPUESTA_DIAS, requiereAviso,
} from "../derechos";

const DIA = 86_400_000;
const AHORA = new Date("2026-12-10T12:00:00Z");

describe("derechos — reglas puras", () => {
  it("el plazo es de 30 días corridos", () => {
    expect(PLAZO_RESPUESTA_DIAS).toBe(30);
    expect(calcularVencimiento(AHORA).getTime() - AHORA.getTime()).toBe(30 * DIA);
  });

  it("ofrece los seis derechos de la ley, con etiqueta", () => {
    expect([...CLAVES_DERECHO].sort()).toEqual(["acceso", "bloqueo", "oposicion", "portabilidad", "rectificacion", "supresion"]);
    expect(DERECHOS.every((d) => d.etiqueta && d.ayuda)).toBe(true);
    expect(etiquetaDerecho("supresion")).toBe("Supresión");
    expect(etiquetaDerecho("otro")).toBe("otro");
  });

  it("el folio tiene el formato DER-AAAA-XXXXXX sin caracteres ambiguos y no se repite", () => {
    const folios = new Set(Array.from({ length: 500 }, () => generarFolio(AHORA)));
    expect(folios.size).toBe(500);
    for (const f of folios) expect(f).toMatch(/^DER-2026-[A-HJKMNP-Z2-9]{6}$/);
  });

  it("requiereAviso: solo abiertas, a 5 días o menos del vencimiento, una vez cada 24 h", () => {
    const base = { estado: "recibida", venceAt: new Date(AHORA.getTime() + 4 * DIA), avisadaAt: null };
    expect(requiereAviso(base, AHORA)).toBe(true);
    expect(requiereAviso({ ...base, venceAt: new Date(AHORA.getTime() + 6 * DIA) }, AHORA)).toBe(false);
    expect(requiereAviso({ ...base, estado: "respondida" }, AHORA)).toBe(false);
    expect(requiereAviso({ ...base, estado: "rechazada" }, AHORA)).toBe(false);
    expect(requiereAviso({ ...base, avisadaAt: new Date(AHORA.getTime() - 2 * 3600_000) }, AHORA)).toBe(false);
    expect(requiereAviso({ ...base, avisadaAt: new Date(AHORA.getTime() - 25 * 3600_000) }, AHORA)).toBe(true);
  });

  it("una solicitud ya vencida sigue avisando", () => {
    expect(requiereAviso({ estado: "en_proceso", venceAt: new Date(AHORA.getTime() - 3 * DIA), avisadaAt: null }, AHORA)).toBe(true);
    expect(diasParaVencer(new Date(AHORA.getTime() - 3 * DIA), AHORA)).toBe(-3);
  });
});

describe("avisarSolicitudesPorVencer", () => {
  const fila = (id: string, dias: number, extra: object = {}) => ({
    id, folio: `DER-2026-${id}`, derecho: "acceso", estado: "recibida",
    venceAt: new Date(AHORA.getTime() + dias * DIA), avisadaAt: null as Date | null, ...extra,
  });

  function crearDb(filas: ReturnType<typeof fila>[]) {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const db: DbDerechos = { solicitudDerecho: { findMany: vi.fn().mockResolvedValue(filas), updateMany } };
    return { db, updateMany };
  }

  it("manda un solo correo con todo lo pendiente y marca las avisadas", async () => {
    const { db, updateMany } = crearDb([
      fila("AAA", -2),
      fila("BBB", 3),
      fila("CCC", 3, { avisadaAt: new Date(AHORA.getTime() - 3600_000) }),
    ]);
    const enviar = vi.fn().mockResolvedValue(undefined);

    const r = await avisarSolicitudesPorVencer(db, enviar, AHORA);

    expect(r.avisadas).toBe(2);
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar.mock.calls[0][0].map((i: { folio: string }) => i.folio)).toEqual(["DER-2026-AAA", "DER-2026-BBB"]);
    expect(enviar.mock.calls[0][0][0].dias).toBe(-2);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ["AAA", "BBB"] } }, data: { avisadaAt: AHORA } });
  });

  it("sin pendientes no manda nada", async () => {
    const { db, updateMany } = crearDb([]);
    const enviar = vi.fn();
    expect((await avisarSolicitudesPorVencer(db, enviar, AHORA)).avisadas).toBe(0);
    expect(enviar).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("si el correo falla NO marca como avisadas: mañana se reintenta", async () => {
    const { db, updateMany } = crearDb([fila("AAA", 1)]);
    await expect(avisarSolicitudesPorVencer(db, vi.fn().mockRejectedValue(new Error("sin red")), AHORA)).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
