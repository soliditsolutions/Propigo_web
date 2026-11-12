import { beforeEach, describe, expect, it, vi } from "vitest";

const crear = vi.hoisted(() => vi.fn());
const acuse = vi.hoisted(() => vi.fn());
const admin = vi.hoisted(() => vi.fn());
const limite = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.5" }) }));
vi.mock("@/lib/db", () => ({ prisma: { solicitudDerecho: { create: crear } } }));
vi.mock("@/lib/email", () => ({ sendAcuseDerechoEmail: acuse, sendSolicitudDerechoAdminEmail: admin }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: limite }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const { solicitarDerechoAction } = await import("../actions");

const valida = {
  derecho: "acceso", nombre: "Ana Pérez Soto", rut: "12.345.678-5", email: "Ana@Example.cl",
  detalle: "Quiero saber qué datos tienen", acepta: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  limite.mockReturnValue({ allowed: true });
  crear.mockResolvedValue({});
  acuse.mockResolvedValue(undefined);
  admin.mockResolvedValue(undefined);
});

describe("solicitarDerechoAction", () => {
  it("registra la solicitud con RUT canónico, correo en minúsculas y plazo de 30 días", async () => {
    const r = await solicitarDerechoAction(valida);

    expect(r.ok).toBe(true);
    const data = crear.mock.calls[0][0].data;
    expect(data).toMatchObject({ derecho: "acceso", rut: "12345678-5", email: "ana@example.cl", ip: "203.0.113.5" });
    expect(data.folio).toMatch(/^DER-\d{4}-[A-Z2-9]{6}$/);
    expect(data.venceAt.getTime() - data.recibidaAt.getTime()).toBe(30 * 86_400_000);
    if (r.ok) expect(r.folio).toBe(data.folio);
  });

  it("acusa recibo al titular y avisa al buzón de privacidad", async () => {
    await solicitarDerechoAction(valida);
    expect(acuse).toHaveBeenCalledWith("ana@example.cl", expect.objectContaining({ derecho: "Acceso" }));
    expect(admin).toHaveBeenCalledWith(expect.objectContaining({ rut: "12345678-5", email: "ana@example.cl" }));
  });

  it("si los correos fallan, la solicitud igual queda registrada y se confirma", async () => {
    acuse.mockRejectedValue(new Error("sin red"));
    admin.mockRejectedValue(new Error("sin red"));
    expect((await solicitarDerechoAction(valida)).ok).toBe(true);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["RUT inválido", { rut: "12.345.678-9" }, /RUT/],
    ["correo inválido", { email: "no-es-correo" }, /correo/i],
    ["nombre vacío", { nombre: " " }, /nombre/i],
    ["derecho inexistente", { derecho: "hackear" }, /derecho/i],
    ["sin aceptar el uso de datos", { acepta: false }, /aceptar/i],
    ["detalle demasiado largo", { detalle: "x".repeat(2001) }, /2000/],
  ])("rechaza %s sin tocar la base", async (_nombre, cambio, msg) => {
    const r = await solicitarDerechoAction({ ...valida, ...cambio });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(msg);
    expect(crear).not.toHaveBeenCalled();
  });

  it("rechaza una entrada que no es un objeto", async () => {
    expect((await solicitarDerechoAction(null)).ok).toBe(false);
  });

  it("al superar el límite dice cuánto esperar y no registra nada", async () => {
    limite.mockReturnValueOnce({ allowed: false, retryAfter: 600 });
    const r = await solicitarDerechoAction(valida);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/10 minutos/) });
    expect(crear).not.toHaveBeenCalled();
  });

  it("limita por IP y por RUT", async () => {
    await solicitarDerechoAction(valida);
    const claves = limite.mock.calls.map((c) => c[0]);
    expect(claves).toContain("derechos_ip:203.0.113.5");
    expect(claves).toContain("derechos_rut:12345678-5");
  });

  it("un error de base no se expone al titular", async () => {
    crear.mockRejectedValue(new Error('relation "solicitud_derecho" does not exist'));
    const r = await solicitarDerechoAction(valida);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/relation|solicitud_derecho/);
  });
});
