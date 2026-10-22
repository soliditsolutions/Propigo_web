"use client";

import { useState, useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Badge, estadoTone, estadoPulse, estadoLabel } from "@/components/panel/ui";
import { FilterToolbar, FilterChip } from "@/components/panel/filter-toolbar";
import { PageSizePicker } from "@/components/panel/page-size-picker";
import { type DateFilterState } from "@/components/panel/date-filter";
import { clp, num, fecha } from "@/lib/format";

type Contrato = {
  id: string;
  estado: string;
  denominacion: string;
  valorArriendo: number;
  diaVencimiento: number;
  comisionCorredorPct: number;
  reajuste: string;
  cobraGastoComun: boolean;
  garantiaMeses: number;
  garantiaMontoCLP: number;
  fechaInicio: Date;
  fechaFin: Date | null;
  propiedad: { direccion: string; comuna: string | null };
  arrendatario: { nombre: string };
  propietario: { nombre: string };
  _count: { periodos: number };
};

type FiltroMon   = "todos" | "UF" | "CLP" | "garantia";
type FiltroEstad = "todos" | "vigente" | "borrador" | "terminado" | "terminado_anticipado";

// Fechas dinámicas
function hoyLocal(): Date { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

const SORT_OPTIONS = [
  { key: "recientes",  label: "Más recientes"     },
  { key: "antiguos",   label: "Más antiguos"      },
  { key: "por_vencer", label: "Por vencer pronto" },
];
const RANGE_OPTIONS = [
  { key: "todos",          label: "Todos"                 },
  { key: "por_vencer_30d", label: "Vencen en 30 días"     },
  { key: "por_vencer_90d", label: "Vencen en 90 días"     },
  { key: "este_ano",       label: "Iniciados este año"    },
  { key: "vencidos",       label: "Vencidos / terminados" },
];

const FILTROS_MON: { key: FiltroMon; label: string }[] = [
  { key: "todos",    label: "Todos"        },
  { key: "UF",       label: "En UF"        },
  { key: "CLP",      label: "En CLP"       },
  { key: "garantia", label: "Con garantía" },
];

const FILTROS_ESTADO: { key: FiltroEstad; label: string; color: string }[] = [
  { key: "todos",               label: "Todos",               color: "var(--pgo-primary-dk)" },
  { key: "vigente",             label: "Vigentes",            color: "var(--pgo-success)" },
  { key: "borrador",            label: "Borradores",          color: "var(--pgo-text-3)" },
  { key: "terminado",           label: "Terminados",          color: "var(--pgo-danger)" },
  { key: "terminado_anticipado",label: "Term. anticipado",    color: "var(--pgo-accent-indigo)" },
];

export function ContratosClient({ contratos }: { contratos: Contrato[] }) {
  const [busqueda, setBusqueda]       = useState("");
  const [filtroMon, setFiltroMon]     = useState<FiltroMon>("todos");
  const [filtroEstad, setFiltroEstad] = useState<FiltroEstad>("todos");
  const [dateFilter, setDateFilter]   = useState<DateFilterState>({ sort: "recientes", range: "todos" });
  const [pageSize, setPageSize]       = useState(25);

  const HOY    = hoyLocal();
  const EN_30D = new Date(HOY); EN_30D.setDate(HOY.getDate() + 30);
  const EN_90D = new Date(HOY); EN_90D.setDate(HOY.getDate() + 90);

  const countsMon = useMemo(() => ({
    todos:    contratos.length,
    UF:       contratos.filter((c) => c.denominacion === "UF").length,
    CLP:      contratos.filter((c) => c.denominacion === "CLP").length,
    garantia: contratos.filter((c) => c.garantiaMeses > 0).length,
  }), [contratos]);

  const countsEst = useMemo(() => ({
    todos:               contratos.length,
    vigente:             contratos.filter((c) => c.estado === "vigente").length,
    borrador:            contratos.filter((c) => c.estado === "borrador").length,
    terminado:           contratos.filter((c) => c.estado === "terminado").length,
    terminado_anticipado:contratos.filter((c) => c.estado === "terminado_anticipado").length,
  }), [contratos]);

  const filtrados = useMemo(() => {
    let r = contratos;
    if (filtroMon   === "UF")       r = r.filter((c) => c.denominacion === "UF");
    if (filtroMon   === "CLP")      r = r.filter((c) => c.denominacion === "CLP");
    if (filtroMon   === "garantia") r = r.filter((c) => c.garantiaMeses > 0);
    if (filtroEstad !== "todos")    r = r.filter((c) => c.estado === filtroEstad);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter((c) =>
        c.arrendatario.nombre.toLowerCase().includes(q) ||
        c.propietario.nombre.toLowerCase().includes(q) ||
        c.propiedad.direccion.toLowerCase().includes(q) ||
        (c.propiedad.comuna?.toLowerCase().includes(q) ?? false)
      );
    }
    return r;
  }, [contratos, filtroMon, filtroEstad, busqueda]);

  const contratosFinales = useMemo(() => {
    const hoy    = hoyLocal();
    const en30d  = new Date(hoy); en30d.setDate(hoy.getDate() + 30);
    const en90d  = new Date(hoy); en90d.setDate(hoy.getDate() + 90);
    const iniAno = new Date(hoy.getFullYear(), 0, 1);

    let r = [...filtrados];
    if (dateFilter.range === "por_vencer_30d") r = r.filter((c) => c.fechaFin && new Date(c.fechaFin) >= hoy && new Date(c.fechaFin) <= en30d);
    if (dateFilter.range === "por_vencer_90d") r = r.filter((c) => c.fechaFin && new Date(c.fechaFin) >= hoy && new Date(c.fechaFin) <= en90d);
    if (dateFilter.range === "este_ano")       r = r.filter((c) => new Date(c.fechaInicio) >= iniAno);
    if (dateFilter.range === "vencidos")       r = r.filter((c) => c.fechaFin && new Date(c.fechaFin) < hoy);

    r.sort((a, b) => {
      if (dateFilter.sort === "por_vencer") {
        const da = a.fechaFin ? new Date(a.fechaFin).getTime() : Infinity;
        const db = b.fechaFin ? new Date(b.fechaFin).getTime() : Infinity;
        return da - db;
      }
      const da = new Date(a.fechaInicio).getTime();
      const db = new Date(b.fechaInicio).getTime();
      return dateFilter.sort === "antiguos" ? da - db : db - da;
    });
    return r;
  }, [filtrados, dateFilter]);

  const pagina = contratosFinales.slice(0, pageSize);
  const hoy    = hoyLocal();

  return (
    <div>
      <FilterToolbar
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sortOptions={SORT_OPTIONS}
        rangeOptions={RANGE_OPTIONS}
        defaultSort="recientes"
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        searchPlaceholder="Buscar por arrendatario, propietario, dirección…"
      >
        {/* Moneda / garantía */}
        {FILTROS_MON.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            count={countsMon[f.key]}
            active={filtroMon === f.key}
            activeColor="var(--pgo-primary-dk)"
            onClick={() => setFiltroMon(f.key)}
          />
        ))}

        {/* Separador */}
        <span className="h-6 w-px self-center" style={{ background: "var(--pgo-border)" }} aria-hidden="true" />

        {/* Estado */}
        {FILTROS_ESTADO.filter((f) => f.key === "todos" || countsEst[f.key] > 0).map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            count={f.key !== "todos" ? countsEst[f.key] : undefined}
            active={filtroEstad === f.key}
            activeColor={f.color}
            onClick={() => setFiltroEstad(f.key)}
          />
        ))}
      </FilterToolbar>

      {/* Mobile (<md): tarjetas apiladas — la tabla de abajo, aunque tiene
          scroll horizontal, corta "Propietario"/"Vigencia"/"Estado" fuera de
          la pantalla sin ninguna pista visual de que hay más contenido al
          costado; a este ancho una tarjeta por contrato se lee de corrido. */}
      <div className="pgo-card space-y-3 p-3 md:hidden">
        {pagina.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[var(--pgo-text-4)]">Sin resultados para los filtros seleccionados.</p>
        ) : pagina.map((c) => {
          const uf = c.denominacion === "UF";
          const diasRestantes = c.fechaFin
            ? Math.floor((new Date(c.fechaFin).getTime() - hoy.getTime()) / 86400000)
            : null;
          return (
            <Link
              key={c.id}
              href={`/panel/contratos/${c.id}`}
              className="pgo-row-hover block rounded-xl p-3.5"
              style={{ border: "1px solid var(--pgo-border)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--pgo-text-1)]">{c.propiedad.direccion}</p>
                  {c.propiedad.comuna && <p className="text-xs text-[var(--pgo-text-4)]">{c.propiedad.comuna}</p>}
                </div>
                <Badge tone={estadoTone(c.estado)} pulse={estadoPulse(c.estado)}>{estadoLabel(c.estado)}</Badge>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <p className="text-[var(--pgo-text-4)]">Arrendatario</p>
                  <p className="text-[var(--pgo-text-2)]">{c.arrendatario.nombre}</p>
                </div>
                <div>
                  <p className="text-[var(--pgo-text-4)]">Propietario</p>
                  <p className="text-[var(--pgo-text-2)]">{c.propietario.nombre}</p>
                </div>
              </div>

              <div className="mt-2.5 flex items-end justify-between gap-2 border-t pt-2.5" style={{ borderColor: "var(--pgo-border)" }}>
                <div>
                  <p className="font-semibold pgo-num" style={{ color: "var(--pgo-text-1)" }}>{uf ? `${num(c.valorArriendo)} UF` : clp(c.valorArriendo)}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: uf ? "var(--pgo-primary-lt)" : "var(--pgo-success-lt)", color: uf ? "var(--pgo-primary-dk)" : "var(--pgo-success-dk)" }}>{c.denominacion}</span>
                    {c.garantiaMeses > 0 && <span title="Tiene garantía"><ShieldCheck className="h-3.5 w-3.5 text-[var(--pgo-primary)]" aria-hidden="true" /></span>}
                  </div>
                </div>
                <div className="text-right text-xs" style={{ color: "var(--pgo-text-3)" }}>
                  <span className="pgo-num">{fecha(c.fechaInicio)}</span>
                  {c.fechaFin && <span className="block pgo-num" style={{ color: "var(--pgo-text-4)" }}>→ {fecha(c.fechaFin)}</span>}
                  {diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 90 && (
                    <span
                      className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: diasRestantes <= 30 ? "var(--pgo-danger-lt)" : "var(--pgo-warning-lt)",
                        color:      diasRestantes <= 30 ? "var(--pgo-danger)"    : "var(--pgo-warning)",
                      }}
                    >
                      {diasRestantes <= 30 ? "⚠ " : ""}Vence en {diasRestantes}d
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-[var(--pgo-text-4)]">
            {pagina.length} de {contratosFinales.length} contrato{contratosFinales.length !== 1 ? "s" : ""}
          </span>
          <PageSizePicker value={pageSize} onChange={setPageSize} />
        </div>
      </div>

      {/* Desktop (≥md): tabla completa */}
      <div className="pgo-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--pgo-border)", background: "var(--pgo-surface-2)" }}>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)]">Propiedad</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)]">Arrendatario</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)]">Propietario</th>
                <th scope="col" className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)]">Renta</th>
                <th scope="col" className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)]">Vence</th>
                <th scope="col" className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)]">Vigencia</th>
                <th scope="col" className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--pgo-text-4)]">Estado</th>
                <th scope="col" className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="pgo-stagger">
              {pagina.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--pgo-text-4)]">Sin resultados para los filtros seleccionados.</td></tr>
              ) : pagina.map((c, i) => {
                const uf = c.denominacion === "UF";
                const diasRestantes = c.fechaFin
                  ? Math.floor((new Date(c.fechaFin).getTime() - hoy.getTime()) / 86400000)
                  : null;
                return (
                  <tr key={c.id} className="pgo-row-hover"
                    style={{ borderBottom: i < pagina.length - 1 ? "1px solid var(--pgo-border)" : "none" }}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[var(--pgo-text-1)]">{c.propiedad.direccion}</p>
                      {c.propiedad.comuna && <p className="text-xs text-[var(--pgo-text-4)]">{c.propiedad.comuna}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-[var(--pgo-text-2)]">{c.arrendatario.nombre}</td>
                    <td className="px-5 py-3.5 text-sm text-[var(--pgo-text-3)]">{c.propietario.nombre}</td>
                    <td className="px-5 py-3.5 text-right">
                      <p className="font-semibold pgo-num" style={{ color: "var(--pgo-text-1)" }}>{uf ? `${num(c.valorArriendo)} UF` : clp(c.valorArriendo)}</p>
                      <div className="mt-0.5 flex items-center justify-end gap-1.5">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: uf ? "var(--pgo-primary-lt)" : "var(--pgo-success-lt)", color: uf ? "var(--pgo-primary-dk)" : "var(--pgo-success-dk)" }}>{c.denominacion}</span>
                        {c.garantiaMeses > 0 && <span title="Tiene garantía"><ShieldCheck className="h-3.5 w-3.5 text-[var(--pgo-primary)]" aria-hidden="true" /></span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center text-[var(--pgo-text-3)] text-sm">día {c.diaVencimiento}</td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap" style={{ color: "var(--pgo-text-3)" }}>
                      <span className="pgo-num">{fecha(c.fechaInicio)}</span>
                      {c.fechaFin && (
                        <span className="block pgo-num" style={{ color: "var(--pgo-text-4)" }}>→ {fecha(c.fechaFin)}</span>
                      )}
                      {diasRestantes !== null && diasRestantes > 0 && diasRestantes <= 90 && (
                        <span
                          className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: diasRestantes <= 30 ? "var(--pgo-danger-lt)" : "var(--pgo-warning-lt)",
                            color:      diasRestantes <= 30 ? "var(--pgo-danger)"    : "var(--pgo-warning)",
                          }}
                        >
                          {diasRestantes <= 30 ? "⚠ " : ""}Vence en {diasRestantes}d
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center"><Badge tone={estadoTone(c.estado)} pulse={estadoPulse(c.estado)}>{estadoLabel(c.estado)}</Badge></td>
                    <td className="px-5 py-3.5">
                      <Link href={`/panel/contratos/${c.id}`} className="whitespace-nowrap text-xs font-semibold text-[var(--pgo-primary)] hover:text-[var(--pgo-primary-dk)] transition-colors">Ver →</Link>
                    </td>
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
            {pagina.length} de {contratosFinales.length} contrato{contratosFinales.length !== 1 ? "s" : ""}
          </span>
          <PageSizePicker value={pageSize} onChange={setPageSize} />
        </div>
      </div>
    </div>
  );
}
