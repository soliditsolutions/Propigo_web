/**
 * Nombres y tiempos de las dos sesiones privadas del producto.
 *
 * Viven acá y no dentro de `auth.ts` / `portal-auth.ts` porque cada uno de esos
 * módulos necesita conocer la cookie del otro para cerrarla: sin este archivo
 * intermedio se importarían mutuamente.
 *
 * ── Por qué son excluyentes ──────────────────────────────────────────────
 * El panel es del corredor y el portal es del arrendatario o del propietario.
 * Son personas distintas, y muchas veces comparten el computador de la oficina
 * al firmar. Con las dos cookies vivas a la vez, el navegador quedaba con dos
 * identidades: volver atrás mostraba el panel del corredor y avanzar entraba al
 * portal del arrendatario, sin que ninguno hubiera cerrado sesión.
 *
 * La regla es: **abrir una sesión cierra la otra.** Se aplica en los setters de
 * cookie, no en cada pantalla de login, para que una entrada nueva no pueda
 * olvidarse de hacerlo.
 */

const IS_PROD = process.env.NODE_ENV === "production";

export const COOKIE_PANEL  = IS_PROD ? "__Host-pgo_session" : "pgo_session";
export const COOKIE_PORTAL = IS_PROD ? "__Host-pgo_portal"  : "pgo_portal";
export const COOKIE_DEVICE = IS_PROD ? "__Host-pgo_device"  : "pgo_device";

/** Atributos comunes de toda cookie de sesión. */
export const COOKIE_BASE = {
  httpOnly: true,
  secure:   IS_PROD,   // __Host- exige Secure en producción; en dev sobre HTTP se omite
  sameSite: "strict",  // mitiga CSRF
  path:     "/",
} as const;

/*
 * ── Caducidad ────────────────────────────────────────────────────────────
 * Dos límites distintos, porque protegen de cosas distintas:
 *
 *  - **Inactividad**: la pantalla queda abierta y la persona se va. Es el `exp`
 *    del JWT, así que la sesión muere sola sin que nadie tenga que revisarla.
 *    Cada request dentro de la ventana la renueva.
 *  - **Máximo absoluto**: aunque haya actividad continua, una sesión no dura
 *    para siempre. Se mide contra `ini`, el instante del login original, que
 *    sobrevive a las renovaciones.
 */

/** Panel del corredor: jornada de trabajo, con media hora de tolerancia. */
export const PANEL_INACTIVIDAD = 30 * 60;        // 30 minutos
export const PANEL_MAXIMO      = 8 * 60 * 60;    // 8 horas

/** Portal: una consulta puntual, y a menudo en un equipo prestado. */
export const PORTAL_INACTIVIDAD = 15 * 60;       // 15 minutos
export const PORTAL_MAXIMO      = 30 * 60;       // 30 minutos

/**
 * Cada cuánto se vuelve a firmar el token al haber actividad.
 *
 * Sin este umbral habría que re-firmar en cada request, incluso al cargar dos
 * páginas seguidas. Un minuto mantiene la ventana de inactividad
 * prácticamente exacta sin ese costo.
 */
export const REFRESCO_MINIMO = 60;               // 1 minuto

/**
 * Claim con el instante del login original, en segundos.
 *
 * `iat` se mueve con cada renovación, así que no sirve para el tope absoluto.
 * Los tokens emitidos antes de que esto existiera no lo traen: en ese caso se
 * usa `iat`, lo que a lo sumo les regala una ventana más y nunca los alarga
 * indefinidamente.
 */
export type ConInicio = { ini?: number; iat?: number };

/** True si la sesión superó su tope absoluto, contando desde el login. */
export function superaMaximo(sesion: ConInicio, maximo: number, ahora = Date.now()): boolean {
  const inicio = sesion.ini ?? sesion.iat;
  if (inicio === undefined) return false;
  return Math.floor(ahora / 1000) - inicio > maximo;
}

/** True si conviene volver a firmar el token para correr la ventana. */
export function tocaRefrescar(sesion: ConInicio, ahora = Date.now()): boolean {
  if (sesion.iat === undefined) return true;
  return Math.floor(ahora / 1000) - sesion.iat >= REFRESCO_MINIMO;
}
