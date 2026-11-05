/**
 * Clasificación de los fallos al llamar una server action desde el cliente.
 *
 * Una server action que no llega a ejecutarse (sin red, servidor caído,
 * sesión vencida) no devuelve el `{ ok: false, error }` de siempre: la
 * promesa se rechaza, y sin capturarla React escala el error al límite de la
 * ruta y la página se pierde junto con lo escrito. Este módulo traduce ese
 * rechazo a un mensaje para el usuario. Es puro (sin React ni APIs de Next)
 * para que lo compartan el proxy, el cliente y las pruebas.
 */

/**
 * Cuerpo `text/plain` con el que el proxy responde (401) a una server action
 * sin sesión válida. El cliente de Next usa el cuerpo de una respuesta
 * `text/plain` con estado >= 400 como mensaje del error que rechaza la
 * acción; así el cliente reconoce el caso sin depender de cabeceras internas.
 */
export const SESION_EXPIRADA = "PGO_SESION_EXPIRADA";

export type TipoFallo = "sin-conexion" | "servidor-inalcanzable" | "sesion" | "inesperado";

export interface FalloAccion {
  tipo: TipoFallo;
  mensaje: string;
  /** Salida sugerida (por ejemplo, volver a iniciar sesión). */
  accion?: { texto: string; href: string };
}

/**
 * @param enLinea   `navigator.onLine` al momento del fallo.
 * @param rutaActual pathname actual: define a qué inicio de sesión se envía.
 */
export function describirFalloAccion(err: unknown, enLinea: boolean, rutaActual: string): FalloAccion {
  const mensajeError = err instanceof Error ? err.message : typeof err === "string" ? err : "";

  if (mensajeError === SESION_EXPIRADA) {
    const esPortal = rutaActual.startsWith("/portal");
    return {
      tipo: "sesion",
      mensaje: esPortal
        ? "Tu sesión del portal expiró. Vuelve a ingresar con tu RUT para continuar."
        : "Tu sesión expiró. Inicia sesión de nuevo para continuar; lo que escribiste no se guardó.",
      accion: esPortal
        ? { texto: "Ingresar de nuevo", href: "/portal" }
        : { texto: "Iniciar sesión", href: "/login" },
    };
  }

  if (!enLinea) {
    return {
      tipo: "sin-conexion",
      mensaje: "Estás sin conexión a internet. Revisa tu red e inténtalo de nuevo; lo que escribiste sigue aquí.",
    };
  }

  // fetch() rechaza con TypeError cuando la petición no llega a ninguna parte
  // (servidor caído, DNS, corte a mitad de camino) aunque el equipo tenga red.
  if (err instanceof TypeError) {
    return {
      tipo: "servidor-inalcanzable",
      mensaje: "No pudimos comunicarnos con el servidor. Inténtalo de nuevo en unos segundos.",
    };
  }

  return {
    tipo: "inesperado",
    mensaje: "No pudimos completar la acción por un problema de nuestro lado. Inténtalo de nuevo; si se repite, escríbenos a soporte.",
  };
}

/**
 * Envuelve la server action de un formulario con `useActionState` para que
 * un rechazo se convierta en `{ error }`, el mismo estado que ya pinta el
 * formulario, en vez de romper la página.
 */
export function accionDeFormulario<S>(
  accion: (prev: S, datos: FormData) => Promise<S>,
  // Garantía de tipos: solo acepta acciones cuyo estado admite `{ error }`;
  // si no, exige un argumento `never` imposible y la llamada no compila.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- solo existe para el chequeo de tipos
  ..._estadoConError: { error: string } extends S ? [] : [never]
): (prev: S, datos: FormData) => Promise<S> {
  return async (prev, datos) => {
    try {
      return await accion(prev, datos);
    } catch (err) {
      console.error("[accion-formulario]", err);
      const fallo: { error: string } = {
        error: describirFalloAccion(err, navigator.onLine, window.location.pathname).mensaje,
      };
      return fallo as S; // seguro: la firma garantiza que { error } es un S válido
    }
  };
}
