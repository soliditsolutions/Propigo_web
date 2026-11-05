/**
 * Cuánto esperar tras un 429, en palabras, a partir de la cabecera Retry-After
 * (segundos o fecha HTTP). Sin cabecera legible, un plazo genérico: lo que
 * importa es no dejar al usuario reintentando a ciegas.
 */
export function textoEspera(retryAfter: string | null, ahora: number = Date.now()): string {
  const segundos = segundosDeEspera(retryAfter, ahora);
  if (segundos === null) return "unos minutos";
  if (segundos <= 1) return "un momento";
  if (segundos < 60) return `${segundos} segundos`;
  const minutos = Math.ceil(segundos / 60);
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}

function segundosDeEspera(retryAfter: string | null, ahora: number): number | null {
  const valor = retryAfter?.trim();
  if (!valor) return null;
  if (/^\d+$/.test(valor)) return Number(valor);
  // Retry-After solo admite segundos o una fecha HTTP (IMF-fixdate, en GMT);
  // Date.parse aceptaría cosas como "-5" (el año -5).
  if (!/ GMT$/.test(valor)) return null;
  const fecha = Date.parse(valor);
  if (Number.isNaN(fecha)) return null;
  return Math.max(0, Math.ceil((fecha - ahora) / 1000));
}
