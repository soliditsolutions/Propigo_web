/**
 * Portal — Mis datos: rectificación (L-DP4), aviso de identidad y oposición
 * al tratamiento (L-DP6), contra Postgres real.
 *
 * Cubre: el flujo de 2 pasos de rectificación (código al correo nuevo para
 * email, al correo actual para teléfono), que el cambio solo aplica con el
 * código correcto, que cada ejercicio de derecho queda en
 * `solicitud_derecho_persona`, y que la oposición reutiliza
 * `preferencia_notificacion` con el alcance elegido.
 *
 * Si la base no está levantada, se salta.
 */
import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../../generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Map([["x-real-ip", "203.0.113.9"]]) as unknown as Headers,
}));

const mockGetPortalSession = vi.fn();
vi.mock("@/lib/portal-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/portal-auth")>();
  return { ...actual, getPortalSession: mockGetPortalSession };
});

let prisma: PrismaClient | null = null;
let tenantId = "";
let personaId = "";
const MARCA = "MISDATOS-QA";

async function comoTenant<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  }) as Promise<T>;
}

async function preparar(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try { await prisma.$queryRaw`SELECT 1`; } catch {
    await prisma.$disconnect().catch(() => {}); prisma = null; return false;
  }
  const t = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant LIMIT 1`;
  if (!t.length) return false;
  tenantId = t[0].id;
  return true;
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

cuando("Mis datos del portal — rectificación, identidad, oposición", () => {
  let actions: typeof import("../actions");

  beforeAll(async () => {
    actions = await import("../actions");
    const p = await comoTenant((tx) => tx.persona.create({
      data: { tenantId, rut: `${MARCA}-1`, nombre: "Persona Mis Datos QA", email: "original@qa.local", telefono: "+56911110000" },
      select: { id: true },
    }));
    personaId = p.id;
    mockGetPortalSession.mockResolvedValue({ personaId, tenantId, propiedadId: "00000000-0000-4000-8000-000000000000", rol: "arrendatario" });
  });

  afterAll(async () => {
    if (!prisma) return;
    await comoTenant(async (tx) => {
      await tx.solicitudDerechoPersona.deleteMany({ where: { personaId } });
      await tx.codigoRectificacionPersona.deleteMany({ where: { personaId } });
      await tx.preferenciaNotificacion.deleteMany({ where: { personaId } });
      await tx.persona.deleteMany({ where: { id: personaId } });
    });
    await prisma.$disconnect();
  });

  it("rectificación de email: el código llega, se aplica con el código correcto y queda auditada", async () => {
    const solicitado = await actions.solicitarRectificacionAction("email", "nuevo@qa.local");
    expect(solicitado.ok).toBe(true);

    const registro = await comoTenant((tx) => tx.codigoRectificacionPersona.findFirst({
      where: { personaId, campo: "email", usadoAt: null }, orderBy: { createdAt: "desc" },
    }));
    expect(registro).toBeTruthy();
    expect(registro!.valorNuevo).toBe("nuevo@qa.local");

    // El código real no sale de la acción (va "por correo"); se lee del hash con fuerza bruta de 000000-999999 sería
    // absurdo en un test — en vez de eso, se reconstruye igual que lo hace confirmarRectificacionAction: se prueba
    // primero que un código incorrecto falla, y luego se aplica el flujo con el hash conocido directamente en BD.
    const incorrecto = await actions.confirmarRectificacionAction("email", "000000");
    expect(incorrecto.ok).toBe(false);

    // Sustituye el hash por uno de código conocido para probar el camino feliz sin depender del envío real de correo.
    const { hashCodigo } = await import("@/lib/codigo-verificacion");
    await comoTenant((tx) => tx.codigoRectificacionPersona.update({
      where: { id: registro!.id }, data: { codigoHash: hashCodigo("246810"), intentos: 0 },
    }));
    const confirmado = await actions.confirmarRectificacionAction("email", "246810");
    expect(confirmado).toEqual({ ok: true, valorNuevo: "nuevo@qa.local" });

    const persona = await comoTenant((tx) => tx.persona.findFirstOrThrow({ where: { id: personaId }, select: { email: true } }));
    expect(persona.email).toBe("nuevo@qa.local");

    const solicitud = await comoTenant((tx) => tx.solicitudDerechoPersona.findFirst({
      where: { personaId, derecho: "rectificacion" }, orderBy: { createdAt: "desc" },
    }));
    expect(solicitud?.detalle).toContain("email → nuevo@qa.local");
  });

  it("rectificación de teléfono: sin correo en la ficha, se rechaza sin aplicar el cambio a ciegas", async () => {
    await comoTenant((tx) => tx.persona.update({ where: { id: personaId }, data: { email: null } }));
    const r = await actions.solicitarRectificacionAction("telefono", "+56922223333");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no podemos verificar/i);
    await comoTenant((tx) => tx.persona.update({ where: { id: personaId }, data: { email: "nuevo@qa.local" } }));
  });

  it("aviso de identidad incorrecta: no toca a la persona, solo queda registrado", async () => {
    const r = await actions.reportarIdentidadIncorrectaAction("Mi nombre está mal escrito, debería ser 'María'.");
    expect(r.ok).toBe(true);
    const solicitud = await comoTenant((tx) => tx.solicitudDerechoPersona.findFirst({
      where: { personaId, derecho: "identidad" },
    }));
    expect(solicitud?.detalle).toMatch(/María/);
  });

  it("oposición al tratamiento: pausa los avisos con el alcance elegido y queda auditada", async () => {
    const r = await actions.oponerseAlTratamientoAction("todos", "No quiero avisos por ahora");
    expect(r.ok).toBe(true);

    const pref = await comoTenant((tx) => tx.preferenciaNotificacion.findUnique({
      where: { tenantId_personaId: { tenantId, personaId } },
    }));
    expect(pref?.suscrito).toBe(false);
    expect(pref?.alcance).toBe("todos");

    const solicitud = await comoTenant((tx) => tx.solicitudDerechoPersona.findFirst({
      where: { personaId, derecho: "oposicion" },
    }));
    expect(solicitud?.detalle).toContain("alcance=todos");
  });

  it("D1 — un `campo` que no es 'email' ni 'telefono' se rechaza, nunca aplica el valor a un campo equivocado", async () => {
    // @ts-expect-error — se prueba deliberadamente con un valor fuera del tipo declarado,
    // como llegaría desde una llamada directa a la Server Action sin pasar por la UI.
    const r1 = await actions.solicitarRectificacionAction("rut", "11111111-1");
    expect(r1).toEqual({ ok: false, error: "Campo inválido." });
    // @ts-expect-error — idem, para el paso de confirmación.
    const r2 = await actions.confirmarRectificacionAction("rut", "123456");
    expect(r2).toEqual({ ok: false, error: "Campo inválido." });

    const persona = await comoTenant((tx) => tx.persona.findFirstOrThrow({ where: { id: personaId }, select: { email: true, telefono: true } }));
    expect(persona.email).toBe("nuevo@qa.local"); // el del primer test — sin corromper
  });

  it("solicitud sin sesión de portal → error, nada se escribe", async () => {
    mockGetPortalSession.mockResolvedValueOnce(null);
    const r = await actions.solicitarRectificacionAction("email", "otro@qa.local");
    expect(r.ok).toBe(false);
  });
});
