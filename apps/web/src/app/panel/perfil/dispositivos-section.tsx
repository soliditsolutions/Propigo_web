"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Monitor, Trash2, ShieldCheck, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

type Dispositivo = {
  id:         string;
  nombre:     string;
  ipCreacion: string | null;
  lastSeenAt: string;
  createdAt:  string;
};

type Fallo = { mensaje: string; sesion?: true; reintentable?: true };

/**
 * Traduce lo que pasó con la llamada a un mensaje para el usuario. `res` es
 * null cuando fetch ni siquiera obtuvo respuesta (sin red o servidor caído).
 */
function describirFallo(res: Response | null, que: "cargar" | "eliminar"): Fallo {
  if (res?.status === 401) {
    return { mensaje: "Tu sesión expiró. Inicia sesión de nuevo para administrar tus dispositivos.", sesion: true };
  }
  if (!res && !navigator.onLine) {
    return { mensaje: "Estás sin conexión a internet. Conéctate y vuelve a intentarlo.", reintentable: true };
  }
  return que === "cargar"
    ? { mensaje: "No pudimos cargar tus dispositivos. Vuelve a intentarlo en unos segundos.", reintentable: true }
    : { mensaje: "No pudimos eliminar el dispositivo. Vuelve a intentarlo en unos segundos." };
}

/** Lee el JSON de la respuesta sin lanzar si el servidor devolvió otra cosa (p. ej. el HTML de un 500). */
async function leerJson<T>(res: Response): Promise<Partial<T>> {
  try { return (await res.json()) as Partial<T>; } catch { return {}; }
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function DispositivosSection() {
  const router = useRouter();
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [cargando,     setCargando]     = useState(true);
  const [eliminando,   setEliminando]   = useState<string | null>(null);
  // Fallo al cargar: reemplaza a la lista (no se sabe qué dispositivos hay).
  const [falloCarga,   setFalloCarga]   = useState<Fallo | null>(null);
  // Fallo al eliminar: se muestra sobre la lista, que sigue siendo válida.
  const [error,        setError]        = useState<Fallo | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setFalloCarga(null);
    setError(null);
    let res: Response | null = null;
    try {
      res = await fetch("/api/auth/dispositivos");
      if (!res.ok) { setFalloCarga(describirFallo(res, "cargar")); return; }
      const data = await leerJson<{ dispositivos: Dispositivo[] }>(res);
      if (!Array.isArray(data.dispositivos)) { setFalloCarga(describirFallo(res, "cargar")); return; }
      setDispositivos(data.dispositivos);
    } catch {
      setFalloCarga(describirFallo(res, "cargar"));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { cargar(); }); }, [cargar]);

  async function eliminar(id: string) {
    setEliminando(id);
    setError(null);
    let res: Response | null = null;
    try {
      res = await fetch(`/api/auth/dispositivos/${id}`, { method: "DELETE" });
      const data = await leerJson<{ error: string; relogin: boolean }>(res);
      if (!res.ok) {
        const fallo = describirFallo(res, "eliminar");
        // Un 4xx con motivo propio (p. ej. "no encontrado") se muestra tal cual.
        setError(!fallo.sesion && res.status < 500 && data.error ? { mensaje: data.error } : fallo);
        return;
      }
      if (data.relogin) { router.push("/login"); return; }
      setDispositivos((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError(describirFallo(res, "eliminar"));
    } finally {
      setEliminando(null);
    }
  }

  async function eliminarTodos() {
    if (!confirm("¿Eliminar todos los dispositivos? Se cerrará tu sesión actual.")) return;
    setEliminando("all");
    setError(null);
    let res: Response | null = null;
    try {
      res = await fetch("/api/auth/dispositivos", { method: "DELETE" });
      if (!res.ok) { setError(describirFallo(res, "eliminar")); return; }
      router.push("/login");
    } catch {
      setError(describirFallo(res, "eliminar"));
    } finally {
      setEliminando(null);
    }
  }

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)" }}
    >
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--pgo-primary-lt)" }}
          >
            <ShieldCheck className="h-5 w-5" style={{ color: "var(--pgo-primary)" }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--pgo-text-1)" }}>
              Dispositivos de confianza
            </h2>
            <p className="text-xs" style={{ color: "var(--pgo-text-3)" }}>
              Dispositivos donde verificaste tu identidad por email.
            </p>
          </div>
        </div>
        {dispositivos.length > 1 && (
          <button
            onClick={eliminarTodos}
            disabled={!!eliminando}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
            style={{ background: "var(--pgo-danger-lt)", color: "var(--pgo-danger)" }}
          >
            {eliminando === "all" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Eliminar todos
          </button>
        )}
      </div>

      {/* Error al eliminar: la lista de abajo sigue siendo válida */}
      {error && <div className="mb-4"><AvisoFallo fallo={error} /></div>}

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center py-8" role="status" aria-label="Cargando dispositivos">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pgo-text-4)" }} aria-hidden="true" />
        </div>
      ) : falloCarga ? (
        <AvisoFallo fallo={falloCarga} onReintentar={falloCarga.reintentable ? cargar : undefined} />
      ) : dispositivos.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: "var(--pgo-text-3)" }}>
          No hay dispositivos registrados.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--pgo-border)" }}>
          {dispositivos.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <Monitor className="h-4 w-4 shrink-0" style={{ color: "var(--pgo-text-3)" }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--pgo-text-1)" }}>
                    {d.nombre}
                  </p>
                  <p className="text-xs" style={{ color: "var(--pgo-text-3)" }}>
                    Registrado el {formatFecha(d.createdAt)}
                    {d.ipCreacion ? ` · IP ${d.ipCreacion}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => eliminar(d.id)}
                disabled={!!eliminando}
                className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-opacity disabled:opacity-40"
                style={{ background: "var(--pgo-danger-lt)", color: "var(--pgo-danger)" }}
                title="Eliminar este dispositivo"
                aria-label={`Eliminar el dispositivo ${d.nombre}`}
              >
                {eliminando === d.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AvisoFallo({ fallo, onReintentar }: { fallo: Fallo; onReintentar?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-3 py-2.5 text-sm"
      style={{ background: "var(--pgo-danger-lt)", color: "var(--pgo-danger-dk)" }}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {fallo.mensaje}
      </span>
      {fallo.sesion && (
        <Link href="/login" className="pgo-tap-target relative shrink-0 font-semibold underline">
          Iniciar sesión
        </Link>
      )}
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="pgo-tap-target relative inline-flex shrink-0 items-center gap-1.5 font-semibold underline"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  );
}
