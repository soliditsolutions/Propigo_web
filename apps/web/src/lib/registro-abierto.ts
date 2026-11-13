/**
 * Interruptor de registro de corredoras.
 *
 * El registro está **abierto por defecto**: toda cuenta nueva nace en el plan
 * Gratuito (1 propiedad, ver `PLAN_GRATUITO`). `REGISTRO_ABIERTO=false` lo cierra
 * y queda como válvula de emergencia (abuso, incidente, mantención): se consulta
 * en cada petición, tanto al mostrar la página como al crear la cuenta, porque
 * ocultar el formulario no basta: la acción es un POST que cualquiera puede
 * llamar directamente.
 *
 * Cualquier valor distinto de "false" deja el registro abierto: un error de
 * tipeo en la variable no debe cerrar el sitio sin que nadie lo note.
 */
export function registroAbierto(env: Record<string, string | undefined> = process.env): boolean {
  return env.REGISTRO_ABIERTO !== "false";
}
