"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { FilterToolbar, FilterChip } from "@/components/panel/filter-toolbar";
import { PageSizePicker } from "@/components/panel/page-size-picker";
import { type DateFilterState } from "@/components/panel/date-filter";
import { Badge, estadoTone, estadoPulse, Tabs } from "@/components/panel/ui";
import { clp, num, fecha } from "@/lib/format";
import { calcularMora, diasEntre } from "@propigo/core";
import type { PeriodoPendiente } from "@/lib/queries";
import { simularPago, cerrarLiquidacion, type AjusteForm } from "./actions";
import { MARCA } from "@/lib/marca";

type AjusteLocal = AjusteForm & { tempId: string };

// Fechas dinámicas
function hoyUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}
function iniMesUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
}
function finMesUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 0));
}
function iniMesAnteriorUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1));
}
function finMesAnteriorUTC(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0));
}
function hace90DiasUTC(): Date {
  return new Date(hoyUTC().getTime() - 90 * 86400000);
}

export function CobrosClient({ periodos }: { periodos: PeriodoPendiente[] }) {
  const { show: toast }               = useToast();
  const [activoId, setActivoId]       = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();
  const [ajustesForm, setAjustesForm] = useState<AjusteLocal[]>([]);
  const [pageSize, setPageSize]       = useState(25);
  // mismatch vive en CobrosClient (no en Paso1Form) para sobrevivir re-renders de la closure
  const [mismatch, setMismatch]       = useState<{ diferencia: number; totalEsperado: number } | null>(null);

  const atrasados = periodos.filter((p) => p.estado === "atrasado");
  const porCerrar = periodos.filter((p) => p.estado === "pagado");

  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl   = searchParams.get("tab") ?? (atrasados.length > 0 ? "paso1" : "paso2");

  const [tab, _setTab]            = useState<string>(tabFromUrl);
  const [busqueda, setBusqueda]   = useState("");
  const [subFiltro, setSubFiltro] = useState("todos");
  const [dateFilter, setDateFilter] = useState<DateFilterState>({ sort: "urgentes", range: "todos" });

  const setTab = useCallback((newTab: string) => {
    _setTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const periodosMostrados = tab === "paso1" ? atrasados : porCerrar;

  const HOY = hoyUTC();

  const periodosFiltrados = useMemo(() => {
    const hoy = hoyUTC();
    let r = periodosMostrados;
    if (subFiltro === "alta_mora") {
      r = r.filter((p) => {
        const dias = Math.max(0, Math.floor((hoy.getTime() - new Date(p.fechaVencimiento).getTime()) / 86400000) - p.moraDiasGracia);
        return dias > 30;
      });
    } else if (subFiltro === "con_gc")     r = r.filter((p) => p.montoGastoComun > 0);
    else if   (subFiltro === "UF")         r = r.filter((p) => p.contrato.denominacion === "UF");
    else if   (subFiltro === "CLP")        r = r.filter((p) => p.contrato.denominacion === "CLP");
    else if   (subFiltro === "con_ajustes")r = r.filter((p) => p.ajustes.length > 0);

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter((p) =>
        p.contrato.arrendatario.nombre.toLowerCase().includes(q) ||
        p.contrato.propiedad.direccion.toLowerCase().includes(q) ||
        (p.contrato.propiedad.comuna?.toLowerCase().includes(q) ?? false)
      );
    }
    return r;
  }, [periodosMostrados, subFiltro, busqueda]);

  const periodosFinales = useMemo(() => {
    const iniMes  = iniMesUTC();
    const finMes  = finMesUTC();
    const iniMesA = iniMesAnteriorUTC();
    const finMesA = finMesAnteriorUTC();
    const h90     = hace90DiasUTC();

    let r = [...periodosFiltrados];
    if (dateFilter.range === "este_mes")     r = r.filter((p) => { const f = new Date(p.fechaVencimiento); return f >= iniMes && f <= finMes; });
    if (dateFilter.range === "mes_anterior") r = r.filter((p) => { const f = new Date(p.fechaVencimiento); return f >= iniMesA && f <= finMesA; });
    if (dateFilter.range === "ultimos_3m")   r = r.filter((p) => new Date(p.fechaVencimiento) >= h90);

    r.sort((a, b) => {
      const da = new Date(a.fechaVencimiento).getTime();
      const db = new Date(b.fechaVencimiento).getTime();
      return dateFilter.sort === "recientes" ? db - da : da - db;
    });
    return r;
  }, [periodosFiltrados, dateFilter]);

  const pagina = periodosFinales.slice(0, pageSize);

  function toggle(id: string) {
    setActivoId(prev => prev === id ? null : id);
    setAjustesForm([]);
    setMismatch(null);
  }

  // ─── Paso 1 ─────────────────────────────────────────────────────────────
  function Paso1Form({ p }: { p: PeriodoPendiente }) {
    const hoy = hoyUTC();
    const fechaISOHoy = hoy.toISOString().slice(0, 10);
    const [fechaStr, setFechaStr] = useState(p.fechaVencimiento.toISOString().slice(0, 10));
    // montoManual: null = seguir al totalEsperado; string = valor ingresado por el corredor
    const [montoManual, setMontoManual] = useState<string | null>(null);
    // mismatch y setMismatch vienen del scope de CobrosClient (estado elevado)

    const fechaPago = new Date(fechaStr + "T00:00:00Z");
    const { diasAtraso, interesCLP } = calcularMora(
      p.arriendoCLP, p.fechaVencimiento, fechaPago, p.moraTasaPct, p.moraDiasGracia,
    );
    const totalEsperado = p.arriendoCLP + p.montoGastoComun + interesCLP;
    // El monto sigue automáticamente al totalEsperado hasta que el corredor escribe algo distinto.
    // Cambiar la fecha resetea el valor para que refleje la nueva mora calculada.
    const montoStr = montoManual ?? String(totalEsperado);

    function handleFechaChange(val: string) {
      setFechaStr(val);
      setMontoManual(null); // recalcular monto al cambiar fecha
      setMismatch(null);
    }

    async function confirmarPago(forzar: boolean) {
      const monto = Number(montoStr.replace(/\D/g, ""));
      startTransition(async () => {
        const r = await simularPago(p.id, fechaStr, monto, forzar);
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        if (r.estado === "conciliado") {
          toast(
            `Pago confirmado.${r.interesCLP > 0 ? ` Mora: ${clp(r.interesCLP)} (${r.diasAtraso} días).` : " Sin mora."}`,
            "success",
          );
          setActivoId(null);
          setMismatch(null);
        } else {
          // No calzó — mostrar panel de diferencia en lugar de cerrar
          setMismatch({ diferencia: r.diferencia, totalEsperado: r.totalEsperado });
        }
      });
    }

    async function onSubmit(e: React.FormEvent) {
      e.preventDefault();
      setMismatch(null);
      await confirmarPago(false);
    }

    return (
      <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-[var(--pgo-border)] pt-4">
        <div className="rounded-xl bg-[var(--pgo-primary-lt)] border border-[var(--pgo-primary-bd)] px-4 py-3 text-sm text-[var(--pgo-primary-dk)]">
          <span className="font-semibold">Fecha real del pago</span> — {MARCA} usa esta fecha
          para calcular si hay mora, <em>no la de hoy ni la de liquidación</em>. Eso elimina los
          intereses fantasma.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[var(--pgo-text-3)] mb-1">Fecha real del pago</label>
            <input type="date" name="fecha_pago_real" autoComplete="off"
              value={fechaStr} onChange={(e) => handleFechaChange(e.target.value)}
              max={fechaISOHoy}
              className="w-full rounded-lg border px-3 py-2 text-sm pgo-num focus:outline-none focus:ring-2 focus:ring-[var(--pgo-primary-bd)]"
              style={{ borderColor: "var(--pgo-border)" }}
              aria-label="Fecha real en que el arrendatario realizó el pago" />
            {diasAtraso > 0 && <p className="mt-1 text-xs text-[var(--pgo-danger)]">{diasAtraso} días de atraso efectivos</p>}
            {diasAtraso === 0 && diasEntre(p.fechaVencimiento, fechaPago) > 0 && (
              <p className="mt-1 text-xs text-[var(--pgo-success)]">Dentro del período de gracia</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--pgo-text-3)] mb-1">Monto recibido (CLP)</label>
            <input type="text" inputMode="decimal" name="monto_recibido" autoComplete="off"
              value={montoStr} onChange={(e) => { setMontoManual(e.target.value); setMismatch(null); }}
              className="w-full rounded-lg border px-3 py-2 text-sm pgo-num focus:outline-none focus:ring-2"
              style={{ borderColor: "var(--pgo-border)" }}
              aria-label="Monto recibido en pesos chilenos" />
          </div>
        </div>

        <div className="rounded-xl bg-[var(--pgo-surface-2)] p-4 text-sm space-y-1">
          <div className="flex justify-between text-[var(--pgo-text-2)]"><span>Arriendo</span><span>{clp(p.arriendoCLP)}</span></div>
          {p.montoGastoComun > 0 && <div className="flex justify-between text-[var(--pgo-text-2)]"><span>Gasto común</span><span>{clp(p.montoGastoComun)}</span></div>}
          {interesCLP > 0 && <div className="flex justify-between text-[var(--pgo-danger)] font-medium"><span>Interés por mora ({diasAtraso} días)</span><span>+ {clp(interesCLP)}</span></div>}
          <div className="flex justify-between font-semibold text-[var(--pgo-text-1)] border-t border-[var(--pgo-border-2)] pt-1"><span>Total esperado</span><span>{clp(totalEsperado)}</span></div>
        </div>

        {/* Panel de diferencia — aparece cuando el monto no calza */}
        {mismatch && (
          <div className="rounded-xl border-2 border-[var(--pgo-warning-bd)] bg-[var(--pgo-warning-lt)] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg" aria-hidden="true">⚠️</span>
              <div className="space-y-1">
                <p className="font-semibold text-[var(--pgo-warning-dk)] text-sm">El monto no calza exactamente</p>
                <p className="text-xs text-[var(--pgo-warning-dk)]">
                  Esperado: <strong>{clp(mismatch.totalEsperado)}</strong> —{" "}
                  {mismatch.diferencia > 0
                    ? <>Pagó <strong>{clp(mismatch.diferencia)}</strong> de más</>
                    : <>Faltan <strong>{clp(Math.abs(mismatch.diferencia))}</strong></>}
                </p>
                <p className="text-xs text-[var(--pgo-warning-dk)]">
                  {mismatch.diferencia > 0
                    ? "El arrendatario pagó más de lo esperado. Como corredor, puedes aceptar y registrar el monto real en el ledger."
                    : "Como corredor, puedes aceptar esta diferencia y marcar el período como pagado. El monto real quedará registrado en el ledger."}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                disabled={isPending}
                onClick={() => confirmarPago(true)}
                className="pgo-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--pgo-warning)" }}
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Aceptar diferencia y confirmar
              </button>
              <button
                type="button"
                onClick={() => setMismatch(null)}
                className="pgo-btn rounded-lg px-3 py-2 text-sm text-[var(--pgo-warning-dk)] border border-[var(--pgo-warning-bd)] bg-[var(--pgo-surface)]"
              >
                Corregir monto
              </button>
            </div>
          </div>
        )}

        {!mismatch && (
          <div className="flex items-center gap-3">
            <button type="submit" disabled={isPending}
              className="pgo-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--pgo-primary) 0%, var(--pgo-sidebar) 100%)", boxShadow: "0 2px 8px color-mix(in srgb, var(--pgo-primary) 30%, transparent)" }}>
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirmar pago
            </button>
            <button type="button" onClick={() => toggle(p.id)} className="text-sm text-[var(--pgo-text-4)] hover:text-[var(--pgo-text-2)]">Cancelar</button>
          </div>
        )}
      </form>
    );
  }

  // ─── Paso 2 ─────────────────────────────────────────────────────────────
  function Paso2Form({ p }: { p: PeriodoPendiente }) {
    const tieneAjustesPrevios = p.ajustes.length > 0;

    function addAjuste() {
      setAjustesForm(prev => [...prev, { tempId: crypto.randomUUID(), tipo: "descuento_propietario", montoCLP: 0, descripcion: "" }]);
    }
    function removeAjuste(tid: string) { setAjustesForm(prev => prev.filter(a => a.tempId !== tid)); }
    function updateAjuste(tid: string, field: keyof AjusteLocal, val: string | number) {
      setAjustesForm(prev => prev.map(a => a.tempId === tid ? { ...a, [field]: val } : a));
    }

    const allAjustes = [
      ...p.ajustes.map(a => ({ tipo: a.tipo as "descuento_propietario" | "cargo_arrendatario" | "retencion", montoCLP: Number(a.montoCLP) })),
      ...ajustesForm.map(a => ({ tipo: a.tipo, montoCLP: a.montoCLP })),
    ];
    const descuentoProp = allAjustes.filter(a => a.tipo === "descuento_propietario" || a.tipo === "retencion").reduce((s, a) => s + a.montoCLP, 0);
    const comision      = Math.round(p.arriendoCLP * p.comisionPct / 100);
    const netoProp      = p.arriendoCLP - comision - descuentoProp;

    async function onSubmit(e: React.FormEvent) {
      e.preventDefault();
      const allForms: AjusteForm[] = ajustesForm.filter(a => a.montoCLP > 0 && a.descripcion);
      startTransition(async () => {
        const r = await cerrarLiquidacion(p.id, allForms);
        if (!r.ok) {
          toast(r.error, "error");
          return;
        }
        toast(
          `Liquidación cerrada. Neto propietario: ${clp(r.netoCLP)}. Notificaciones enviadas (simulado).`,
          "success",
        );
        setActivoId(null);
        setAjustesForm([]);
      });
    }

    return (
      <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-[var(--pgo-border)] pt-4">
        <div className="rounded-xl bg-[var(--pgo-surface-2)] p-4 text-sm space-y-1">
          <p className="font-medium text-[var(--pgo-text-2)] mb-2">Distribución</p>
          <div className="flex justify-between text-[var(--pgo-text-2)]"><span>Arriendo recibido</span><span>{clp(p.arriendoCLP)}</span></div>
          <div className="flex justify-between text-[var(--pgo-text-2)]"><span>Comisión corredor ({p.comisionPct}%)</span><span className="text-[var(--pgo-danger)]">− {clp(comision)}</span></div>
          {(tieneAjustesPrevios || descuentoProp > 0) && (
            <div className="flex justify-between text-[var(--pgo-warning)]"><span>Ajustes / descuentos</span><span>− {clp(descuentoProp)}</span></div>
          )}
          <div className="flex justify-between font-semibold text-[var(--pgo-text-1)] border-t border-[var(--pgo-border-2)] pt-2 text-base">
            <span>Neto al propietario</span>
            <span className={netoProp < 0 ? "text-[var(--pgo-danger)]" : "text-[var(--pgo-success-dk)]"}>{clp(Math.max(0, netoProp))}</span>
          </div>
        </div>

        {tieneAjustesPrevios && (
          <div className="rounded-xl border border-[var(--pgo-warning-bd)] bg-[var(--pgo-warning-lt)] p-3 text-xs text-[var(--pgo-warning-dk)] space-y-1">
            <p className="font-semibold mb-1">Ajustes previos:</p>
            {p.ajustes.map((a) => (
              <div key={a.id} className="flex justify-between"><span>{a.descripcion}</span><span>{clp(Number(a.montoCLP))}</span></div>
            ))}
          </div>
        )}

        {ajustesForm.map((a) => (
          <div key={a.tempId} className="grid gap-2 sm:grid-cols-3 bg-[var(--pgo-surface-2)] rounded-xl p-3">
            <select value={a.tipo} onChange={(e) => updateAjuste(a.tempId, "tipo", e.target.value)}
              className="rounded-lg border border-[var(--pgo-border-2)] px-2 py-1.5 text-sm">
              <option value="descuento_propietario">Desc. propietario</option>
              <option value="cargo_arrendatario">Cargo arrendatario</option>
              <option value="retencion">Retención</option>
            </select>
            <input type="text" inputMode="decimal" name="monto_ajuste" autoComplete="off"
              placeholder="Monto CLP…" aria-label="Monto del ajuste en pesos"
              value={a.montoCLP || ""}
              onChange={(e) => updateAjuste(a.tempId, "montoCLP", Number(e.target.value.replace(/\D/g, "")))}
              className="rounded-lg border px-2 py-1.5 text-sm pgo-num" style={{ borderColor: "var(--pgo-border)" }} />
            <div className="flex gap-2">
              <input type="text" placeholder="Descripción" value={a.descripcion}
                onChange={(e) => updateAjuste(a.tempId, "descripcion", e.target.value)}
                className="flex-1 rounded-lg border border-[var(--pgo-border-2)] px-2 py-1.5 text-sm" />
              <button type="button" onClick={() => removeAjuste(a.tempId)}
                aria-label="Eliminar este ajuste" className="pgo-btn rounded-lg p-1" style={{ color: "var(--pgo-text-4)" }}>
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        <button type="button" onClick={addAjuste}
          className="pgo-btn flex items-center gap-1 text-sm hover:underline" style={{ color: "var(--pgo-primary)" }}
          aria-label="Agregar un ajuste a esta liquidación">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Agregar ajuste (reparación, descuento…)
        </button>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={isPending || netoProp < 0}
            className="pgo-btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--pgo-success) 0%, var(--pgo-success-dk) 100%)", boxShadow: "0 2px 8px var(--pgo-glow-success)" }}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Cerrar y liquidar
          </button>
          <button type="button" onClick={() => toggle(p.id)} className="text-sm text-[var(--pgo-text-4)] hover:text-[var(--pgo-text-2)]">Cancelar</button>
        </div>
      </form>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  function PeriodoRow({ p }: { p: PeriodoPendiente }) {
    const activo       = activoId === p.id;
    const esPaso1      = p.estado === "atrasado";
    const hoy          = hoyUTC();
    const diasAtrasado = Math.max(0, diasEntre(p.fechaVencimiento, hoy) - p.moraDiasGracia);

    return (
      <div
        className="pgo-card pgo-sheen overflow-hidden transition-all duration-200"
        style={{
          borderColor: activo ? "var(--pgo-primary)" : "var(--pgo-border)",
          borderWidth: activo ? "1.5px" : "1px",
          boxShadow: activo ? "0 0 0 3px rgba(37,99,235,0.08), var(--pgo-shadow-1)" : "var(--pgo-shadow-1)",
        }}
      >
        <div className="h-0.5" style={{ background: esPaso1 ? "var(--pgo-danger)" : "var(--pgo-success)" }} />
        <button type="button"
          aria-expanded={activo}
          aria-controls={`cobro-detalle-${p.id}`}
          aria-label={`${esPaso1 ? "Conciliar" : "Cerrar liquidación"}: ${p.contrato.arrendatario.nombre} — ${p.contrato.propiedad.direccion}`}
          onClick={() => toggle(p.id)}
          className="pgo-btn flex w-full items-start gap-4 p-4 text-left"
        >
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: esPaso1 ? "linear-gradient(135deg,var(--pgo-danger),var(--pgo-danger-dk))" : "linear-gradient(135deg,var(--pgo-success),var(--pgo-success-dk))" }}>
            {esPaso1 ? "P1" : "P2"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[var(--pgo-text-1)]">{p.contrato.arrendatario.nombre}</span>
              <Badge tone={estadoTone(p.estado)} pulse={estadoPulse(p.estado)}>
                {esPaso1 ? `atrasado${diasAtrasado > 0 ? ` · ${diasAtrasado}d` : ""}` : "por cerrar"}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-[var(--pgo-text-3)]">
              {p.contrato.propiedad.direccion}{p.contrato.propiedad.comuna ? `, ${p.contrato.propiedad.comuna}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <span className="text-[var(--pgo-text-4)]">Vence <span className="font-medium text-[var(--pgo-text-2)]">{fecha(p.fechaVencimiento)}</span></span>
              <span className="text-[var(--pgo-text-4)]">Arriendo <span className="font-semibold text-[var(--pgo-text-1)]">
                {p.contrato.denominacion === "UF" ? `${num(p.montoBase)} UF ≈ ${clp(p.arriendoCLP)}` : clp(p.arriendoCLP)}
              </span></span>
              {p.montoGastoComun > 0 && <span className="text-[var(--pgo-text-4)]">GC <span className="font-medium text-[var(--pgo-text-2)]">{clp(p.montoGastoComun)}</span></span>}
            </div>
          </div>
          <div aria-hidden="true" className="ml-2 shrink-0 rounded-lg p-1.5"
            style={{ background: activo ? "var(--pgo-border)" : "transparent" }}>
            {activo ? <ChevronUp className="h-4 w-4" style={{ color: "var(--pgo-text-3)" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "var(--pgo-text-4)" }} />}
          </div>
        </button>

        {activo && (
          <div id={`cobro-detalle-${p.id}`} role="region"
            aria-label={`Detalle: ${p.contrato.arrendatario.nombre}`}
            className="px-4 pb-5 pt-1" style={{ borderTop: "1px solid var(--pgo-border)" }}>
            {esPaso1 ? <Paso1Form p={p} /> : <Paso2Form p={p} />}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      {(atrasados.length > 0 || porCerrar.length > 0) && (
        <Tabs
          active={tab}
          onChange={(k) => { setTab(k); setActivoId(null); setSubFiltro("todos"); setBusqueda(""); }}
          tabs={[
            { key: "paso1", label: "Paso 1 — Conciliar", count: atrasados.length, tone: atrasados.length > 0 ? "red" : "slate" },
            { key: "paso2", label: "Paso 2 — Cerrar",    count: porCerrar.length, tone: porCerrar.length > 0 ? "amber" : "slate" },
          ]}
        />
      )}

      {/* FilterToolbar */}
      {periodosMostrados.length > 0 && (
        <>
          <FilterToolbar
            dateFilter={dateFilter}
            onDateFilterChange={(v) => { setDateFilter(v); setActivoId(null); }}
            defaultSort="urgentes"
            sortOptions={[
              { key: "urgentes",  label: "Más urgentes"  },
              { key: "recientes", label: "Más recientes" },
            ]}
            rangeOptions={[
              { key: "todos",        label: "Todos"           },
              { key: "este_mes",     label: "Este mes"        },
              { key: "mes_anterior", label: "Mes anterior"    },
              { key: "ultimos_3m",   label: "Últimos 3 meses" },
            ]}
            busqueda={busqueda}
            onBusquedaChange={(v) => { setBusqueda(v); setActivoId(null); }}
            searchPlaceholder="Buscar por arrendatario o dirección…"
          >
            {[
              { key: "todos",      label: "Todos",        count: periodosMostrados.length },
              ...(tab === "paso1"
                ? [{ key: "alta_mora",   label: "Mora > 30d",         count: periodosMostrados.filter((p) => Math.max(0, Math.floor((HOY.getTime() - new Date(p.fechaVencimiento).getTime()) / 86400000) - p.moraDiasGracia) > 30).length }]
                : [{ key: "con_ajustes", label: "Con ajustes previos",count: periodosMostrados.filter((p) => p.ajustes.length > 0).length }]),
              { key: "con_gc", label: "Con GC", count: periodosMostrados.filter((p) => p.montoGastoComun > 0).length },
              { key: "UF",     label: "UF",     count: periodosMostrados.filter((p) => p.contrato.denominacion === "UF").length },
              { key: "CLP",    label: "CLP",    count: periodosMostrados.filter((p) => p.contrato.denominacion === "CLP").length },
            ].map((f) => (
              <FilterChip
                key={f.key}
                label={f.label}
                count={f.count}
                active={subFiltro === f.key}
                activeColor="var(--pgo-primary-dk)"
                onClick={() => { setSubFiltro(f.key); setActivoId(null); }}
              />
            ))}
          </FilterToolbar>

          <p className="text-xs text-[var(--pgo-text-4)]">
            {tab === "paso1"
              ? "Declara la fecha real del pago y el monto recibido para registrar sin intereses fantasma."
              : "Revisa el pago recibido, agrega ajustes (descuentos, cargos) y cierra la liquidación al propietario."}
          </p>
        </>
      )}

      {/* Lista */}
      <div className="space-y-3 pgo-stagger">
        {pagina.length === 0 && periodosMostrados.length > 0 ? (
          <div className="pgo-card p-8 text-center text-sm text-[var(--pgo-text-4)]">
            Sin resultados para los filtros seleccionados.
          </div>
        ) : (
          pagina.map((p) => <PeriodoRow key={p.id} p={p} />)
        )}
      </div>

      {/* Footer paginación */}
      {periodosFinales.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--pgo-text-4)]">{pagina.length} de {periodosFinales.length} período{periodosFinales.length !== 1 ? "s" : ""}</span>
          <PageSizePicker value={pageSize} onChange={setPageSize} />
        </div>
      )}

      {atrasados.length === 0 && porCerrar.length === 0 && (
        <div className="pgo-card p-12 text-center" role="status" aria-label="No hay cobros pendientes">
          <CheckCircle2 className="mx-auto h-10 w-10" aria-hidden="true" style={{ color: "var(--pgo-success)" }} />
          <p className="mt-3 font-semibold" style={{ color: "var(--pgo-text-1)" }}>Todo al día — excelente trabajo</p>
          <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>No hay períodos pendientes de conciliar ni liquidar este mes.</p>
        </div>
      )}
    </div>
  );
}
