/**
 * Lectura tolerante de respuestas de nuestras rutas /api desde el cliente.
 *
 * Un 502/504 del proxy o una página de error de la plataforma no traen JSON:
 * `res.json()` lanza y el `catch` lo confundía con un problema de conexión
 * ("Error de conexión"), culpando a la red del usuario por una falla nuestra.
 */

export type CuerpoApi = { ok?: boolean; error?: unknown };

/** El JSON de la respuesta, o `null` si no lo trae o viene roto. */
export async function leerJson<T extends CuerpoApi>(res: Response): Promise<T | null> {
  try {
    const datos: unknown = await res.json();
    return datos && typeof datos === "object" ? (datos as T) : null;
  } catch {
    return null;
  }
}

/** Qué decirle al usuario cuando la ruta respondió, pero no con éxito. */
export function mensajeDeFallo(status: number, datos: CuerpoApi | null, porDefecto: string): string {
  if (status === 401) return "Tu sesión expiró. Recarga la página e inicia sesión de nuevo.";
  if (typeof datos?.error === "string" && datos.error.trim()) return datos.error;
  // El proxy corta los cuerpos grandes antes de llegar a la ruta, sin JSON.
  if (status === 413) return "El archivo supera el tamaño máximo permitido.";
  if (status >= 500 || datos === null) {
    return "No pudimos completar la operación por un problema de nuestro lado. Intenta de nuevo en unos minutos.";
  }
  return porDefecto;
}

/** Qué decir cuando fetch ni siquiera obtuvo respuesta. */
export function mensajeSinRespuesta(): string {
  return typeof navigator !== "undefined" && navigator.onLine === false
    ? "Sin conexión a internet. Revisa tu red e intenta de nuevo."
    : "No pudimos comunicarnos con el servidor. Revisa tu conexión e intenta de nuevo.";
}
