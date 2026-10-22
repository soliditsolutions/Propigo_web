"use client";

import { Search, X } from "lucide-react";
import {
  DateFilterPanel,
  type DateFilterState,
  type DateSortOption,
  type DateRangeOption,
} from "@/components/panel/date-filter";

/**
 * Chip de filtro estandarizado — 32px para alineación perfecta.
 * Gradiente en estado activo para profundidad visual.
 */
export function FilterChip({
  label,
  count,
  active,
  activeColor = "var(--pgo-primary-dk)",
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  activeColor?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="pgo-chip"
      style={
        active
          ? {
              background: `linear-gradient(150deg, ${activeColor} 0%, color-mix(in srgb, ${activeColor} 72%, #050e1d) 100%)`,
              color: "white",
              border: "1px solid transparent",
              boxShadow: `0 2px 8px color-mix(in srgb, ${activeColor} 45%, transparent), 0 1px 2px rgba(0,0,0,0.20)`,
              transform: "translateY(-0.5px)",
            }
          : {
              background: "var(--pgo-surface)",
              color: "var(--pgo-text-2)",
              border: "1px solid var(--pgo-border-2)",
              boxShadow: "var(--pgo-input-shadow)",
            }
      }
    >
      {label}
      {count !== undefined && (
        <span
          className="pgo-chip-count"
          style={{
            background: active
              ? "rgba(255,255,255,0.22)"
              : "rgba(100,116,139,0.12)",
            color: active ? "rgba(255,255,255,0.9)" : "var(--pgo-text-3)",
            fontWeight: 700,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Barra de filtros unificada del panel.
 *
 * Layout de 2 filas:
 *   Fila 1 (top): [búsqueda flex-1] ··· [dateFilter] [rightActions]
 *   Fila 2 (mid): [children chips flex-wrap]
 *
 * - La búsqueda queda siempre top-left.
 * - Los chips predefinidos van en la fila del medio.
 * - Fecha y acciones van top-right, por lo que el dropdown de fecha
 *   nunca choca con el sidebar (se abre hacia la izquierda, con espacio).
 */
export function FilterToolbar({
  dateFilter,
  onDateFilterChange,
  sortOptions,
  rangeOptions,
  defaultSort,
  children,
  busqueda,
  onBusquedaChange,
  searchPlaceholder = "Buscar…",
  rightActions,
}: {
  dateFilter?: DateFilterState;
  onDateFilterChange?: (v: DateFilterState) => void;
  sortOptions?: DateSortOption[];
  rangeOptions?: DateRangeOption[];
  defaultSort?: string;
  children?: React.ReactNode;
  busqueda?: string;
  onBusquedaChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** Slot para botones de acción (ej: "Nueva propiedad") — se ubican top-right junto al filtro de fecha. */
  rightActions?: React.ReactNode;
}) {
  const tieneFecha    = dateFilter && onDateFilterChange && sortOptions && rangeOptions;
  const tieneBusqueda = busqueda !== undefined && onBusquedaChange;
  const tieneTopBar   = tieneBusqueda || tieneFecha || !!rightActions;

  return (
    <div className="mb-5 space-y-2">
      {/* ── Fila superior: búsqueda (izq) + fecha + acciones (der) ── */}
      {tieneTopBar && (
        <div className="flex items-center gap-2">
          {/* Búsqueda ocupa el espacio restante a la izquierda */}
          <div className="flex-1 min-w-0">
            {tieneBusqueda && (
              <div className="relative pgo-input-search-wrap">
                <Search
                  className="pgo-search-icon absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  placeholder={searchPlaceholder}
                  value={busqueda}
                  onChange={(e) => onBusquedaChange(e.target.value)}
                  className="pgo-input-search"
                  aria-label={searchPlaceholder}
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => onBusquedaChange("")}
                    aria-label="Limpiar búsqueda"
                    className="pgo-btn absolute right-3 top-1/2 -translate-y-1/2 rounded"
                    style={{ color: "var(--pgo-text-4)" }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Fecha + acciones siempre al extremo derecho */}
          {(tieneFecha || !!rightActions) && (
            <div className="flex shrink-0 items-center gap-2">
              {tieneFecha && (
                <DateFilterPanel
                  value={dateFilter}
                  onChange={onDateFilterChange}
                  sortOptions={sortOptions}
                  rangeOptions={rangeOptions}
                  defaultSort={defaultSort}
                />
              )}
              {rightActions}
            </div>
          )}
        </div>
      )}

      {/* ── Fila media: chips predefinidos ── */}
      {children && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {children}
        </div>
      )}
    </div>
  );
}
