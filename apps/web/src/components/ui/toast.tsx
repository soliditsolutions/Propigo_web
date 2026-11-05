"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOpciones {
  /** Enlace de salida (por ejemplo, "Iniciar sesión"). Un toast con acción no se cierra solo. */
  accion?: { texto: string; href: string };
}

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  accion?: ToastOpciones["accion"];
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, opciones?: ToastOpciones) => void;
}

// ── Contexto ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

// ── Config visual por variante ────────────────────────────────────────────────

const VARIANT: Record<
  ToastType,
  { Icon: React.ElementType; iconColor: string; borderColor: string }
> = {
  success: { Icon: CheckCircle2,  iconColor: "var(--pgo-success)",       borderColor: "var(--pgo-success-bd)"  },
  error:   { Icon: AlertCircle,   iconColor: "var(--pgo-danger)",        borderColor: "var(--pgo-danger-bd)"   },
  warning: { Icon: AlertTriangle, iconColor: "var(--pgo-warning)",       borderColor: "var(--pgo-warning-bd)"  },
  info:    { Icon: Info,          iconColor: "var(--pgo-primary)",       borderColor: "var(--pgo-primary-bd)"  },
};

/**
 * Tiempo visible por tipo. Errores y advertencias duran más porque piden
 * leer y actuar. En todos, el tiempo se detiene mientras el mouse o el foco
 * están sobre el aviso (WCAG 2.2.1, tiempo ajustable).
 */
export const DURACION_MS: Record<ToastType, number> = {
  success: 5000,
  info:    5000,
  warning: 8000,
  error:   10000,
};

// ── Tarjeta individual ────────────────────────────────────────────────────────

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const { Icon, iconColor, borderColor } = VARIANT[item.type];
  const [pausado, setPausado] = useState(false);
  const persistente = Boolean(item.accion);

  // El tiempo restante sobrevive a las pausas: al reanudar sigue donde iba,
  // no vuelve a empezar. `onDismiss` es estable (useCallback en el provider),
  // así que un toast nuevo no reinicia el temporizador de los demás.
  const restanteRef = useRef(DURACION_MS[item.type]);
  useEffect(() => {
    if (persistente || pausado) return;
    const inicio = Date.now();
    const timer = setTimeout(() => onDismiss(item.id), restanteRef.current);
    return () => {
      clearTimeout(timer);
      restanteRef.current = Math.max(0, restanteRef.current - (Date.now() - inicio));
    };
  }, [pausado, persistente, item.id, onDismiss]);

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      aria-live={item.type === "error" ? "assertive" : "polite"}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPausado(false);
      }}
      className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5"
      style={{
        background:  "var(--pgo-surface)",
        border:      `1px solid ${borderColor}`,
        boxShadow:   "var(--pgo-shadow-2)",
        animation:   "pgo-toast-in 0.3s cubic-bezier(0.16,1,0.3,1) both",
        minWidth:    "280px",
        maxWidth:    "380px",
      }}
    >
      <Icon
        className="mt-0.5 h-5 w-5 shrink-0"
        style={{ color: iconColor }}
        aria-hidden="true"
      />
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: "var(--pgo-text-1)" }}>
          {item.message}
        </p>
        {item.accion && (
          <Link
            href={item.accion.href}
            onClick={() => onDismiss(item.id)}
            className="mt-1.5 inline-block text-sm font-semibold underline underline-offset-2"
            style={{ color: "var(--pgo-primary)" }}
          >
            {item.accion.texto}
          </Link>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Cerrar notificación"
        className="pgo-btn pgo-tap-target relative shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: "var(--pgo-text-3)" }}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "info", opciones?: ToastOpciones) => {
    const id = Math.random().toString(36).slice(2, 10);
    setToasts((prev) => {
      // El mismo aviso repetido (doble clic, reintento rápido) no se apila:
      // se reemplaza para que su tiempo vuelva a correr desde cero.
      const resto = prev.filter((t) => !(t.message === message && t.type === type));
      return [...resto, { id, type, message, accion: opciones?.accion }];
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {/* Portal fijo: abajo-centro en mobile, arriba-derecha en sm+ */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4
                   sm:bottom-auto sm:top-4 sm:right-4 sm:left-auto sm:items-end"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full sm:w-auto">
            <ToastCard item={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
