import { PrismaClient } from "@/generated/prisma/client";
import { adaptadorPg } from "./pg-adaptador";

// v6: clave actualizada al cambiar a un pool propio (ClienteSerializado).
const globalForPrisma = globalThis as unknown as { prisma_v6?: PrismaClient };

export const prisma =
  globalForPrisma.prisma_v6 ?? new PrismaClient({ adapter: adaptadorPg(process.env.DATABASE_URL) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma_v6 = prisma;
