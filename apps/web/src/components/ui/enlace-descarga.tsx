"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { nombreDeDisposicion } from "@/lib/descarga";

/**
 * Enlace a una descarga (PDF, CSV, JSON) que avisa si falla.
 *
 * Un `<a href>` directo a la API mostraba el error en crudo
 * (`{"error":"No autorizado."}`) en una página en blanco cuando la sesión
 * había expirado, el documento no existía o se alcanzaba un límite. Aquí la
 * descarga se hace con fetch: si sale bien se guarda el archivo; si no, el
 * mensaje del servidor aparece en un aviso y el usuario sigue donde estaba.
 *
 * El `href` se conserva: sin JavaScript, o con Ctrl/⌘+clic, funciona como un
 * enlace normal.
 */
export function EnlaceDescarga({
  href,
  icono,
  children,
  className,
  style,
  login = "/login",
  title,
  "aria-label": ariaLabel,
}: {
  href: string;
  /** Ícono inicial; mientras se prepara el archivo se reemplaza por un
   *  indicador de carga del mismo tamaño, sin mover el resto del botón. */
  icono?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** A dónde iniciar sesión si la sesión expiró (panel o portal). */
  login?: "/login" | "/portal";
  title?: string;
  "aria-label"?: string;
}) {
  const { show: toast } = useToast();
  const [descargando, setDescargando] = useState(false);

  async function descargar(e: React.MouseEvent<HTMLAnchorElement>) {
    // Ctrl/⌘/Shift/clic central: que el navegador haga lo suyo.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (descargando) return;
    setDescargando(true);
    try {
      const res = await fetch(href, { credentials: "same-origin" });
      if (!res.ok) {
        avisarFallo(res.status, await mensajeDe(res));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreDeDisposicion(res.headers.get("content-disposition")) ?? "";
      document.body.append(a);
      a.click();
      a.remove();
      // Dar tiempo a que el navegador tome el archivo antes de liberar la URL.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      toast(
        navigator.onLine === false
          ? "Sin conexión a internet. Revisa tu red e intenta de nuevo."
          : "No pudimos descargar el archivo. Intenta de nuevo en unos minutos.",
        "error",
      );
    } finally {
      setDescargando(false);
    }
  }

  function avisarFallo(status: number, mensaje: string | null) {
    if (status === 401) {
      toast("Tu sesión expiró. Inicia sesión de nuevo para descargar.", "warning", {
        accion: { texto: "Iniciar sesión", href: login },
      });
      return;
    }
    if (status >= 500) {
      toast(mensaje ?? "No pudimos generar el archivo por un problema de nuestro lado. Intenta de nuevo en unos minutos.", "error");
      return;
    }
    // 409 ("todavía no disponible") y 429 ("espera N minutos") piden esperar o
    // cambiar algo, no son una falla: advertencia. El resto, error.
    const tipo = status === 409 || status === 429 ? "warning" : "error";
    toast(mensaje ?? (status === 404 ? "No encontramos ese archivo. Puede que se haya eliminado." : "No se pudo descargar el archivo."), tipo);
  }

  return (
    <a
      href={href}
      onClick={descargar}
      aria-busy={descargando || undefined}
      aria-label={ariaLabel}
      title={title}
      className={className}
      style={descargando ? { ...style, cursor: "progress" } : style}
    >
      {descargando ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : icono}
      {children}
      {descargando && <span className="sr-only">Preparando la descarga…</span>}
    </a>
  );
}

async function mensajeDe(res: Response): Promise<string | null> {
  try {
    const datos = (await res.json()) as { error?: unknown };
    return typeof datos.error === "string" && datos.error.trim() ? datos.error : null;
  } catch {
    return null;
  }
}
