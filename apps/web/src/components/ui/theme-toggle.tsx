"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { PGO_THEME_STORAGE_KEY, isHwTheme, type HwTheme } from "@/lib/theme";

/**
 * Switch de tema Aurora Claro/Oscuro. Lee el valor ya fijado por el script
 * anti-FOUC en <html data-theme> — nunca asume un valor por defecto propio,
 * para no pelear con lo que el usuario ya eligió.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // null hasta montar: evita un flash de icono incorrecto durante la hidratación.
  const [theme, setTheme] = useState<HwTheme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    queueMicrotask(() => setTheme(isHwTheme(current) ? current : "aurora-dark"));
  }, []);

  function toggle() {
    const next: HwTheme = theme === "aurora-light" ? "aurora-dark" : "aurora-light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(PGO_THEME_STORAGE_KEY, next);
    } catch {
      /* localStorage puede fallar en modo privado — el tema igual se aplica en esta sesión */
    }
  }

  const isLight = theme === "aurora-light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
      title={isLight ? "Tema oscuro" : "Tema claro"}
      className={`pgo-btn pgo-tap-target relative rounded-lg p-1.5 ${className ?? ""}`}
      style={{ color: "var(--pgo-text-3)", visibility: theme === null ? "hidden" : "visible" }}
    >
      {isLight ? <Moon className="h-4 w-4" aria-hidden="true" /> : <Sun className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
