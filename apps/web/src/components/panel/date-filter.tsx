"use client";

import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown, ChevronUp, X } from "lucide-react";

export interface DateFilterState {
  sort: string;
  range: string;
}
export interface DateSortOption  { key: string; label: string }
export interface DateRangeOption { key: string; label: string }

export function DateFilterPanel({
  value,
  onChange,
  sortOptions,
  rangeOptions,
  defaultSort = "",
}: {
  value: DateFilterState;
  onChange: (v: DateFilterState) => void;
  sortOptions: DateSortOption[];
  rangeOptions: DateRangeOption[];
  defaultSort?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasActive =
    value.sort !== (defaultSort || sortOptions[0]?.key) ||
    value.range !== "todos";

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  function reset() {
    onChange({ sort: defaultSort || (sortOptions[0]?.key ?? ""), range: "todos" });
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Filtros de fecha${hasActive ? " (activos)" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="pgo-btn flex h-8 items-center gap-1.5 rounded-[10px] border px-3 text-xs font-semibold"
        style={{
          borderColor:  hasActive ? "var(--pgo-primary)" : "var(--pgo-border)",
          background:   hasActive ? "var(--pgo-primary-lt)" : "var(--pgo-surface)",
          color:        hasActive ? "var(--pgo-primary-dk)" : "var(--pgo-text-3)",
          boxShadow:    open ? `0 0 0 3px var(--pgo-primary-bd)` : "none",
        }}
      >
        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Fecha</span>
        {hasActive && (
          <span
            aria-hidden="true"
            className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
            style={{ background: "var(--pgo-primary)" }}
          >
            ✓
          </span>
        )}
        {open
          ? <ChevronUp  className="h-3.5 w-3.5" aria-hidden="true" />
          : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Opciones de ordenamiento y filtro por fecha"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl bg-[var(--pgo-surface)] p-4"
          style={{ boxShadow: "var(--pgo-shadow-3)", border: "1px solid var(--pgo-border)" }}
        >
          <div className="mb-4">
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--pgo-text-4)" }}
            >
              Ordenar
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Orden">
              {sortOptions.map((s) => {
                const active = value.sort === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ ...value, sort: s.key })}
                    className="pgo-btn rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{
                      background: active ? "var(--pgo-sidebar)" : "var(--pgo-surface-2)",
                      color:      active ? "#fff" : "var(--pgo-text-3)",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p
              className="mb-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--pgo-text-4)" }}
            >
              Filtrar por período
            </p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
              {rangeOptions.map((r) => {
                const active = value.range === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onChange({ ...value, range: r.key })}
                    className="pgo-btn rounded-lg px-3 py-1.5 text-xs font-semibold"
                    style={{
                      background: active ? "var(--pgo-primary)" : "var(--pgo-surface-2)",
                      color:      active ? "#fff" : "var(--pgo-text-3)",
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {hasActive && (
            <button
              type="button"
              onClick={reset}
              className="pgo-btn mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium"
              style={{ color: "var(--pgo-danger)" }}
              aria-label="Limpiar todos los filtros de fecha"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Limpiar filtros de fecha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
