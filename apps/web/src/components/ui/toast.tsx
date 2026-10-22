"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

// ── Tipos ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
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

const AUTO_DISMISS_MS = 5000;

// ── Tarjeta individual ────────────────────────────────────────────────────────

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const { Icon, iconColor, borderColor } = VARIANT[item.type];

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      aria-live={item.type === "error" ? "assertive" : "polite"}
      className="flex w-full items-start gap-3 rounded-2xl px-4 py-3.5"
      style={{
        background:  "var(--pgo-surface)",
        border:      `1px solid ${borderColor}`,
        boxShadow:   "var(--pgo-shadow-2)",
        animation:   "pgo-toast-in 0.3s cubic-bezier(0.16,1,0.3,1) both",
        minWidth:    "280px",
        maxWidth:    "360px",
      }}
    >
      <Icon
        className="mt-0.5 h-5 w-5 shrink-0"
        style={{ color: iconColor }}
        aria-hidden="true"
      />
      <p
        className="flex-1 text-sm font-medium"
        style={{ color: "var(--pgo-text-1)" }}
      >
        {item.message}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="pgo-btn shrink-0 rounded-lg p-0.5 opacity-50 hover:opacity-100 transition-opacity"
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

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2, 10);
    setToasts((prev) => [...prev, { id, type, message }]);
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
            <ToastCard item={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
