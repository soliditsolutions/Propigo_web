"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Trash2, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

type Dispositivo = {
  id:         string;
  nombre:     string;
  ipCreacion: string | null;
  lastSeenAt: string;
  createdAt:  string;
};

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
  const [error,        setError]        = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res  = await fetch("/api/auth/dispositivos");
      const data = await res.json();
      setDispositivos(data.dispositivos ?? []);
    } catch {
      setError("No se pudo cargar la lista de dispositivos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => { cargar(); }); }, [cargar]);

  async function eliminar(id: string) {
    setEliminando(id);
    setError(null);
    try {
      const res  = await fetch(`/api/auth/dispositivos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Error al eliminar."); return; }
      if (data.relogin) { router.push("/login"); return; }
      setDispositivos((prev) => prev.filter((d) => d.id !== id));
    } catch {
      setError("Error de red al eliminar el dispositivo.");
    } finally {
      setEliminando(null);
    }
  }

  async function eliminarTodos() {
    if (!confirm("¿Eliminar todos los dispositivos? Se cerrará tu sesión actual.")) return;
    setEliminando("all");
    setError(null);
    try {
      const res = await fetch("/api/auth/dispositivos", { method: "DELETE" });
      if (!res.ok) { setError("Error al eliminar dispositivos."); return; }
      router.push("/login");
    } catch {
      setError("Error de red.");
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

      {/* Error */}
      {error && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ background: "var(--pgo-danger-lt)", color: "var(--pgo-danger-dk)" }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Lista */}
      {cargando ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--pgo-text-4)" }} />
        </div>
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
