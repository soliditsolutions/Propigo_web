/**
 * Interruptor de registro de corredoras.
 *
 * V0 (decisión 2026-11-02): el sitio se publica sin abrir registros. Registrarse
 * crea datos personales reales (Ley 21.719) y exige antes respaldos, archivos
 * fuera del servidor y soporte operando.
 *
 * Por defecto el registro está **cerrado en producción y abierto en desarrollo**.
 * `REGISTRO_ABIERTO=true` lo abre en producción; `REGISTRO_ABIERTO=false` lo
 * cierra también en desarrollo (para probar el estado cerrado).
 *
 * Se consulta en cada petición, tanto al mostrar la página como al crear la
 * cuenta: ocultar el formulario no basta, la acción es un POST que cualquiera
 * puede llamar directamente.
 */
export function registroAbierto(env: Record<string, string | undefined> = process.env): boolean {
  if (env.REGISTRO_ABIERTO === "true") return true;
  if (env.REGISTRO_ABIERTO === "false") return false;
  return env.NODE_ENV !== "production";
}
