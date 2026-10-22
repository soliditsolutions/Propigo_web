"use client";

import { useState, useMemo } from "react";
import { Calendar, ChevronDown, ChevronUp } from "lucide-react";

interface Periodo {
  id:               string;
  numero:           number;
  fechaVencimiento: string;
  fechaPagoReal:    string | null;
  estado:           string;
  montoBase:        string | number;
}

interface Props {
  periodos:     Periodo[];
  denominacion: string;
  valorArriendo: string | number;
}

const ESTADO: Record<string, { label: string; color: string }> = {
  pendiente:   { label: "Pendiente",   color: "var(--pgo-warning)" },
  atrasado:    { label: "Atrasado",    color: "var(--pgo-danger)" },
  pagado:      { label: "Pagado",      color: "var(--pgo-primary)" },
  liquidado:   { label: "Liquidado",   color: "var(--pgo-success)" },
  en_revision: { label: "En revisión", color: "var(--pgo-accent-indigo)" },
  cancelado:   { label: "Cancelado",   color: "var(--pgo-text-4)" },
};

function clp(n: number | string): string {
  return Number(n).toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });
}

function uf(n: number | string): string {
  return `UF ${Number(n).toLocaleString("es-CL", { minimumFractionDigits: 2 })}`;
}

function fecha(d: string): string {
  return new Date(d).toLocaleDateString("es-CL", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" });
}

function fechaCorta(d: string): string {
  return new Date(d).toLocaleDateString("es-CL", { timeZone: "UTC", day: "2-digit", month: "short" });
}

export function PagosSection({ periodos, denominacion }: Props) {
  // Agrupar por año (año del fechaVencimiento), ASCENDENTE: el arrendatario
  // lee su historial como una línea de tiempo — el primer período del
  // contrato arriba y los siguientes debajo, igual que una cartola.
  const años = useMemo(() => {
    const set = new Set<number>();
    periodos.forEach(p => set.add(new Date(p.fechaVencimiento).getUTCFullYear()));
    return Array.from(set).sort((a, b) => a - b);
  }, [periodos]);

  const estaSaldado = (p: Periodo) => p.estado === "pagado" || p.estado === "liquidado";

  // Año que se abre por defecto: el más antiguo que TODAVÍA tiene algo
  // pendiente, no el más nuevo ni el primero a secas. Lo que necesita acción
  // es lo que hay que mostrar primero; si está todo saldado, cae al último
  // año (el estado más reciente del contrato).
  const añoInicial = useMemo(() => {
    const conPendientes = años.filter(a =>
      periodos.some(p => new Date(p.fechaVencimiento).getUTCFullYear() === a && !estaSaldado(p)),
    );
    return conPendientes[0] ?? años[años.length - 1] ?? new Date().getFullYear();
  }, [años, periodos]);

  const [añoActivo, setAñoActivo] = useState<number>(añoInicial);
  const [mostrarSelector, setMostrarSelector] = useState(false);

  const periodosAño = useMemo(
    () => periodos.filter(p => new Date(p.fechaVencimiento).getUTCFullYear() === añoActivo)
                  .sort((a, b) => a.numero - b.numero),
    [periodos, añoActivo],
  );

  // Resumen del año activo
  const resumen = useMemo(() => {
    const pagados  = periodosAño.filter(estaSaldado).length;
    const atrasados = periodosAño.filter(p => p.estado === "atrasado").length;
    return { pagados, atrasados, total: periodosAño.length };
  }, [periodosAño]);

  if (periodos.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)", boxShadow: "var(--pgo-shadow)" }}
    >
      {/* Header con selector de año */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--pgo-border)" }}
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>
          <Calendar className="h-4 w-4" aria-hidden />
          Mis pagos
        </h2>

        {/* Resumen rápido */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs">
            {resumen.pagados > 0 && (
              <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: "var(--pgo-success-lt)", color: "var(--pgo-success)" }}>
                {resumen.pagados} pagado{resumen.pagados !== 1 ? "s" : ""}
              </span>
            )}
            {resumen.atrasados > 0 && (
              <span className="rounded-full px-2 py-0.5 font-medium" style={{ background: "var(--pgo-danger-lt)", color: "var(--pgo-danger)" }}>
                {resumen.atrasados} atrasado{resumen.atrasados !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Selector de año — solo visible si hay más de un año */}
          {años.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setMostrarSelector(v => !v)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: "var(--pgo-surface-2)", color: "var(--pgo-text-2)", border: "1px solid var(--pgo-border)" }}
                aria-expanded={mostrarSelector}
              >
                {añoActivo}
                {mostrarSelector
                  ? <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                  : <ChevronDown className="h-3.5 w-3.5" aria-hidden />}
              </button>

              {mostrarSelector && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden"
                  style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)", boxShadow: "0 8px 24px rgba(15,31,53,0.12)", minWidth: "120px" }}
                >
                  {años.map(a => (
                    <button
                      key={a}
                      onClick={() => { setAñoActivo(a); setMostrarSelector(false); }}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-[var(--pf-surface)]"
                      style={{
                        color:      a === añoActivo ? "var(--pgo-primary)" : "var(--pgo-text-2)",
                        fontWeight: a === añoActivo ? 700 : 400,
                      }}
                    >
                      {a}
                      {a === añoActivo && <span style={{ color: "var(--pgo-primary)" }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de períodos */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--pgo-surface-2)", borderBottom: "1px solid var(--pgo-border)" }}>
              <th scope="col" className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>Período</th>
              <th scope="col" className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>Vencimiento</th>
              <th scope="col" className="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>Monto</th>
              <th scope="col" className="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>Estado</th>
              <th scope="col" className="hidden sm:table-cell px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>Pagado</th>
            </tr>
          </thead>
          <tbody>
            {periodosAño.map((per, i) => {
              const est = ESTADO[per.estado] ?? { label: per.estado, color: "var(--pgo-text-4)" };
              return (
                <tr
                  key={per.id}
                  className="transition-colors hover:bg-[var(--pf-surface)]"
                  style={{ borderBottom: i < periodosAño.length - 1 ? "1px solid var(--pgo-border)" : "none" }}
                >
                  <td className="px-5 py-3 font-medium tabular-nums" style={{ color: "var(--pgo-text-1)" }}>
                    #{per.numero}
                  </td>
                  <td className="px-5 py-3 text-sm" style={{ color: "var(--pgo-text-3)" }}>
                    <span className="hidden sm:inline">{fecha(per.fechaVencimiento)}</span>
                    <span className="sm:hidden">{fechaCorta(per.fechaVencimiento)}</span>
                  </td>
                  <td className="px-5 py-3 text-right pgo-num text-sm font-medium" style={{ color: "var(--pgo-text-1)" }}>
                    {denominacion === "UF" ? uf(per.montoBase) : clp(per.montoBase)}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ background: `${est.color}18`, color: est.color }}
                    >
                      {est.label}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-5 py-3 text-sm" style={{ color: "var(--pgo-text-4)" }}>
                    {per.fechaPagoReal ? fechaCorta(per.fechaPagoReal) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pie: hint si hay más años */}
      {años.length > 1 && (
        <div
          className="px-5 py-3 text-xs text-center"
          style={{ borderTop: "1px solid var(--pgo-border)", color: "var(--pgo-text-4)" }}
        >
          Mostrando {periodosAño.length} período{periodosAño.length !== 1 ? "s" : ""} de {añoActivo}.
          {" "}Usa el selector para ver años anteriores.
        </div>
      )}
    </div>
  );
}
