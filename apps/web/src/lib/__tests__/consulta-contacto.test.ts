/**
 * Tests: lib/consulta-contacto — una consulta del marketplace cuyo correo al
 * corredor falla queda pendiente y se reintenta, sin envíos duplicados (M-21).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { db, enviar } = vi.hoisted(() => ({
  db: {
    consultaContacto: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
  enviar: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/email", () => ({ sendContactoCorredorEmail: enviar }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const {
  entregarConsulta, reintentarConsultasPendientes,
  MAX_INTENTOS_ENVIO, VENTANA_REINTENTO_MS, ESPERA_ANTES_DE_REINTENTAR_MS,
} = await import("@/lib/consulta-contacto");
const { CORREO } = await import("@/lib/marca");

function consulta(extra: Record<string, unknown> = {}) {
  return {
    id: "c-1", nombre: "Ana", apellido: "Pérez", telefono: "+56911111111", email: "ana@x.cl",
    titulo: "Visita", descripcion: "¿Sigue disponible?", viaEmail: true, viaTelefono: false,
    correoEnviadoEn: null, intentosEnvio: 0,
    publicacion: { titulo: "Depto en Ñuñoa" },
    tenant: { id: "t-1", nombre: "Corredora Demo", emailContacto: "contacto@demo.cl" },
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.consultaContacto.updateMany.mockResolvedValue({ count: 1 });
  db.consultaContacto.update.mockResolvedValue({});
  enviar.mockResolvedValue(undefined);
});

describe("entregarConsulta", () => {
  it("envía al correo de contacto de la corredora y marca la consulta como enviada", async () => {
    db.consultaContacto.findUnique.mockResolvedValue(consulta());
    expect(await entregarConsulta("c-1")).toBe("enviada");
    expect(enviar).toHaveBeenCalledWith(expect.objectContaining({ emailCorredor: "contacto@demo.cl", tituloPub: "Depto en Ñuñoa" }));
    expect(db.consultaContacto.update).toHaveBeenCalledWith({ where: { id: "c-1" }, data: { correoEnviadoEn: expect.any(Date) } });
  });

  it("reserva el intento con un UPDATE condicional antes de enviar", async () => {
    db.consultaContacto.findUnique.mockResolvedValue(consulta({ intentosEnvio: 2 }));
    await entregarConsulta("c-1");
    expect(db.consultaContacto.updateMany).toHaveBeenCalledWith({
      where: { id: "c-1", correoEnviadoEn: null, intentosEnvio: 2 },
      data:  { intentosEnvio: { increment: 1 } },
    });
    expect(db.consultaContacto.updateMany.mock.invocationCallOrder[0]).toBeLessThan(enviar.mock.invocationCallOrder[0]);
  });

  it("si otro proceso ganó la reserva, no envía (sin duplicados)", async () => {
    db.consultaContacto.findUnique.mockResolvedValue(consulta());
    db.consultaContacto.updateMany.mockResolvedValue({ count: 0 });
    expect(await entregarConsulta("c-1")).toBe("sin-reserva");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("si el correo falla, queda pendiente (sin correoEnviadoEn) y no lanza", async () => {
    db.consultaContacto.findUnique.mockResolvedValue(consulta());
    enviar.mockRejectedValue(new Error("EMAIL_PROVIDER_NOT_CONFIGURED"));
    expect(await entregarConsulta("c-1")).toBe("fallida");
    expect(db.consultaContacto.update).not.toHaveBeenCalled();
  });

  it("una consulta ya enviada no se reenvía", async () => {
    db.consultaContacto.findUnique.mockResolvedValue(consulta({ correoEnviadoEn: new Date() }));
    expect(await entregarConsulta("c-1")).toBe("ya-enviada");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("agotados los intentos no se vuelve a intentar", async () => {
    db.consultaContacto.findUnique.mockResolvedValue(consulta({ intentosEnvio: MAX_INTENTOS_ENVIO }));
    expect(await entregarConsulta("c-1")).toBe("sin-reserva");
    expect(enviar).not.toHaveBeenCalled();
  });

  it("sin correo de contacto usa el del administrador; sin ninguno, soporte", async () => {
    db.consultaContacto.findUnique.mockResolvedValue(consulta({ tenant: { id: "t-1", nombre: "C", emailContacto: null } }));
    db.$queryRaw.mockResolvedValueOnce([{ marketplace_lookup_corredor_email_fallback: "admin@demo.cl" }]);
    await entregarConsulta("c-1");
    expect(enviar).toHaveBeenLastCalledWith(expect.objectContaining({ emailCorredor: "admin@demo.cl" }));

    db.$queryRaw.mockResolvedValueOnce([{ marketplace_lookup_corredor_email_fallback: null }]);
    await entregarConsulta("c-1");
    expect(enviar).toHaveBeenLastCalledWith(expect.objectContaining({ emailCorredor: CORREO.soporte }));
  });

  it("un error de base no se propaga (la ruta lo llama sin await)", async () => {
    db.consultaContacto.findUnique.mockRejectedValue(new Error("db caída"));
    await expect(entregarConsulta("c-1")).resolves.toBe("fallida");
  });
});

describe("reintentarConsultasPendientes", () => {
  it("busca solo pendientes con intentos disponibles, dentro de la ventana y no recién creadas", async () => {
    const ahora = new Date("2026-11-05T12:00:00Z");
    db.consultaContacto.findMany.mockResolvedValue([]);
    await reintentarConsultasPendientes(ahora);
    const { where } = db.consultaContacto.findMany.mock.calls[0][0];
    expect(where.correoEnviadoEn).toBeNull();
    expect(where.intentosEnvio).toEqual({ lt: MAX_INTENTOS_ENVIO });
    expect(where.createdAt.gte).toEqual(new Date(ahora.getTime() - VENTANA_REINTENTO_MS));
    expect(where.createdAt.lte).toEqual(new Date(ahora.getTime() - ESPERA_ANTES_DE_REINTENTAR_MS));
  });

  it("cuenta enviadas y fallidas", async () => {
    db.consultaContacto.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    db.consultaContacto.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => consulta({ id: where.id }));
    enviar.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(undefined);
    expect(await reintentarConsultasPendientes()).toEqual({ pendientes: 3, enviadas: 2, fallidas: 1 });
  });
});
