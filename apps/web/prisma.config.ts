import "dotenv/config";
import { defineConfig } from "prisma/config";

// El CLI de Prisma (migrate, db execute, db push) hace DDL: necesita el rol
// dueño de las tablas (ADR-0011), no el de runtime `propigo_app`, que está
// sujeto a RLS y no puede crear ni alterar tablas. La app nunca lee este
// archivo: se conecta con DATABASE_URL desde src/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_ADMIN_URL"] ?? process.env["DATABASE_URL"],
  },
});
