/**
 * TEMPORAL — bootstrap de cuenta corredor para auditoría E2E 2026-07.
 * Replica exactamente lo que crea registroAction tras la verificación de
 * identidad (que no es automatizable: requiere cédula real + Groq).
 * Eliminar al terminar la auditoría.
 */
import "dotenv/config";
import { adaptadorPg } from "../src/lib/pg-adaptador";
import { PrismaClient } from "../src/generated/prisma/client";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const key     = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits    = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" }, key, 256);
  return `pbkdf2v1$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}

const adapter = adaptadorPg(process.env.DATABASE_URL);
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const user = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { nombre: "Corredora E2E SpA", rut: "76543210-3", plan: "Gratuito" },
      select: { id: true },
    });
    return tx.usuario.create({
      data: {
        tenantId:       tenant.id,
        rol:            "manager",
        nombre:         "Carlos Corredor",
        rut:            "11111111-1",
        email:          "corredor.e2e@test.cl",
        passwordHash:   await hashPassword("PruebaE2E.Propigo2026!"),
        consentGivenAt: now,
        consentVersion: "tys-v1.0",
      },
      select: { id: true, email: true, tenantId: true },
    });
  });
  console.log("Cuenta E2E creada ✅", user);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
