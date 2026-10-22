/**
 * Backfill de Publicaciones faltantes.
 *
 * Busca todas las Propiedades con estado="disponible" que no tienen
 * ninguna Publicacion con estado="publicada" y crea el registro.
 *
 * Uso: npm run db:repair -w @propigo/web
 */
import "dotenv/config";
import { adaptadorPg } from "../src/lib/pg-adaptador";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = adaptadorPg(process.env.DATABASE_URL);
const prisma  = new PrismaClient({ adapter });

async function main() {
  // Propiedades disponibles sin publicación publicada
  const propiedades = await prisma.propiedad.findMany({
    where: {
      estado: "disponible",
      publicaciones: {
        none: { estado: "publicada" },
      },
    },
    select: { id: true, tenantId: true, direccion: true },
  });

  if (propiedades.length === 0) {
    console.log("✅ No hay propiedades disponibles sin publicación — nada que reparar.");
    return;
  }

  console.log(`🔧 Reparando ${propiedades.length} propiedad(es)…`);

  for (const prop of propiedades) {
    // Reactiva si existe en borrador/bajada, crea si no existe
    const existente = await prisma.publicacion.findFirst({
      where: { propiedadId: prop.id, tenantId: prop.tenantId },
    });

    if (existente) {
      await prisma.publicacion.update({
        where: { id: existente.id },
        data:  { estado: "publicada", publicadaEn: new Date() },
      });
      console.log(`  ↻  Reactivada publicación para: ${prop.direccion}`);
    } else {
      await prisma.publicacion.create({
        data: {
          tenantId:    prop.tenantId,
          propiedadId: prop.id,
          titulo:      prop.direccion,
          estado:      "publicada",
          publicadaEn: new Date(),
        },
      });
      console.log(`  +  Creada publicación para: ${prop.direccion}`);
    }
  }

  console.log("✅ Backfill completado.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
