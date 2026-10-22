"use client";

import { useState, useMemo } from "react";
import { Badge, estadoTone, estadoPulse, estadoLabel } from "@/components/panel/ui";
import { FilterToolbar, FilterChip } from "@/components/panel/filter-toolbar";
import { PageSizePicker } from "@/components/panel/page-size-picker";
import { type DateFilterState } from "@/components/panel/date-filter";
import { clp, num, fecha } from "@/lib/format";

type Periodo = {
  id: string;
  fechaVencimiento: Date;
  montoBase: number;
  montoGastoComun: number;
  estado: string;
  contrato: {
    denominacion: string;
    arrendatario: { nombre: string };
    propiedad: { direccion: string; comuna: string | null };
  };
};

type Filtro = "todos" | "atrasado" | "pendiente" | "semana";

function hoyUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

const SORT_OPTIONS = [
  { key: "proximos", label: "Más próximos" },
  { key: "lejanos",  label: "Más lejanos"  },
];
const RANGE_OPTIONS = [
  { key: "todos",        label: "Todos"           },
  { key: "vencidos",     label: "Vencidos"        },
  { key: "esta_semana",  label: "Esta semana"     },
  { key: "este_mes",     label: "Este mes"        },
  { key: "proximos_30d", label: "Próximos 30 días"},
];

const FILTROS: { key: Filtro; label: string; color?: string }[] = [
  { key: "todos",    label: "Todos" },
  { key: "atrasado", label: "Atrasados",   color: "var(--pgo-danger)" },
  { key: "pendiente",label: "Pendientes",  color: "var(--pgo-warning)" },
  { key: "semana",   label: "Esta semana", color: "var(--pgo-primary)" },
];

export function ProximosClient({ periodos }: { periodos: Periodo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro]     = useState<Filtro>("todos");
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ sort: "proximos", range: "todos" });
  const [pageSize, setPageSize] = useState(25);

  const HOY       = hoyUTC();
  const EN_SEMANA = new Date(HOY.getTime() + 7  * 86400000);

  const counts = useMemo(() => ({
    todos:    periodos.length,
    atrasado: periodos.filter((p) => p.estado === "atrasado").length,
    pendiente:periodos.filter((p) => p.estado === "pendiente").length,
    semana:   periodos.filter((p) => {
      const f = new Date(p.fechaVencimiento);
      return f >= HOY && f <= EN_SEMANA;
    }).length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [periodos]);

  const filtrados = useMemo(() => {
    const hoy       = hoyUTC();
    const enSemana  = new Date(hoy.getTime() + 7 * 86400000);
    let r = periodos;
    if (filtro === "atrasado")  r = r.filter((p) => p.estado === "atrasado");
    if (filtro === "pendiente") r = r.filter((p) => p.estado === "pendiente");
    if (filtro === "semana")    r = r.filter((p) => {
      const f = new Date(p.fechaVencimiento);
      return f >= hoy && f <= enSemana;
    });
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter((p) =>
        p.contrato.arrendatario.nombre.toLowerCase().includes(q) ||
        p.contrato.propiedad.direccion.toLowerCase().includes(q) ||
        (p.contrato.propiedad.comuna?.toLowerCase().includes(q) ?? false)
      );
    }
    return r;
  }, [periodos, filtro, busqueda]);

  const periodosFinales = useMemo(() => {
    const hoy      = hoyUTC();
    const enSemana = new Date(hoy.getTime() + 7  * 86400000);
    const iniMes   = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const finMes   = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
    const en30d    = new Date(hoy.getTime() + 30 * 86400000);

    let r = [...filtrados];
    if (dateFilter.range === "vencidos")     r = r.filter((p) => new Date(p.fechaVencimiento) < hoy);
    if (dateFilter.range === "esta_semana")  r = r.filter((p) => { const f = new Date(p.fechaVencimiento); return f >= hoy && f <= enSemana; });
    if (dateFilter.range === "este_mes")     r = r.filter((p) => { const f = new Date(p.fechaVencimiento); return f >= iniMes && f <= finMes; });
    if (dateFilter.range === "proximos_30d") r = r.filter((p) => { const f = new Date(p.fechaVencimiento); return f >= hoy && f <= en30d; });

    r.sort((a, b) => {
      const da = new Date(a.fechaVencimiento).getTime();
      const db = new Date(b.fechaVencimiento).getTime();
      return dateFilter.sort === "lejanos" ? db - da : da - db;
    });
    return r;
  }, [filtrados, dateFilter]);

  const pagina = periodosFinales.slice(0, pageSize);

  return (
    <div>
      <FilterToolbar
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sortOptions={SORT_OPTIONS}
        rangeOptions={RANGE_OPTIONS}
        defaultSort="proximos"
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        searchPlaceholder="Buscar arrendatario o propiedad…"
      >
        {FILTROS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            count={counts[f.key]}
            active={filtro === f.key}
            activeColor={f.color ?? "var(--pgo-primary-dk)"}
            onClick={() => setFiltro(f.key)}
          />
        ))}
      </FilterToolbar>

      <div className="pgo-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--pgo-border)", background: "var(--pgo-surface-2)" }}>
                {["Vence","Arrendatario","Propiedad","Monto","Estado"].map((h, i) => (
                  <th key={h} scope="col" className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)] ${i === 3 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="pgo-stagger">
              {pagina.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-[var(--pgo-text-4)]">Sin resultados para los filtros seleccionados.</td></tr>
              ) : pagina.map((p, i) => {
                const uf = p.contrato.denominacion === "UF";
                const arriendo = uf ? `${num(p.montoBase)} UF` : clp(p.montoBase);
                const atrasado = p.estado === "atrasado";
                return (
                  <tr key={p.id} className="pgo-row-hover"
                    style={{ borderBottom: i < pagina.length - 1 ? "1px solid var(--pgo-border)" : "none", background: atrasado ? "rgba(239,68,68,0.03)" : undefined }}>
                    <td className="px-5 py-3.5 whitespace-nowrap pgo-num" style={{ color: "var(--pgo-text-3)" }}>{fecha(p.fechaVencimiento)}</td>
                    <td className="px-5 py-3.5 font-medium text-[var(--pgo-text-1)]">{p.contrato.arrendatario.nombre}</td>
                    <td className="px-5 py-3.5 text-xs text-[var(--pgo-text-3)]">{p.contrato.propiedad.direccion}{p.contrato.propiedad.comuna ? `, ${p.contrato.propiedad.comuna}` : ""}</td>
                    <td className="px-5 py-3.5 text-right font-semibold pgo-num" style={{ color: "var(--pgo-text-1)" }}>
                      {arriendo}
                      {p.montoGastoComun > 0 && <span className="block text-xs font-normal text-[var(--pgo-text-4)]">+ GC {clp(p.montoGastoComun)}</span>}
                    </td>
                    <td className="px-5 py-3.5"><Badge tone={estadoTone(p.estado)} pulse={estadoPulse(p.estado)}>{estadoLabel(p.estado)}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5"
          style={{ borderTop: "1px solid var(--pgo-border)", background: "var(--pgo-surface-2)" }}
        >
          <span className="text-xs text-[var(--pgo-text-4)]">
            {pagina.length} de {periodosFinales.length} resultado{periodosFinales.length !== 1 ? "s" : ""}
          </span>
          <PageSizePicker value={pageSize} onChange={setPageSize} />
        </div>
      </div>
    </div>
  );
}
