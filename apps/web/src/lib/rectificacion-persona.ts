/**
 * Derecho de rectificación desde el portal (L-DP4, Ley 21.719).
 *
 * Solo correo y teléfono son rectificables por la propia persona: son datos de
 * contacto, se corrigen y se verifican. **Nombre y RUT no** — son identidad, y
 * un portal sin contraseña no es el lugar para dejar que alguien los cambie
 * por su cuenta (mismo criterio que la identidad inmutable del corredor en el
 * panel). Si están mal, la corrección la hace la corredora; el portal solo
 * deja constancia de que se pidió (`SolicitudDerechoPersona`, derecho "identidad").
 *
 * Verificación: no hay contraseña que reautentique como en el panel, así que
 * la prueba de control es un código de 6 dígitos.
 *   · Cambio de **correo** → el código va al correo NUEVO (prueba que lo controla).
 *   · Cambio de **teléfono** → no hay envío de SMS implementado en la
 *     plataforma; el código va al **correo actual** de la persona (el único
 *     canal verificable hoy). Sin correo en la ficha, no hay cómo verificar y
 *     se rechaza con un mensaje claro en vez de aplicar el cambio a ciegas.
 */

export type CampoRectificable = "email" | "telefono";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TELEFONO = /^\+?[\d\s\-().]{7,20}$/;

/**
 * El tipo de `campo` en la firma de las acciones es solo de compilación: una
 * Server Action es un POST y nada impide que alguien la llame con otro valor
 * saltándose el formulario. Sin este chequeo en tiempo de ejecución, un
 * `campo` que no calzara ni con "email" tomaba la rama `telefono` para
 * validar pero la rama `email` al aplicar el cambio (`campo === "telefono"
 * ? ... : ...`), aplicando un valor con formato de teléfono al correo.
 */
export function esCampoRectificable(campo: unknown): campo is CampoRectificable {
  return campo === "email" || campo === "telefono";
}

/** Normaliza el valor propuesto para el campo (trim; el correo además a minúsculas). */
export function normalizarValorRectificacion(campo: CampoRectificable, valor: string): string {
  return campo === "email" ? valor.trim().toLowerCase() : valor.trim();
}

/** Valida el nuevo valor. `null` si está bien, el mensaje de error si no. */
export function validarValorRectificacion(campo: CampoRectificable, valor: string): string | null {
  if (campo === "email") {
    return RE_EMAIL.test(valor) ? null : "El correo electrónico no es válido.";
  }
  return RE_TELEFONO.test(valor) ? null : "Formato de teléfono inválido.";
}

/** A qué correo se envía el código de verificación para este cambio. */
export function correoDeVerificacion(
  campo: CampoRectificable,
  valorNuevo: string,
  emailActual: string | null,
): { correo: string; error: null } | { correo: null; error: string } {
  if (campo === "email") return { correo: valorNuevo, error: null };
  if (!emailActual) {
    return {
      correo: null,
      error: "No podemos verificar el cambio de teléfono sin un correo registrado. Contacta a tu corredora.",
    };
  }
  return { correo: emailActual, error: null };
}
