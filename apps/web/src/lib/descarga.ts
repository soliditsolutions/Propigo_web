/**
 * Nombre de archivo de una cabecera Content-Disposition. Prefiere
 * `filename*=UTF-8''…` (RFC 6266, admite tildes) sobre `filename="…"`.
 * Devuelve `null` si no trae uno usable.
 */
export function nombreDeDisposicion(cabecera: string | null): string | null {
  if (!cabecera) return null;
  const extendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(cabecera);
  if (extendido) {
    try {
      return limpiar(decodeURIComponent(extendido[1].trim()));
    } catch {
      // Codificación rota: probar con el nombre simple.
    }
  }
  const simple = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(cabecera);
  const nombre = simple?.[1] ?? simple?.[2];
  return nombre ? limpiar(nombre.trim()) : null;
}

/** Sin rutas ni caracteres de control: solo el nombre del archivo. */
function limpiar(nombre: string): string | null {
  const base = nombre.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, "").trim();
  return base && base !== "." && base !== ".." ? base : null;
}
