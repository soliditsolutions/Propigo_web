/**
 * Propiedades demo adicionales — SOLO para poder evaluar de verdad el grid
 * del marketplace (densidad, responsive, hover) con más de una tarjeta.
 *
 * Aditivo, no destructivo: a diferencia de `seed.ts` (que hace TRUNCATE),
 * este script solo agrega filas al tenant "Corredora Demo SpA" ya sembrado.
 * Idempotente por `rol` (cada una lleva el prefijo SEED- y se salta si ya
 * existe) — correr dos veces no duplica nada.
 *
 * No incluye fotos reales: sin acceso de red desde este entorno para bajar
 * imágenes con licencia clara, se prefirió dejar el estado "sin fotos aún"
 * (con la textura de `.pf-img-empty`) antes que inventar URLs rotas. El
 * volumen ya alcanza para evaluar el layout del grid — las fotos quedan
 * pendientes por separado (ver Docs/gestion/auditoria-critica-uiux-2026-09.md).
 *
 * Uso: npx tsx prisma/seed-demo-propiedades.ts
 */
import "dotenv/config";
import { adaptadorPg } from "../src/lib/pg-adaptador";
import { PrismaClient } from "../src/generated/prisma/client";

function verificarBaseLocal(url: string | undefined): void {
  if (!url) throw new Error("DATABASE_URL no está definida.");
  if (process.env.ALLOW_REMOTE_SEED === "1") return;
  const host = new URL(url).hostname;
  const locales = ["localhost", "127.0.0.1", "::1", "host.docker.internal", "db", "propigo-db"];
  if (!locales.includes(host)) {
    throw new Error(`Se canceló: DATABASE_URL apunta a "${host}", que no es local.`);
  }
}
verificarBaseLocal(process.env.DATABASE_URL);

const adapter = adaptadorPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

type Nueva = {
  rol: string;
  tipo: "casa" | "departamento" | "cabana";
  direccion: string; comuna: string; region: string;
  piezas: number; banos: number; estacionamientos: number;
  m2Construidos: number; m2Totales: number; antiguedadAnios: number;
  precio: number; denominacion: "CLP" | "UF";
  descripcion: string;
  propietario: "juan" | "ana";
};

const NUEVAS: Nueva[] = [
  { rol: "SEED-1001-1", tipo: "departamento", direccion: "Av. Irarrázaval 3100, depto 402", comuna: "Ñuñoa", region: "Región Metropolitana de Santiago", piezas: 2, banos: 2, estacionamientos: 1, m2Construidos: 58, m2Totales: 62, antiguedadAnios: 6, precio: 550000, denominacion: "CLP", descripcion: "Luminoso, a pasos del metro Ñuñoa.", propietario: "juan" },
  { rol: "SEED-1002-3", tipo: "casa", direccion: "Los Álamos 456", comuna: "Viña del Mar", region: "Región de Valparaíso", piezas: 3, banos: 2, estacionamientos: 2, m2Construidos: 110, m2Totales: 180, antiguedadAnios: 15, precio: 900000, denominacion: "CLP", descripcion: "A 10 minutos de la playa, patio con quincho.", propietario: "ana" },
  { rol: "SEED-1003-8", tipo: "departamento", direccion: "Av. 11 de Septiembre 1800, depto 1201", comuna: "Providencia", region: "Región Metropolitana de Santiago", piezas: 1, banos: 1, estacionamientos: 0, m2Construidos: 32, m2Totales: 34, antiguedadAnios: 2, precio: 380000, denominacion: "CLP", descripcion: "Estudio nuevo, ideal para una persona.", propietario: "juan" },
  { rol: "SEED-1004-2", tipo: "cabana", direccion: "Camino a Ensenada km 12", comuna: "Puerto Varas", region: "Región de Los Lagos", piezas: 4, banos: 2, estacionamientos: 2, m2Construidos: 130, m2Totales: 3000, antiguedadAnios: 9, precio: 650000, denominacion: "CLP", descripcion: "Vista al volcán Osorno, junto al lago.", propietario: "ana" },
  { rol: "SEED-1005-6", tipo: "casa", direccion: "Los Carrera 789", comuna: "La Serena", region: "Región de Coquimbo", piezas: 3, banos: 3, estacionamientos: 2, m2Construidos: 140, m2Totales: 200, antiguedadAnios: 5, precio: 780000, denominacion: "CLP", descripcion: "Sector residencial, cerca de la costanera.", propietario: "juan" },
  { rol: "SEED-1007-4", tipo: "departamento", direccion: "Av. Kennedy 5600, depto 1504", comuna: "Las Condes", region: "Región Metropolitana de Santiago", piezas: 3, banos: 2, estacionamientos: 2, m2Construidos: 95, m2Totales: 100, antiguedadAnios: 4, precio: 32, denominacion: "UF", descripcion: "Torre con piscina y gimnasio, vista despejada.", propietario: "juan" },
];
// Solo 6, no 8: el tenant demo está en plan "Bronze" efectivo (getPlanEfectivo
// cae ahí para cualquier plan no reconocido, y "demo" no es uno de los 4
// reales) con cupo de 10 propiedades — ya tiene 4, así que 6 más llega
// exacto al tope sin tocar el plan del tenant (fuera del alcance de esta
// tarea) ni dejar el contador "12/10" roto en el panel.

async function main() {
  // RLS FORCE (ADR-0011) en propiedad/persona/publicacion/cuentaServicio —
  // sin `app.current_tenant_id` en la conexión, cada INSERT falla el WITH
  // CHECK de la política tenant_isolation. Mismo mecanismo que
  // seed-cuenta-prueba.ts (no se puede reusar withTenant() acá: vive en el
  // runtime de la app, esto es un script suelto).
  let creadas = 0;
  let saltadas = 0;

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.findFirst({ where: { rut: "76123456-0" } });
    if (!tenant) {
      throw new Error(
        'No se encontró el tenant "Corredora Demo SpA" (rut 76123456-0). ' +
          "Este script agrega propiedades a datos ya sembrados con `npm run db:seed` — corré ese primero.",
      );
    }
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}, true)`;

    const juan = await tx.persona.findFirst({ where: { tenantId: tenant.id, rut: "12345678-5" } });
    const ana = await tx.persona.findFirst({ where: { tenantId: tenant.id, rut: "9876543-3" } });
    if (!juan || !ana) {
      throw new Error("No se encontraron los propietarios base del seed (Juan Propietario / Ana Dueña).");
    }
    const propietarios = { juan: juan.id, ana: ana.id };

    for (const [i, n] of NUEVAS.entries()) {
      const existente = await tx.propiedad.findFirst({ where: { tenantId: tenant.id, rol: n.rol } });
      if (existente) { saltadas++; continue; }

      const prop = await tx.propiedad.create({
        data: {
          tenantId: tenant.id, propietarioId: propietarios[n.propietario],
          tipo: n.tipo, estado: "disponible", rol: n.rol,
          direccion: n.direccion, comuna: n.comuna, region: n.region,
          piezas: n.piezas, banos: n.banos, estacionamientos: n.estacionamientos,
          m2Construidos: n.m2Construidos, m2Totales: n.m2Totales, antiguedadAnios: n.antiguedadAnios,
          esCondominio: n.tipo === "departamento", plantas: n.tipo === "casa" ? 2 : 1,
          pagaGastosComunes: n.tipo === "departamento",
          valorGastosComunes: n.tipo === "departamento" ? 70000 + i * 5000 : null,
        },
      });

      await tx.cuentaServicio.createMany({
        data: [
          { tenantId: tenant.id, propiedadId: prop.id, tipo: "agua", estado: "registrada", numero: String(10_000_000 + i), empresa: "Aguas Andinas", paga: "arrendatario" },
          { tenantId: tenant.id, propiedadId: prop.id, tipo: "luz", estado: "registrada", numero: String(20_000_000 + i), empresa: "Enel Distribución", paga: "arrendatario" },
          { tenantId: tenant.id, propiedadId: prop.id, tipo: "gas", estado: n.tipo === "cabana" ? "no_aplica" : "registrada", numero: n.tipo === "cabana" ? null : String(30_000_000 + i), empresa: n.tipo === "cabana" ? null : "Metrogas", paga: "arrendatario" },
          n.tipo === "departamento"
            ? { tenantId: tenant.id, propiedadId: prop.id, tipo: "gastos_comunes" as const, estado: "registrada" as const, numero: String(100 + i), empresa: "Administración del edificio", paga: "propietario" as const }
            : { tenantId: tenant.id, propiedadId: prop.id, tipo: "gastos_comunes" as const, estado: "no_aplica" as const, paga: "propietario" as const },
        ] as never,
      });

      await tx.publicacion.create({
        data: {
          tenantId: tenant.id, propiedadId: prop.id, estado: "publicada",
          titulo: `${n.tipo === "casa" ? "Casa" : n.tipo === "cabana" ? "Cabaña" : "Departamento"} en ${n.comuna}`,
          denominacionPrecio: n.denominacion, precioReferencia: n.precio,
          descripcion: n.descripcion,
          // Escalonadas: la más nueva (índice 0) queda primera en "recientes".
          publicadaEn: new Date(Date.now() - i * 3_600_000),
        },
      });

      creadas++;
    }
  });

  console.log(`✅ Propiedades demo: ${creadas} creadas, ${saltadas} ya existían.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
