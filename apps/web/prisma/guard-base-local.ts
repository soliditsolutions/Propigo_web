/**
 * Guard de los scripts de desarrollo que destruyen datos (TRUNCATE) o crean
 * cuentas con contraseñas conocidas y publicadas en el repo.
 *
 * Correrlos con las variables de producción cargadas borraría todas las
 * corredoras o dejaría una puerta trasera. Solo se permiten contra un host
 * local; un caso legítimo fuera de eso exige ALLOW_REMOTE_SEED=1 explícito.
 */
const HOSTS_LOCALES = ["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal", "db", "propigo-db"];

export function verificarBaseLocal(url: string | undefined, script: string): void {
  if (!url) throw new Error(`${script}: no hay URL de base de datos definida.`);
  if (process.env.ALLOW_REMOTE_SEED === "1") {
    console.warn(`⚠️  ${script}: ALLOW_REMOTE_SEED=1 — saltando el guard de base local.`);
    return;
  }
  // Con Cloud SQL Auth Proxy la base de producción también se ve como localhost,
  // así que el host solo no alcanza: en un entorno de producción nunca.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${script}: se canceló porque NODE_ENV=production. Con el proxy de Cloud SQL la base de ` +
        "producción aparece como localhost y este script la borraría. Si de verdad lo necesitas, ALLOW_REMOTE_SEED=1.",
    );
  }
  const host = new URL(url).hostname;
  if (!HOSTS_LOCALES.includes(host)) {
    throw new Error(
      `${script}: se canceló porque la base apunta a "${host}", que no es local.\n` +
        "Este script es solo para desarrollo. Si de verdad lo necesitas ahí, corre con ALLOW_REMOTE_SEED=1.",
    );
  }
}
