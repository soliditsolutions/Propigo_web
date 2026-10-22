/**
 * Verificaciones de seguridad al inicio del servidor.
 *
 * Importar este módulo en el layout raíz (src/app/layout.tsx) para que
 * se ejecute una vez al arrancar el servidor de Next.js.
 *
 * SEGURIDAD:
 * - Previene que configuraciones inseguras de desarrollo lleguen a producción.
 * - Falla rápido (fail-fast) con un mensaje descriptivo antes de aceptar tráfico.
 *
 * Refs:
 *   - CWE-295: Improper Certificate Validation
 *   - OWASP A05:2021 – Security Misconfiguration
 */

let checked = false;

export function runStartupChecks(): void {
  // Ejecutar solo una vez por ciclo de vida del servidor
  if (checked) return;
  checked = true;

  const isProd = process.env.NODE_ENV === "production";

  // ── 1. NODE_TLS_REJECT_UNAUTHORIZED en producción ──────────────────────────
  // Deshabilitar la verificación de certificados TLS es catastrófico en prod:
  // permite ataques MITM contra cualquier servicio externo (Groq, Resend, etc.).
  if (isProd && process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error(
      "[STARTUP] FATAL: NODE_TLS_REJECT_UNAUTHORIZED=0 no está permitido en producción. " +
      "Elimina esta variable del entorno de producción.",
    );
  }

  // ── 2. AUTH_SECRET mínimo ──────────────────────────────────────────────────
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret || authSecret.length < 32) {
    throw new Error(
      "[STARTUP] FATAL: AUTH_SECRET no definido o demasiado corto (mínimo 32 caracteres). " +
      "Genera uno con: openssl rand -hex 32",
    );
  }

  // ── 3. DATABASE_URL presente ───────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[STARTUP] FATAL: DATABASE_URL no definida. " +
      "Configura la variable de entorno antes de iniciar el servidor.",
    );
  }

  // ── 4. GROQ_API_KEY para verificación de identidad en registro ───────────
  // Sin esta clave el endpoint de registro queda inoperativo silenciosamente.
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "[STARTUP] FATAL: GROQ_API_KEY no definida. " +
      "El registro de nuevos corredores estará bloqueado hasta que se configure.",
    );
  }

  // ── 5. CRON_SECRET requerido en producción ────────────────────────────────
  // Sin este secreto el endpoint /api/cron/recordatorios es accesible sin auth,
  // permitiendo activar el proceso de cobros/notificaciones arbitrariamente.
  if (isProd && !process.env.CRON_SECRET) {
    throw new Error(
      "[STARTUP] FATAL: CRON_SECRET no definido en producción. " +
      "El endpoint /api/cron/recordatorios quedaría sin protección. " +
      "Genera uno con: openssl rand -hex 32",
    );
  }

  // ── 6. E2E_BYPASS_IDENTITY nunca en producción ────────────────────────────
  // AUD-07: esta variable omite la verificación de identidad por cédula en
  // /registro (solo para pruebas E2E automatizadas). Si llega a estar
  // definida en producción, cualquiera podría registrar una corredora sin
  // verificar su identidad — falla el arranque para evitarlo.
  if (isProd && process.env.E2E_BYPASS_IDENTITY) {
    throw new Error(
      "[STARTUP] FATAL: E2E_BYPASS_IDENTITY no está permitido en producción. " +
      "Elimina esta variable del entorno de producción.",
    );
  }

  // ── 7. NEXT_PUBLIC_APP_URL requerida en producción ────────────────────────
  // lib/email.ts la usa para construir enlaces absolutos en emails reales
  // (recuperación de contraseña, etc.). Sin ella cae a un fallback de
  // localhost que sería inútil para cualquier destinatario real — un correo
  // que "se envía" pero con un enlace roto, sin ningún error visible.
  if (isProd && !process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error(
      "[STARTUP] FATAL: NEXT_PUBLIC_APP_URL no definida en producción. " +
      "Los enlaces en emails (recuperación de contraseña, etc.) apuntarían a localhost. " +
      "Configura la URL pública real, ej.: https://propigo.cl",
    );
  }
}
