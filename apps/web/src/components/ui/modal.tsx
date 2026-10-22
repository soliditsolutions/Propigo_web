"use client";

import { createPortal } from "react-dom";
import { X, CheckCircle2 } from "lucide-react";

/* ── Estilos de input compartidos por los formularios de modales ── */
export const modalInputCls =
  "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--pf-brand)] focus:shadow-[0_0_0_3px_var(--pf-brand-tint)]";

export function modalInputStyle(hasError: boolean): React.CSSProperties {
  return {
    borderColor: hasError ? "var(--pgo-danger)" : "var(--pf-border-input)",
    background:  "var(--pf-surface)",
    color:       "var(--pf-navy)",
  };
}

/* ── Shell de modal: overlay + panel + header con cierre ── */
interface ModalProps {
  onClose:   () => void;
  title:     string;
  subtitle?: string;
  icon?:     React.ReactNode;
  maxWidth?: "md" | "lg" | "xl";
  children:  React.ReactNode;
}

/* El ancho ESCALA con el viewport en vez de quedar clavado en un solo tope.
   Antes todo se cortaba en 448/512px: en mobile está bien (es una hoja a
   ancho completo), pero en un monitor de 1500px dejaba una columna angosta
   con el texto legal partido en decenas de líneas y scroll interno
   innecesario, rodeada de espacio vacío. Cada peldaño sube un escalón de la
   escala de Tailwind al ganar viewport, siempre acotado por `92vh` de alto
   y por el padding del overlay a los costados. */
const MAX_WIDTH_CLASSES: Record<"md" | "lg" | "xl", string> = {
  md: "sm:max-w-md lg:max-w-lg",
  lg: "sm:max-w-lg lg:max-w-2xl xl:max-w-3xl",
  xl: "sm:max-w-xl lg:max-w-3xl xl:max-w-5xl",
};

export function Modal({ onClose, title, subtitle, icon, maxWidth = "lg", children }: ModalProps) {
  // Portal a document.body: si el Modal se abre desde un ancestro con
  // `transform` inline (p. ej. las paradas del escenario walkthrough del
  // home, animadas con translateY/opacity), ese ancestro se vuelve el
  // "containing block" de cualquier `position: fixed` descendiente — el
  // modal deja de posicionarse contra el viewport y su z-index queda
  // atrapado dentro del stacking context del ancestro, por debajo de
  // hermanos con z-index propio más arriba en el árbol (como el navbar
  // `sticky`). Resultado real observado: el botón de cerrar quedaba
  // clickeable-cero, tapado por el navbar. Con el portal, el modal es
  // hijo directo de <body> y queda inmune a cualquier ancestro futuro.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(10,37,64,0.45)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full ${MAX_WIDTH_CLASSES[maxWidth]} rounded-t-3xl sm:rounded-2xl overflow-hidden`}
        style={{ background: "var(--pf-surface)", boxShadow: "0 24px 60px rgba(10,37,64,0.2)", maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-6 py-4"
          style={{ background: "var(--pf-surface)", borderBottom: "1px solid var(--pf-border)", zIndex: 1 }}
        >
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <h2 className="text-base font-bold" style={{ color: "var(--pf-navy)" }}>{title}</h2>
              {subtitle && (
                <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "var(--pf-text-muted)" }}>{subtitle}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 transition-colors hover:bg-[var(--pf-hero-1)]" aria-label="Cerrar">
            <X className="h-4 w-4" style={{ color: "var(--pf-text-light)" }} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ── Pantalla de éxito reutilizable ── */
interface ModalSuccessProps {
  tone?:        "green" | "amber";
  title:        string;
  message:      string;
  extra?:       React.ReactNode;
  onClose:      () => void;
  closeLabel?:  string;
}

export function ModalSuccess({ tone = "green", title, message, extra, onClose, closeLabel = "Cerrar" }: ModalSuccessProps) {
  const bg    = tone === "amber" ? "var(--pgo-warning-lt)" : "var(--pgo-success-lt)";
  const color = tone === "amber" ? "var(--pgo-warning)" : "var(--pgo-success)";
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: bg }}>
        <CheckCircle2 className="h-7 w-7" style={{ color }} />
      </div>
      <div>
        <p className="text-lg font-bold" style={{ color: "var(--pf-navy)" }}>{title}</p>
        <p className="mt-1 text-sm" style={{ color: "var(--pf-text-body)" }}>{message}</p>
      </div>
      {extra}
      <button onClick={onClose} className="w-full pf-btn-secondary" style={{ padding: "10px 16px", fontSize: "13px", borderRadius: "10px" }}>
        {closeLabel}
      </button>
    </div>
  );
}
