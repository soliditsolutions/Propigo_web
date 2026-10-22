/**
 * Arranque del servidor Next.js: `register` corre una sola vez al iniciar cada
 * instancia y antes de aceptar tráfico.
 *
 * Aquí viven las validaciones fail-fast de configuración (FIX A2). Antes se
 * llamaban al cargar el layout raíz, que `next build` también evalúa al
 * recolectar datos de las páginas: el build exigía los secretos de producción,
 * y esos secretos no deben existir en la etapa de compilación de la imagen.
 */
export async function register() {
  // Solo el runtime de Node: el proxy (edge) no necesita estas variables.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupChecks } = await import("@/lib/startup-check");
    try {
      runStartupChecks();
    } catch (e) {
      // Si solo se relanza, Next sigue vivo y responde 500 a todo: el error se
      // repite en cada request y el orquestador ve una instancia "viva". Salir
      // deja un único mensaje claro y un contenedor caído, que es lo correcto.
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }
}
