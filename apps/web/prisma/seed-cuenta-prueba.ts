/**
 * Cuenta de corredor persistente para pruebas manuales.
 *
 * Reemplaza al antiguo `e2e-bootstrap.ts` (que era de un solo uso: fallaba al
 * segundo run por el UNIQUE de RUT). Este script es **idempotente**: usa IDs
 * fijos y `upsert`, así que se puede correr las veces que sea — después de un
 * `prisma migrate reset`, de un `db:clean`, o simplemente para restaurar la
 * contraseña si se cambió durante una prueba.
 *
 * Replica lo que crea `registroAction` tras la verificación de identidad
 * (que no es automatizable: requiere cédula real + Groq), y además deja el
 * **perfil completo** para que la cuenta entre directo al panel sin pasar por
 * el formulario de "completa tu perfil".
 *
 * Uso:  npm run db:seed-cuenta
 * Doc:  Docs/gestion/cuentas-de-prueba.md
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// ── Credenciales fijas ─────────────────────────────────────────────────────
// Se documentan a propósito (ver doc arriba): son de desarrollo local, no hay
// secreto que proteger. Lo que SÍ importa es que nunca lleguen a un ambiente
// real — de eso se encarga el guard de abajo.
const CUENTA = {
  // IDs fijos: hacen el script idempotente y dan valores predecibles para
  // depurar (aparecen igual en logs, URLs y consultas SQL entre resets).
  tenantId: "00000000-0000-4000-8000-000000000001",
  usuarioId: "00000000-0000-4000-8000-000000000002",
  tenantNombre: "Corredora de Prueba SpA",
  // RUT de la corredora, distinto del RUT del usuario de más abajo: uno
  // identifica a la empresa y el otro a la persona que la administra.
  tenantRut: "77888999-4",
  // Diamond para que ninguna feature quede oculta detrás de un gate mientras
  // se prueba. Para probar el gating por plan, ver el doc (hay un one-liner).
  plan: "diamond",
  nombre: "Carlos Corredor",
  email: "corredor.prueba@housing.local",
  // RUT con DV verificado contra `validarRut()` de @housing/core (16.358.920-6).
  rut: "16358920-6",
  telefono: "+56912345678",
  password: "Kestrel.Vega_47",
  fechaNacimiento: new Date("1985-04-12"),
  direccion: "Av. Providencia 1234, of. 56",
  ciudad: "Providencia",
  region: "Región Metropolitana de Santiago",
} as const;

/**
 * Guard: este script crea una cuenta con contraseña conocida y publicada.
 * Correrlo contra una base real sería crear una puerta trasera. Solo se
 * permite contra un host local; para un caso legítimo fuera de eso hay que
 * pasar ALLOW_REMOTE_SEED=1 de forma explícita y consciente.
 */
function verificarBaseLocal(url: string | undefined): void {
  if (!url) throw new Error("DATABASE_URL no está definida.");
  if (process.env.ALLOW_REMOTE_SEED === "1") {
    console.warn("⚠️  ALLOW_REMOTE_SEED=1 — saltando el guard de base local.");
    return;
  }
  const host = new URL(url).hostname;
  const locales = ["localhost", "127.0.0.1", "::1", "host.docker.internal", "db", "housing-db"];
  if (!locales.includes(host)) {
    throw new Error(
      `Se canceló: DATABASE_URL apunta a "${host}", que no es local.\n` +
        "Este script crea una cuenta con contraseña conocida y NO debe existir fuera de desarrollo.\n" +
        "Si de verdad lo necesitas ahí, corre con ALLOW_REMOTE_SEED=1.",
    );
  }
}

/** PBKDF2-SHA256 — mismo formato que `lib/password.ts` usa en la app. */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    key,
    256,
  );
  return `pbkdf2v1$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}

verificarBaseLocal(process.env.DATABASE_URL);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const now = new Date();
  const passwordHash = await hashPassword(CUENTA.password);

  await prisma.$transaction(async (tx) => {
    // `usuario` está bajo RLS con FORCE (setup.sql, ADR-0011): sin el contexto
    // de tenant en la conexión, el INSERT falla el WITH CHECK de la política
    // `tenant_isolation`. Mismo mecanismo que `withTenant()` en lib/tenant-db.ts
    // — no se puede reutilizar esa función acá porque vive en el runtime de la
    // app (importa "@/generated/..." vía alias de Next) y esto es un script suelto.
    //
    // Nota: `seed.ts` no necesita esto porque corre ANTES de aplicar setup.sql
    // (push → seed → setup). Este script corre con RLS ya activo.
    await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${CUENTA.tenantId}, true)`;

    await tx.tenant.upsert({
      where: { id: CUENTA.tenantId },
      create: {
        id: CUENTA.tenantId, nombre: CUENTA.tenantNombre,
        rut: CUENTA.tenantRut, plan: CUENTA.plan,
      },
      update: { nombre: CUENTA.tenantNombre, rut: CUENTA.tenantRut, plan: CUENTA.plan },
    });

    await tx.usuario.upsert({
      where: { id: CUENTA.usuarioId },
      create: {
        id: CUENTA.usuarioId,
        tenantId: CUENTA.tenantId,
        rol: "manager",
        nombre: CUENTA.nombre,
        email: CUENTA.email,
        rut: CUENTA.rut,
        telefono: CUENTA.telefono,
        fechaNacimiento: CUENTA.fechaNacimiento,
        direccion: CUENTA.direccion,
        ciudad: CUENTA.ciudad,
        region: CUENTA.region,
        perfilCompleto: true,
        passwordHash,
        consentGivenAt: now,
        consentVersion: "tys-v1.0",
      },
      // Re-correr restaura la contraseña y limpia bloqueos por intentos
      // fallidos o una desactivación hecha durante una prueba anterior.
      update: {
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
        desactivadoEn: null,
        perfilCompleto: true,
      },
    });
  });

  console.log("✅ Cuenta de prueba lista\n");
  console.log(`   Correo      ${CUENTA.email}`);
  console.log(`   Contraseña  ${CUENTA.password}`);
  console.log(`   Rol         manager · plan "${CUENTA.plan}"`);
  console.log(`   Tenant      ${CUENTA.tenantId}`);
  console.log(`   Usuario     ${CUENTA.usuarioId}\n`);
  console.log("   Nota: el login pedirá verificar el dispositivo (2FA por correo).");
  console.log("   En local el correo se imprime en la consola del dev server.\n");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
