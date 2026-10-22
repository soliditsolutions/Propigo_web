/**
 * Limpieza de datos de usuario para pruebas E2E desde cero.
 * Ejecutar: npm run db:clean -w @propigo/web
 *
 * Trunca todo el grafo de datos de tenants (usuarios, personas, propiedades,
 * contratos, ledger, etc.) vía CASCADE. CONSERVA las series de referencia
 * serie_uf y serie_ipc (no son datos de usuario; se necesitan para conversión
 * UF→CLP y reajuste IPC). Si faltan, las regenera.
 */
import "dotenv/config";
import { adaptadorPg } from "../src/lib/pg-adaptador";
import { PrismaClient } from "../src/generated/prisma/client";
import { redondearPeso } from "@propigo/core";

const adapter = adaptadorPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Limpiando datos de usuario (tenants y todo su grafo)…");
  // TRUNCATE CASCADE sigue las FK: usuario, persona, propiedad, publicacion,
  // reserva, contrato, periodo_pago, pago_entrante, asiento_ledger, voucher,
  // notificacion, documento, acceso_otp, acceso_log, consulta_contacto,
  // valoracion_corredor, comentario_corredor, denuncia, ajuste_liquidacion,
  // dispositivo_confiable, codigo_dispositivo, reset_token.
  await prisma.$executeRawUnsafe("TRUNCATE tenant RESTART IDENTITY CASCADE;");

  // Asegurar series de referencia (26 meses desde dic-2024).
  const ufCount = await prisma.serieUf.count();
  if (ufCount === 0) {
    console.log("Series UF/IPC ausentes — regenerando…");
    const seriesUf: { fecha: Date; valorClp: number }[] = [];
    const seriesIpc: { periodo: Date; indice: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const d = new Date(Date.UTC(2024, 11 + i, 1));
      seriesUf.push({ fecha: d, valorClp: redondearPeso(37000 * Math.pow(1.0035, i)) });
      seriesIpc.push({ periodo: d, indice: Math.round(100 * Math.pow(1.0035, i) * 10000) / 10000 });
    }
    await prisma.serieUf.createMany({ data: seriesUf });
    await prisma.serieIpc.createMany({ data: seriesIpc });
  }

  const tenants = await prisma.tenant.count();
  console.log(`Limpieza completada ✅  (tenants: ${tenants}, serie_uf: ${await prisma.serieUf.count()} filas)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
