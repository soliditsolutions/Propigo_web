/**
 * Seguridad de los datos privados de una propiedad — contra Postgres real.
 *
 * El rol de avalúo identifica el inmueble ante el SII y los números de cuenta
 * identifican a personas. Hay dos maneras de perderlos: que se filtren entre
 * corredoras, o que salgan por una inyección. Este archivo ataca ambas.
 *
 * Corre contra la base de verdad y con el rol de la aplicación (`propigo_app`,
 * sujeto a RLS). Es la única forma de probar aislamiento: un test que mockea
 * Prisma nunca ejecuta una política de fila, así que pasaría igual aunque RLS
 * estuviera apagado.
 *
 * Si la base no está levantada, el archivo se salta en vez de fallar. La sonda
 * distingue "no hay base" de "hay base y algo salió mal": lo segundo revienta a
 * la vista, porque un archivo de seguridad que se salta solo es peor que no
 * tenerlo.
 */
// Los tests del proyecto corren sin .env; este necesita la cadena de conexión.
import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { adaptadorPg } from "@/lib/pg-adaptador";
import { PrismaClient } from "../../generated/prisma/client";
import { terminoBusqueda } from "../busqueda";

/** Payloads de inyección, en las formas que un atacante probaría. */
const PAYLOADS = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "'; DROP TABLE cuenta_servicio; --",
  "' UNION SELECT numero FROM cuenta_servicio --",
  "%' --",
  "1' AND (SELECT COUNT(*) FROM cuenta_servicio) > 0 --",
  "\\'; SELECT pg_sleep(0); --",
  "00000000-0000-0000-0000-000000000000' OR tenant_id IS NOT NULL --",
];

const NUMERO_SECRETO = "SECRETO-QA-9988776655";
const ROL_SECRETO = "9999-1";
/** Número de cuenta bancaria señuelo. Un dato de este tipo filtrado es fraude. */
const CUENTA_SECRETA = "SECRETO-QA-BANCO-4433221100";

let prisma: PrismaClient | null = null;
let tenantA = "";
let tenantB = "";
let propiedadA = "";
let personaA = "";
let cuentaBancariaA = "";

/** Ejecuta `fn` con el contexto de tenant seteado, igual que withTenant(). */
async function comoTenant<T>(tenantId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma!.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    return fn(tx as unknown as PrismaClient);
  }) as Promise<T>;
}

/**
 * Prepara el escenario. Se ejecuta al cargar el módulo, y no en un `beforeAll`,
 * porque vitest decide qué saltar mientras COLECTA los tests: un flag que se
 * calcula después llega tarde y el archivo entero se salta en silencio.
 */
async function preparar(): Promise<boolean> {
  const url = process.env.DATABASE_URL;
  if (!url) return false;

  prisma = new PrismaClient({ adapter: adaptadorPg(url) });
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await prisma.$disconnect().catch(() => {});
    prisma = null;
    return false; // Sin base: es lo único que justifica saltarse esto.
  }

  // De acá en adelante hay base, así que cualquier error es un fallo real y
  // tiene que verse. Nada de catch.
  const tenants = await prisma.$queryRaw<{ id: string }[]>`SELECT id::text FROM tenant LIMIT 2`;
  if (tenants.length < 2) {
    throw new Error(
      "Se necesitan al menos dos corredoras para probar aislamiento. " +
      "Corre `npm run db:seed` antes.",
    );
  }
  tenantA = tenants[0].id;
  tenantB = tenants[1].id;

  // Propiedad señuelo en A, con un número de cuenta inconfundible: si ese
  // string aparece donde no debe, la fuga es incontestable.
  const prop = await comoTenant(tenantA, async (tx) => {
    const persona = await tx.persona.findFirst({ where: { tenantId: tenantA }, select: { id: true } });
    if (!persona) throw new Error("La corredora de prueba no tiene personas; falta correr el seed.");
    return tx.propiedad.create({
      data: {
        tenantId: tenantA, propietarioId: persona.id, tipo: "casa",
        direccion: "QA Seguridad 1", rol: ROL_SECRETO,
        cuentasServicio: {
          create: [{ tenantId: tenantA, tipo: "agua", estado: "registrada", numero: NUMERO_SECRETO, paga: "arrendatario" }],
        },
        rolesComplementarios: {
          create: [{ tenantId: tenantA, tipo: "bodega", rol: "9999-2" }],
        },
      },
      select: { id: true },
    });
  });
  propiedadA = prop.id;

  // Cuenta bancaria del propietario, con un número inconfundible. Va sobre la
  // misma persona señuelo para no ocupar el cupo de la cuenta de la corredora,
  // que el índice único parcial limita a una por tenant.
  const cuenta = await comoTenant(tenantA, async (tx) => {
    const persona = await tx.persona.findFirst({ where: { tenantId: tenantA }, select: { id: true } });
    if (!persona) throw new Error("La corredora de prueba no tiene personas; falta correr el seed.");
    personaA = persona.id;
    await tx.cuentaBancaria.deleteMany({ where: { tenantId: tenantA, personaId: persona.id } });
    return tx.cuentaBancaria.create({
      data: {
        tenantId: tenantA, personaId: persona.id, banco: "Banco QA",
        tipo: "corriente", numero: CUENTA_SECRETA,
        titular: "Titular QA", rutTitular: "11111111-1",
      },
      select: { id: true },
    });
  });
  cuentaBancariaA = cuenta.id;
  return true;
}

const hayBase = await preparar();
const cuando = hayBase ? describe : describe.skip;

afterAll(async () => {
  if (prisma && cuentaBancariaA) {
    await comoTenant(tenantA, (tx) => tx.cuentaBancaria.deleteMany({ where: { id: cuentaBancariaA } }));
  }
  if (prisma && propiedadA) {
    await comoTenant(tenantA, (tx) => tx.propiedad.deleteMany({ where: { id: propiedadA } }));
  }
  await prisma?.$disconnect();
});

cuando("Aislamiento entre corredoras (RLS)", () => {
  it("otra corredora NO ve las cuentas de servicio", async () => {
    // Sin filtrar por tenantId a propósito: si algo aparece, el aislamiento lo
    // estaría dando el código de la aplicación y no la base.
    const fuga = await comoTenant(tenantB, (tx) =>
      tx.cuentaServicio.findMany({ where: { numero: NUMERO_SECRETO } }));
    expect(fuga).toHaveLength(0);
  });

  it("la corredora dueña SÍ ve su cuenta bancaria", async () => {
    // Control positivo, y va primero a propósito. Sin él, los tres tests que
    // siguen —todos esperan cero filas— pasarían igual si la siembra hubiera
    // fallado y no existiera ninguna cuenta que filtrar. Un aislamiento que se
    // prueba sobre una tabla vacía no prueba nada.
    const propia = await comoTenant(tenantA, (tx) =>
      tx.cuentaBancaria.findMany({ where: { numero: CUENTA_SECRETA } }));
    expect(propia).toHaveLength(1);
  });

  it("otra corredora NO ve las cuentas bancarias", async () => {
    // Un número de cuenta filtrado entre corredoras no es una molestia de
    // privacidad: es el dato con el que se comete un fraude.
    const fuga = await comoTenant(tenantB, (tx) =>
      tx.cuentaBancaria.findMany({ where: { numero: CUENTA_SECRETA } }));
    expect(fuga).toHaveLength(0);
  });

  it("otra corredora NO puede modificar ni borrar una cuenta bancaria", async () => {
    const upd = await comoTenant(tenantB, (tx) =>
      tx.cuentaBancaria.updateMany({ where: { numero: CUENTA_SECRETA }, data: { numero: "DESVIADA" } }));
    const del = await comoTenant(tenantB, (tx) =>
      tx.cuentaBancaria.deleteMany({ where: { numero: CUENTA_SECRETA } }));
    expect(upd.count).toBe(0);
    expect(del.count).toBe(0);

    // Redirigir la cuenta de destino de una liquidación es el ataque que esto
    // impide, así que se comprueba que el número siguió siendo el mismo.
    const propia = await comoTenant(tenantA, (tx) =>
      tx.cuentaBancaria.findMany({ where: { id: cuentaBancariaA }, select: { numero: true } }));
    expect(propia[0]?.numero).toBe(CUENTA_SECRETA);
  });

  it("SIN contexto de tenant tampoco se ven las cuentas bancarias", async () => {
    const fuga = await prisma!.cuentaBancaria.findMany({ where: { numero: CUENTA_SECRETA } });
    expect(fuga).toHaveLength(0);
  });

  it("otra corredora NO ve los roles complementarios", async () => {
    const fuga = await comoTenant(tenantB, (tx) =>
      tx.rolComplementario.findMany({ where: { propiedadId: propiedadA } }));
    expect(fuga).toHaveLength(0);
  });

  it("otra corredora NO ve la propiedad ni su rol", async () => {
    const fuga = await comoTenant(tenantB, (tx) =>
      tx.propiedad.findMany({ where: { rol: ROL_SECRETO } }));
    expect(fuga).toHaveLength(0);
  });

  it("otra corredora NO puede modificar ni borrar esos datos", async () => {
    const upd = await comoTenant(tenantB, (tx) =>
      tx.cuentaServicio.updateMany({ where: { numero: NUMERO_SECRETO }, data: { numero: "HACKEADO" } }));
    const del = await comoTenant(tenantB, (tx) =>
      tx.cuentaServicio.deleteMany({ where: { numero: NUMERO_SECRETO } }));
    expect(upd.count).toBe(0);
    expect(del.count).toBe(0);

    // Y el dato sigue intacto para su dueño.
    const propia = await comoTenant(tenantA, (tx) =>
      tx.cuentaServicio.findMany({ where: { numero: NUMERO_SECRETO } }));
    expect(propia).toHaveLength(1);
  });

  it("SIN contexto de tenant no se ve nada", async () => {
    // Es el caso de una consulta que se olvidó de withTenant(): tiene que
    // devolver vacío, no la tabla completa.
    const fuga = await prisma!.cuentaServicio.findMany({ where: { numero: NUMERO_SECRETO } });
    expect(fuga).toHaveLength(0);
  });

  it("un tenant_id inventado no abre la puerta", async () => {
    // Si alguien lograra controlar el valor que va a set_config, un uuid
    // cualquiera no debe devolver datos de nadie.
    const fuga = await comoTenant("00000000-0000-0000-0000-000000000000", (tx) =>
      tx.cuentaServicio.findMany({}));
    expect(fuga).toHaveLength(0);
  });
});

cuando("Inyección SQL", () => {
  it.each(PAYLOADS)("un id malicioso no devuelve datos ajenos: %s", async (payload) => {
    // Los ids llegan desde la URL. Prisma los manda como parámetro, así que el
    // payload viaja como VALOR y nunca como SQL. Se comprueba que ni filtre ni
    // reviente de una forma que revele la estructura de la base.
    const resultado = await comoTenant(tenantA, async (tx) => {
      try {
        return await tx.cuentaServicio.findMany({ where: { propiedadId: payload } });
      } catch (e) {
        // Un cast de uuid que falla es aceptable; lo inaceptable es que ejecute.
        return { error: e instanceof Error ? e.message : String(e) };
      }
    });

    if (Array.isArray(resultado)) {
      expect(resultado).toHaveLength(0);
    } else {
      expect(resultado.error).not.toMatch(/syntax error at or near/i);
    }
  });

  it.each(PAYLOADS)("un payload guardado en el ROL no ejecuta SQL: %s", async (payload) => {
    // El rol es texto libre que escribe el corredor: el camino más directo para
    // una inyección de segundo orden (guardar ahora, ejecutar cuando otra
    // consulta lo lea).
    const encontrado = await comoTenant(tenantA, (tx) =>
      tx.propiedad.findMany({ where: { rol: payload }, select: { id: true } }));
    expect(encontrado).toHaveLength(0);
  });

  it("las tablas siguen existiendo después de los payloads con DROP", async () => {
    // Si alguno hubiera ejecutado, esto fallaría.
    const filas = await comoTenant(tenantA, (tx) =>
      tx.cuentaServicio.count({ where: { numero: NUMERO_SECRETO } }));
    expect(filas).toBe(1);
  });

  it("un comodín amplía la búsqueda pero NUNCA cruza de corredora", async () => {
    // `contains` genera un LIKE y Prisma no escapa el `%`, así que este término
    // calza con todo. Lo que se fija acá es el límite duro: por mucho que el
    // patrón se abra, RLS sigue conteniendo el resultado dentro de la corredora.
    // Es la garantía que importa aunque un buscador nuevo olvide escapar.
    const propias = await comoTenant(tenantB, (tx) =>
      tx.cuentaServicio.findMany({ where: { numero: { contains: "%" } }, select: { numero: true, tenantId: true } }));

    expect(propias.every((c) => c.tenantId === tenantB)).toBe(true);
    expect(propias.some((c) => c.numero === NUMERO_SECRETO)).toBe(false);
  });

  it("el término escapado deja de comportarse como comodín", async () => {
    // Contraparte del caso anterior: con terminoBusqueda() el `%` vuelve a ser
    // un carácter y la búsqueda solo calza con quien lo tenga literal.
    const conEscape = await comoTenant(tenantA, (tx) =>
      tx.cuentaServicio.findMany({ where: { numero: { contains: terminoBusqueda("%")! } } }));
    expect(conEscape).toHaveLength(0);
  });
});

cuando("Integridad de los datos", () => {
  it("un servicio marcado 'no aplica' nunca conserva un número", async () => {
    // Un número huérfano bajo un "no aplica" se lee después como dato bueno.
    const inconsistentes = await comoTenant(tenantA, (tx) =>
      tx.cuentaServicio.count({ where: { estado: "no_aplica", NOT: { numero: null } } }));
    expect(inconsistentes).toBe(0);
  });

  it("toda cuenta pertenece a una propiedad de la misma corredora", async () => {
    // Un cruce acá significaría que alguien escribió con el tenantId del actor
    // pero la propiedad de otro.
    const cruzadas = await comoTenant(tenantA, (tx) => tx.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n
      FROM cuenta_servicio c JOIN propiedad p ON p.id = c.propiedad_id
      WHERE c.tenant_id <> p.tenant_id`);
    expect(Number(cruzadas[0].n)).toBe(0);
  });

  it("todo rol complementario pertenece a una propiedad de la misma corredora", async () => {
    const cruzados = await comoTenant(tenantA, (tx) => tx.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n
      FROM rol_complementario r JOIN propiedad p ON p.id = r.propiedad_id
      WHERE r.tenant_id <> p.tenant_id`);
    expect(Number(cruzados[0].n)).toBe(0);
  });
});


cuando("Una sola cuenta bancaria por titular", () => {
  it("la corredora no puede tener dos cuentas propias", async () => {
    // El @@unique de Prisma sobre (tenant_id, persona_id) NO cubre este caso:
    // en Postgres dos NULL no son iguales entre sí, así que sin el índice
    // parcial de setup.sql se podrían acumular varias cuentas de corredora y
    // no habría forma de saber a cuál se le pide transferir al arrendatario.
    const datos = {
      tenantId: tenantA, personaId: null, banco: "Banco QA",
      tipo: "corriente" as const, numero: "QA-CORREDORA-1",
      titular: "Corredora QA", rutTitular: "11111111-1",
    };
    let creadaId = "";
    try {
      await comoTenant(tenantA, (tx) => tx.cuentaBancaria.deleteMany({
        where: { tenantId: tenantA, personaId: null },
      }));
      const primera = await comoTenant(tenantA, (tx) =>
        tx.cuentaBancaria.create({ data: datos, select: { id: true } }));
      creadaId = primera.id;

      await expect(
        comoTenant(tenantA, (tx) =>
          tx.cuentaBancaria.create({ data: { ...datos, numero: "QA-CORREDORA-2" } })),
      ).rejects.toThrow();
    } finally {
      if (creadaId) {
        await comoTenant(tenantA, (tx) => tx.cuentaBancaria.deleteMany({ where: { id: creadaId } }));
      }
    }
  });

  it("un propietario no puede tener dos cuentas", async () => {
    // Este sí lo cubre el @@unique de Prisma, y se comprueba para que un
    // refactor que lo quite no pase inadvertido.
    await expect(
      comoTenant(tenantA, (tx) => tx.cuentaBancaria.create({
        data: {
          tenantId: tenantA, personaId: personaA, banco: "Banco QA",
          tipo: "vista", numero: "QA-DUPLICADA",
          titular: "Titular QA", rutTitular: "11111111-1",
        },
      })),
    ).rejects.toThrow();
  });
});
