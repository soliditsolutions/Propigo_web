/**
 * cambiarPropietarioPropiedad — aviso de cambio de titularidad (L-CM6),
 * contra Postgres real.
 *
 * Cubre: el propietario de la Propiedad cambia; cada arrendatario con
 * contrato VIGENTE sobre esa propiedad recibe una notificación (las demás
 * no); una Persona con ese RUT ya existente en el tenant se reutiliza en vez
 * de duplicarse; un Colaborador no puede ejecutar la acción; un RUT igual al
 * propietario actual, o inválido, se rechaza sin tocar la base.
 *
 * Si la base no está levantada, se salta.
 */
import "dotenv/config";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { adaptadorPg } from "@/lib/pg-adaptador";
import { PrismaClient } from "../../../../generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries")>();
  return { ...actual, getActor: mockGetActor };
});

let prisma: PrismaClient | null = null;
let tenantId = "";
let idArr = "";
let idPropOriginal = "";
const MARCA = "TITULAR-QA-2091";
const propiedadIds: string[] = [];
const contratoIds: string[] = [];
const personaIds: string[] = [];

async function preparar(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  prisma = new PrismaClient({ adapter: adaptadorPg(url) });
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

async function comoTenant<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  }) as Promise<T>;
}

function actorManager(actorTenant: unknown) {
  return { usuarioId: "qa-user-manager", tenantId, rol: "manager" as const, tenant: actorTenant };
}
function actorColaborador(actorTenant: unknown) {
  return { usuarioId: "qa-user-colab", tenantId, rol: "colaborador" as const, tenant: actorTenant };
}

async function sembrarPropiedad(opts: { conContratoVigente: boolean }): Promise<{ propiedadId: string; contratoId: string | null }> {
  return comoTenant(async (tx) => {
    const p = await tx.propiedad.create({
      data: {
        tenantId, propietarioId: idPropOriginal, tipo: "casa",
        rol: `${MARCA}-${propiedadIds.length}`, direccion: "Titularidad QA 1", comuna: "Ñuñoa",
        estado: opts.conContratoVigente ? "arrendada" : "borrador",
      },
      select: { id: true },
    });
    propiedadIds.push(p.id);
    let contratoId: string | null = null;
    if (opts.conContratoVigente) {
      const c = await tx.contrato.create({
        data: {
          tenantId, propiedadId: p.id, arrendatarioId: idArr, propietarioId: idPropOriginal,
          estado: "vigente", denominacion: "CLP", valorArriendo: 400000, diaVencimiento: 5,
          fechaInicio: new Date("2026-01-05"),
        },
        select: { id: true },
      });
      contratoId = c.id;
      contratoIds.push(c.id);
    }
    return { propiedadId: p.id, contratoId };
  });
}

cuando("cambiarPropietarioPropiedad — aviso de cambio de titularidad (L-CM6)", () => {
  let actions: typeof import("../actions");
  let tenantRow: unknown;

  beforeAll(async () => {
    actions = await import("../actions");
    await comoTenant(async (tx) => {
      const arr = await tx.persona.create({ data: { tenantId, rut: `${MARCA}-ARR`, nombre: "Arr Titular QA" }, select: { id: true } });
      // RUT con formato válido (no solo marca): esta persona es "el propietario
      // actual" y el test de "mismo RUT" reenvía su propio RUT como si fuera
      // el nuevo — tiene que pasar `validarRut()` para llegar a esa validación.
      const prop = await tx.persona.create({ data: { tenantId, rut: "77777777-7", nombre: "Propietario Original QA" }, select: { id: true } });
      idArr = arr.id; idPropOriginal = prop.id;
      personaIds.push(arr.id, prop.id);
    });
    tenantRow = await comoTenant((tx) => tx.tenant.findFirstOrThrow({ where: { id: tenantId } }));
  });

  afterAll(async () => {
    if (!prisma) return;
    await comoTenant(async (tx) => {
      await tx.notificacion.deleteMany({ where: { contratoId: { in: contratoIds } } });
      await tx.contrato.deleteMany({ where: { id: { in: contratoIds } } });
      await tx.propiedad.deleteMany({ where: { id: { in: propiedadIds } } });
      await tx.persona.deleteMany({ where: { OR: [{ id: { in: personaIds } }, { rut: { startsWith: MARCA } }] } });
    });
    await prisma.$disconnect();
  });

  it("propiedad con contrato vigente: cambia el propietario y notifica al arrendatario", async () => {
    mockGetActor.mockResolvedValue(actorManager(tenantRow));
    const { propiedadId, contratoId } = await sembrarPropiedad({ conContratoVigente: true });

    const res = await actions.cambiarPropietarioPropiedad(propiedadId, {
      nombre: "Nuevo Dueño QA", rut: "22222222-2", email: "nuevo@qa.local",
    });
    expect(res).toEqual({ ok: true, notificados: 1 });

    const prop = await comoTenant((tx) => tx.propiedad.findFirstOrThrow({
      where: { id: propiedadId }, include: { propietario: { select: { nombre: true, rut: true } } },
    }));
    expect(prop.propietario.nombre).toBe("Nuevo Dueño QA");
    expect(prop.propietario.rut).toBe("22222222-2");
    personaIds.push(prop.propietarioId);

    const notif = await comoTenant((tx) => tx.notificacion.findFirst({
      where: { contratoId: contratoId!, tipo: "cambio_titularidad", personaId: idArr },
    }));
    expect(notif).toBeTruthy();
    expect(notif?.cuerpo).toContain("Nuevo Dueño QA");
    expect(notif?.cuerpo).toContain("22.222.222-2");
    expect((notif?.payload as Record<string, string>).propietarioAnteriorNombre).toBe("Propietario Original QA");
  });

  it("propiedad sin contrato vigente: cambia el propietario, no notifica a nadie", async () => {
    mockGetActor.mockResolvedValue(actorManager(tenantRow));
    const { propiedadId } = await sembrarPropiedad({ conContratoVigente: false });

    const res = await actions.cambiarPropietarioPropiedad(propiedadId, {
      nombre: "Otro Dueño QA", rut: "33333333-3",
    });
    expect(res).toEqual({ ok: true, notificados: 0 });

    const prop = await comoTenant((tx) => tx.propiedad.findFirstOrThrow({ where: { id: propiedadId } }));
    personaIds.push(prop.propietarioId);
  });

  it("reutiliza una Persona existente del tenant con ese RUT, no la duplica", async () => {
    mockGetActor.mockResolvedValue(actorManager(tenantRow));
    // RUT con formato válido: se envía tal cual como el RUT del "nuevo
    // propietario", y tiene que pasar `validarRut()` para llegar a la
    // búsqueda por RUT existente.
    const existente = await comoTenant((tx) => tx.persona.create({
      data: { tenantId, rut: "66666666-6", nombre: "Persona Reusada QA" }, select: { id: true, rut: true },
    }));
    personaIds.push(existente.id);
    const { propiedadId } = await sembrarPropiedad({ conContratoVigente: false });

    const res = await actions.cambiarPropietarioPropiedad(propiedadId, {
      nombre: "Nombre distinto en el form", rut: existente.rut,
    });
    expect(res.ok).toBe(true);

    const prop = await comoTenant((tx) => tx.propiedad.findFirstOrThrow({ where: { id: propiedadId } }));
    expect(prop.propietarioId).toBe(existente.id);
    // No se sobrescribió el nombre de la persona ya existente.
    const persona = await comoTenant((tx) => tx.persona.findFirstOrThrow({ where: { id: existente.id } }));
    expect(persona.nombre).toBe("Persona Reusada QA");
  });

  it("un Colaborador no puede cambiar el propietario", async () => {
    mockGetActor.mockResolvedValue(actorColaborador(tenantRow));
    const { propiedadId } = await sembrarPropiedad({ conContratoVigente: false });

    const res = await actions.cambiarPropietarioPropiedad(propiedadId, { nombre: "X", rut: "44444444-4" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/solo el administrador/i);

    const prop = await comoTenant((tx) => tx.propiedad.findFirstOrThrow({ where: { id: propiedadId } }));
    expect(prop.propietarioId).toBe(idPropOriginal); // sin cambios
  });

  it("rechaza si el RUT es el mismo del propietario actual", async () => {
    mockGetActor.mockResolvedValue(actorManager(tenantRow));
    const { propiedadId } = await sembrarPropiedad({ conContratoVigente: false });
    const actual = await comoTenant((tx) => tx.persona.findFirstOrThrow({ where: { id: idPropOriginal }, select: { rut: true } }));

    const res = await actions.cambiarPropietarioPropiedad(propiedadId, { nombre: "Da igual", rut: actual.rut });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ya es el propietario actual/i);
  });

  it("rechaza un RUT inválido antes de tocar la base", async () => {
    mockGetActor.mockResolvedValue(actorManager(tenantRow));
    const { propiedadId } = await sembrarPropiedad({ conContratoVigente: false });

    const res = await actions.cambiarPropietarioPropiedad(propiedadId, { nombre: "X", rut: "11111111-9" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no es válido/i);

    const prop = await comoTenant((tx) => tx.propiedad.findFirstOrThrow({ where: { id: propiedadId } }));
    expect(prop.propietarioId).toBe(idPropOriginal);
  });

  it("una propiedad de otro tenant (o inexistente) se rechaza como no encontrada", async () => {
    mockGetActor.mockResolvedValue(actorManager(tenantRow));
    const res = await actions.cambiarPropietarioPropiedad("00000000-0000-4000-8000-000000000000", {
      nombre: "X", rut: "55555555-5",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no existe o no pertenece/i);
  });
});
