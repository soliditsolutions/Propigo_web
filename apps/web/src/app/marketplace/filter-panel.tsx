"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, SlidersHorizontal } from "lucide-react";
import { REGIONES_CHILE, getComunasDeRegion } from "@propigo/core";

export type MarketplaceFiltros = {
  q: string;
  tipo: string;
  region: string;
  comuna: string;
  piezasMin: string;
  piezasMax: string;
  banosMin: string;
  estacionamiento: boolean;
  m2TotMin: string;
  m2TotMax: string;
  m2ConMin: string;
  m2ConMax: string;
  pagaGC: boolean;
  mascotas: boolean;
  precioMin: string;
  precioMax: string;
  publicadaDias: string;
};

function parseFiltros(sp: Record<string, string>): MarketplaceFiltros {
  return {
    q:               sp.q ?? "",
    tipo:            sp.tipo ?? "todas",
    region:          sp.region ?? "",
    comuna:          sp.comuna ?? "",
    piezasMin:       sp.piezasMin ?? "",
    piezasMax:       sp.piezasMax ?? "",
    banosMin:        sp.banosMin ?? "",
    estacionamiento: sp.estacionamiento === "1",
    m2TotMin:        sp.m2TotMin ?? "",
    m2TotMax:        sp.m2TotMax ?? "",
    m2ConMin:        sp.m2ConMin ?? "",
    m2ConMax:        sp.m2ConMax ?? "",
    pagaGC:          sp.pagaGC === "1",
    mascotas:        sp.mascotas === "1",
    precioMin:       sp.precioMin ?? "",
    precioMax:       sp.precioMax ?? "",
    publicadaDias:   sp.publicadaDias ?? "",
  };
}

function buildUrl(f: MarketplaceFiltros): string {
  const p = new URLSearchParams();
  if (f.q)                p.set("q", f.q);
  if (f.tipo && f.tipo !== "todas") p.set("tipo", f.tipo);
  if (f.region)           p.set("region", f.region);
  if (f.comuna)           p.set("comuna", f.comuna);
  if (f.piezasMin)        p.set("piezasMin", f.piezasMin);
  if (f.piezasMax)        p.set("piezasMax", f.piezasMax);
  if (f.banosMin)         p.set("banosMin", f.banosMin);
  if (f.estacionamiento)  p.set("estacionamiento", "1");
  if (f.m2TotMin)         p.set("m2TotMin", f.m2TotMin);
  if (f.m2TotMax)         p.set("m2TotMax", f.m2TotMax);
  if (f.m2ConMin)         p.set("m2ConMin", f.m2ConMin);
  if (f.m2ConMax)         p.set("m2ConMax", f.m2ConMax);
  if (f.pagaGC)           p.set("pagaGC", "1");
  if (f.mascotas)         p.set("mascotas", "1");
  if (f.precioMin)        p.set("precioMin", f.precioMin);
  if (f.precioMax)        p.set("precioMax", f.precioMax);
  if (f.publicadaDias)    p.set("publicadaDias", f.publicadaDias);
  const qs = p.toString();
  return `/marketplace${qs ? `?${qs}` : ""}`;
}

function countActiveFilters(f: MarketplaceFiltros): number {
  let n = 0;
  if (f.region)          n++;
  if (f.comuna)          n++;
  if (f.piezasMin || f.piezasMax) n++;
  if (f.banosMin)        n++;
  if (f.estacionamiento) n++;
  if (f.m2TotMin || f.m2TotMax) n++;
  if (f.m2ConMin || f.m2ConMax) n++;
  if (f.pagaGC)          n++;
  if (f.mascotas)        n++;
  if (f.precioMin || f.precioMax) n++;
  if (f.publicadaDias)   n++;
  return n;
}

function RangeInput({ label, ariaLabel, minVal, maxVal, onMin, onMax, placeholder }: {
  label: string;
  ariaLabel?: string;
  minVal: string; maxVal: string;
  onMin: (v: string) => void; onMax: (v: string) => void;
  placeholder?: string;
}) {
  const nombreCampo = ariaLabel || label || "Rango";
  return (
    <fieldset className="m-0 border-0 p-0">
      {label && <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-muted)" }}>{label}</legend>}
      <div className="flex items-center gap-2">
        <input
          type="number" inputMode="numeric" min="0"
          value={minVal} onChange={(e) => onMin(e.target.value)}
          placeholder={`Mín${placeholder ? ` (${placeholder})` : ""}`}
          aria-label={`${nombreCampo} — mínimo`}
          className="pf-input flex-1 text-sm"
          style={{ height: "44px", padding: "0 12px", fontSize: "13px" }}
        />
        <span style={{ color: "var(--pf-text-light)", fontSize: "12px" }}>–</span>
        <input
          type="number" inputMode="numeric" min="0"
          value={maxVal} onChange={(e) => onMax(e.target.value)}
          placeholder={`Máx${placeholder ? ` (${placeholder})` : ""}`}
          aria-label={`${nombreCampo} — máximo`}
          className="pf-input flex-1 text-sm"
          style={{ height: "44px", padding: "0 12px", fontSize: "13px" }}
        />
      </div>
    </fieldset>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1">
      <input
        type="checkbox" checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded"
        style={{ accentColor: "var(--pf-brand)" }}
      />
      <span className="text-sm" style={{ color: "var(--pf-navy)" }}>{label}</span>
    </label>
  );
}

export function FilterPanel({ searchParams }: { searchParams: Record<string, string> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<MarketplaceFiltros>(() => parseFiltros(searchParams));
  const drawerRef = useRef<HTMLElement | null>(null);

  // Sync when URL changes (e.g. predefined chip clicked)
  useEffect(() => {
    queueMicrotask(() => setF(parseFiltros(searchParams)));
  }, [searchParams]);

  // `aria-hidden` por sí solo no saca los campos del drawer cerrado del orden
  // de tabulación (translateX(100%) los deja fuera de vista pero no fuera del
  // tab order) — mismo problema y misma solución que Carousel.tsx: fijar
  // `inert` imperativamente (vía ref, no como prop JSX, para evitar el warning
  // de hidratación espurio que dispara esta versión de React).
  useEffect(() => {
    if (drawerRef.current) drawerRef.current.inert = !open;
  }, [open]);

  function set<K extends keyof MarketplaceFiltros>(key: K, val: MarketplaceFiltros[K]) {
    setF((prev) => ({ ...prev, [key]: val }));
  }

  function aplicar() {
    router.push(buildUrl(f));
    setOpen(false);
  }

  function limpiar() {
    const clean: MarketplaceFiltros = parseFiltros({ q: f.q, tipo: f.tipo });
    setF(clean);
  }

  const activeCount = countActiveFilters(f);

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pf-btn-secondary inline-flex items-center gap-2 shrink-0"
        style={{ height: "48px", padding: "0 16px", fontSize: "14px", borderRadius: "12px", position: "relative" }}
        aria-label="Abrir panel de filtros"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Crear Filtro
        {activeCount > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ background: "var(--pf-brand-btn)" }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(10,37,64,0.35)", backdropFilter: "blur(2px)" }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        ref={drawerRef}
        className="fixed right-0 top-0 z-50 h-full overflow-y-auto flex flex-col"
        style={{
          width: "min(420px, 100vw)",
          background: "var(--pf-surface)",
          boxShadow: "var(--pgo-shadow-3)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}
        aria-label="Panel de filtros"
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--pf-border)" }}
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" style={{ color: "var(--pf-brand)" }} aria-hidden />
            <h2 className="text-base font-bold" style={{ color: "var(--pf-navy)" }}>Filtros de búsqueda</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="pgo-tap-target relative rounded-lg p-1.5 transition-colors hover:bg-[var(--pf-surface)]"
            aria-label="Cerrar filtros"
          >
            <X className="h-4 w-4" style={{ color: "var(--pf-text-muted)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">

          {/* Ubicación */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pf-brand)" }}>
              Ubicación
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="filtro-region" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-muted)" }}>Región</label>
                <select
                  id="filtro-region"
                  value={f.region}
                  onChange={(e) => { set("region", e.target.value); set("comuna", ""); }}
                  className="pf-input w-full"
                  style={{ height: "44px", padding: "0 12px", fontSize: "14px" }}
                >
                  <option value="">Todas las regiones</option>
                  {REGIONES_CHILE.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="filtro-comuna" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-muted)" }}>Comuna</label>
                <select
                  id="filtro-comuna"
                  value={f.comuna}
                  onChange={(e) => set("comuna", e.target.value)}
                  disabled={!f.region}
                  className="pf-input w-full disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ height: "44px", padding: "0 12px", fontSize: "14px" }}
                >
                  <option value="">{f.region ? "Todas las comunas" : "Primero elige una región"}</option>
                  {getComunasDeRegion(f.region).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <hr style={{ borderColor: "var(--pf-border)" }} />

          {/* Características */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pf-brand)" }}>
              Características
            </h3>
            <div className="space-y-3">
              <RangeInput
                label="Piezas"
                minVal={f.piezasMin} maxVal={f.piezasMax}
                onMin={(v) => set("piezasMin", v)} onMax={(v) => set("piezasMax", v)}
              />
              <div>
                <label htmlFor="filtro-banos" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-muted)" }}>Baños (mínimo)</label>
                <input
                  id="filtro-banos"
                  type="number" inputMode="numeric" min="0"
                  value={f.banosMin}
                  onChange={(e) => set("banosMin", e.target.value)}
                  placeholder="Ej: 1"
                  className="pf-input w-full"
                  style={{ height: "44px", padding: "0 12px", fontSize: "13px" }}
                />
              </div>
              <RangeInput
                label="Metros cuadrados totales"
                minVal={f.m2TotMin} maxVal={f.m2TotMax}
                onMin={(v) => set("m2TotMin", v)} onMax={(v) => set("m2TotMax", v)}
                placeholder="m²"
              />
              <RangeInput
                label="Metros cuadrados construidos"
                minVal={f.m2ConMin} maxVal={f.m2ConMax}
                onMin={(v) => set("m2ConMin", v)} onMax={(v) => set("m2ConMax", v)}
                placeholder="m²"
              />
            </div>
          </section>

          <hr style={{ borderColor: "var(--pf-border)" }} />

          {/* Comodidades */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pf-brand)" }}>
              Comodidades
            </h3>
            <div className="space-y-0.5">
              <CheckRow label="Tiene estacionamiento" checked={f.estacionamiento} onChange={(v) => set("estacionamiento", v)} />
              <CheckRow label="Acepta mascotas" checked={f.mascotas} onChange={(v) => set("mascotas", v)} />
              <CheckRow label="Sin gastos comunes" checked={f.pagaGC} onChange={(v) => set("pagaGC", v)} />
            </div>
          </section>

          <hr style={{ borderColor: "var(--pf-border)" }} />

          {/* Precio */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pf-brand)" }}>
              Precio mensual (CLP)
            </h3>
            <RangeInput
              label=""
              ariaLabel="Precio mensual"
              minVal={f.precioMin} maxVal={f.precioMax}
              onMin={(v) => set("precioMin", v)} onMax={(v) => set("precioMax", v)}
              placeholder="CLP"
            />
          </section>

          <hr style={{ borderColor: "var(--pf-border)" }} />

          {/* Fecha de publicación */}
          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--pf-brand)" }}>
              Fecha de publicación
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Últimos 7 días",   val: "7"   },
                { label: "Último mes",        val: "30"  },
                { label: "Últimos 3 meses",   val: "90"  },
                { label: "Últimos 6 meses",   val: "180" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => set("publicadaDias", f.publicadaDias === opt.val ? "" : opt.val)}
                  className="rounded-xl py-2 px-3 text-sm font-medium transition-all"
                  style={{
                    background: f.publicadaDias === opt.val ? "var(--pf-brand-tint)" : "var(--pf-surface)",
                    color: f.publicadaDias === opt.val ? "var(--pf-brand)" : "var(--pf-text-muted)",
                    border: `1.5px solid ${f.publicadaDias === opt.val ? "var(--pf-brand)" : "var(--pf-border)"}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0"
          style={{ borderTop: "1px solid var(--pf-border)" }}
        >
          <button
            type="button"
            onClick={limpiar}
            className="pf-btn-secondary flex-1 text-sm"
            style={{ height: "44px" }}
          >
            Limpiar filtros
          </button>
          <button
            type="button"
            onClick={aplicar}
            className="pf-btn-primary flex-1 text-sm font-semibold"
            style={{ height: "44px" }}
          >
            Aplicar{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </aside>
    </>
  );
}
