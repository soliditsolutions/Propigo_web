/**
 * Tema visual Aurora — claro/oscuro, elegido por el usuario (no es solo
 * "seguir el sistema": es una preferencia explícita que se recuerda).
 */

export type HwTheme = "aurora-dark" | "aurora-light";

export const PGO_THEME_STORAGE_KEY = "pgo_theme";

export function isHwTheme(value: string | null): value is HwTheme {
  return value === "aurora-dark" || value === "aurora-light";
}

/**
 * Tema a aplicar: el guardado o, si no hay (o el almacenamiento está
 * bloqueado), el del sistema. Misma regla que PGO_THEME_INIT_SCRIPT.
 */
export function temaPreferido(): HwTheme {
  let guardado: string | null = null;
  try {
    guardado = localStorage.getItem(PGO_THEME_STORAGE_KEY);
  } catch {
    // Almacenamiento bloqueado: se usa la preferencia del sistema.
  }
  if (isHwTheme(guardado)) return guardado;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "aurora-light" : "aurora-dark";
}

/**
 * Reaplica el tema en <html> si falta. Lo usan las páginas de error: cuando el
 * render del servidor falla, React vuelve a renderizar el documento en el
 * cliente y descarta el data-theme que puso el script anti-parpadeo.
 */
export function asegurarTema(): void {
  if (!isHwTheme(document.documentElement.getAttribute("data-theme"))) {
    document.documentElement.setAttribute("data-theme", temaPreferido());
  }
}

/**
 * Script que se inyecta inline (con nonce) ANTES de hidratar React, para que
 * <html data-theme="..."> quede correcto desde el primer paint — sin esto,
 * se vería un destello del tema contrario cada vez que se recarga la página.
 */
export const PGO_THEME_INIT_SCRIPT = `
(function () {
  try {
    var KEY = "${PGO_THEME_STORAGE_KEY}";
    var saved = localStorage.getItem(KEY);
    var theme = (saved === "aurora-light" || saved === "aurora-dark")
      ? saved
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
          ? "aurora-light"
          : "aurora-dark");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`.trim();
