"use client";

import { useState, useMemo, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  X, MapPin, BedDouble, Bath, Car, ChevronRight, ShieldCheck,
  Plus, Loader2, AlertCircle, Image as ImageIcon, CheckCircle2, Pencil,
  Lock, ArrowRight, RotateCcw, UploadCloud,
} from "lucide-react";
import { Badge, CupoBadge, estadoTone, estadoPulse } from "@/components/panel/ui";
import { FilterToolbar, FilterChip } from "@/components/panel/filter-toolbar";
import { PageSizePicker } from "@/components/panel/page-size-picker";
import { type DateFilterState } from "@/components/panel/date-filter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { clp } from "@/lib/format";
import { crearPropiedad, activarPropiedad, desactivarPropiedad, actualizarPropiedad, previsualizarUbicacion } from "./actions";
import { formatearRut, validarRut, REGIONES_CHILE, getComunasDeRegion, ORIENTACIONES } from "@housing/core";

// Leaflet usa `window` — debe cargarse únicamente en el navegador.
const LeafletMapInner = dynamic(() => import("@/components/marketplace/LeafletMapInner"), { ssr: false });

type Imagen = { url: string; orden: number };

type Propiedad = {
  id: string;
  tipo: string;
  estado: string;
  direccion: string;
  comuna: string | null;
  region: string | null;
  orientacion: string | null;
  antiguedadAnios: number | null;
  m2Construidos: number | null;
  m2Totales: number | null;
  esCondominio: boolean;
  plantas: number | null;
  piezas: number | null;
  banos: number | null;
  estacionamientos: number | null;
  pagaGastosComunes: boolean;
  valorGastosComunes: number | null;
  aceptaMascotas: boolean;
  otrasDescripciones: string | null;
  latitud: number | null;
  longitud: number | null;
  mostrarUbicacionExacta: boolean;
  asignadoAId: string | null;
  asignadoA: { id: string; nombre: string } | null;
  propietario: { nombre: string };
  imagenes: Imagen[];
  _count: { contratos: number; publicaciones: number };
};

type Colaborador = { id: string; nombre: string };

const TIPO_LABEL: Record<string, string> = {
  casa: "Casa", departamento: "Departamento", cabana: "Cabaña",
};

const TIPO_STYLE: Record<string, { bg: string; text: string; initial: string }> = {
  casa:         { bg: "var(--hw-warning-lt)", text: "var(--hw-warning-dk)", initial: "C" },
  departamento: { bg: "var(--hw-primary-lt)", text: "var(--hw-primary-dk)", initial: "D" },
  cabana:       { bg: "var(--hw-success-lt)", text: "var(--hw-success-dk)", initial: "B" },
};

function estadoStripColor(estado: string): string {
  const map: Record<string, string> = {
    arrendada:  "var(--hw-primary)",
    disponible: "var(--hw-success)",
    reservada:  "var(--hw-warning)",
    borrador:   "var(--hw-text-4)",
  };
  return map[estado] ?? "var(--hw-border-2)";
}

type FiltroEstado = "todas" | "borrador" | "disponible" | "reservada" | "arrendada";

const FILTROS: { key: FiltroEstado; label: string; color?: string }[] = [
  { key: "todas",      label: "Todas" },
  { key: "borrador",   label: "Borrador",    color: "var(--hw-text-3)" },
  { key: "disponible", label: "Disponibles", color: "var(--hw-success)" },
  { key: "reservada",  label: "Reservadas",  color: "var(--hw-warning)" },
  { key: "arrendada",  label: "Arrendadas",  color: "var(--hw-primary)" },
];

const SORT_OPTIONS_PROP  = [
  { key: "nuevas",   label: "Más nuevas"   },
  { key: "antiguas", label: "Más antiguas" },
];
const RANGE_OPTIONS_PROP = [
  { key: "todos",       label: "Todas"     },
  { key: "recientes_p", label: "< 5 años"  },
  { key: "maduras_p",   label: "5–15 años" },
  { key: "antiguas_p",  label: "> 15 años" },
];

/* ── Tipo compartido para formularios de crear/editar ── */
type FormProp = {
  tipo: string;
  direccion: string;
  comuna: string;
  region: string;
  piezas: string;
  banos: string;
  m2Totales: string;
  m2Construidos: string;
  estacionamientos: string;
  plantas: string;
  antiguedadAnios: string;
  orientacion: string;
  esCondominio: boolean;
  pagaGastosComunes: boolean;
  valorGastosComunes: string;
  aceptaMascotas: boolean;
  otrasDescripciones: string;
  mostrarUbicacionExacta: boolean;
  imagenes: string[];
  /** "" = sin asignar. Solo se envía al servidor cuando esManager. */
  asignadoAId: string;
};

type FormCrear = FormProp & {
  propietarioNombre: string;
  propietarioRut: string;
  propietarioEmail: string;
};

const FORM_CREAR_INICIAL: FormCrear = {
  tipo: "departamento",
  direccion: "", comuna: "", region: "",
  piezas: "", banos: "", m2Totales: "",
  m2Construidos: "", estacionamientos: "", plantas: "",
  antiguedadAnios: "", orientacion: "", esCondominio: false,
  pagaGastosComunes: false, valorGastosComunes: "",
  aceptaMascotas: false,
  otrasDescripciones: "",
  mostrarUbicacionExacta: false,
  propietarioNombre: "", propietarioRut: "", propietarioEmail: "",
  imagenes: [""],
  asignadoAId: "",
};

function formDesdePropiedad(p: Propiedad): FormProp {
  return {
    tipo:               p.tipo,
    direccion:          p.direccion,
    comuna:             p.comuna ?? "",
    region:             p.region ?? "",
    piezas:             p.piezas != null ? String(p.piezas) : "",
    banos:              p.banos  != null ? String(p.banos)  : "",
    m2Totales:          p.m2Totales != null ? String(p.m2Totales) : "",
    m2Construidos:      p.m2Construidos != null ? String(p.m2Construidos) : "",
    estacionamientos:   p.estacionamientos != null ? String(p.estacionamientos) : "",
    plantas:            p.plantas != null ? String(p.plantas) : "",
    antiguedadAnios:    p.antiguedadAnios != null ? String(p.antiguedadAnios) : "",
    orientacion:        p.orientacion ?? "",
    esCondominio:       p.esCondominio,
    pagaGastosComunes:  p.pagaGastosComunes,
    valorGastosComunes: p.valorGastosComunes != null ? String(p.valorGastosComunes) : "",
    aceptaMascotas:     p.aceptaMascotas,
    otrasDescripciones: p.otrasDescripciones ?? "",
    mostrarUbicacionExacta: p.mostrarUbicacionExacta,
    imagenes:           p.imagenes.map((i) => i.url).concat(p.imagenes.length === 0 ? [""] : []),
    asignadoAId:        p.asignadoAId ?? "",
  };
}

/* ── Sub-componente: gestión de imágenes con upload local ── */
type SlotUpload = { subiendo: boolean; error: string };

function ImagenesField({
  imagenes,
  onChange,
}: {
  imagenes: string[];
  onChange: (imgs: string[]) => void;
}) {
  // Estado de upload por índice (no array paralela para evitar desincronía)
  const [slots, setSlots] = useState<Record<number, SlotUpload>>({});

  function getSlot(idx: number): SlotUpload {
    return slots[idx] ?? { subiendo: false, error: "" };
  }
  function patchSlot(idx: number, patch: Partial<SlotUpload>) {
    setSlots((s) => ({ ...s, [idx]: { ...getSlot(idx), ...patch } }));
  }

  async function subirArchivo(idx: number, file: File) {
    patchSlot(idx, { subiendo: true, error: "" });
    const form = new FormData();
    form.append("file", file);
    try {
      const res  = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        patchSlot(idx, { subiendo: false, error: data.error ?? "Error al subir la imagen." });
        return;
      }
      patchSlot(idx, { subiendo: false, error: "" });
      const imgs    = [...imagenes];
      imgs[idx]     = data.url;
      onChange(imgs);
    } catch {
      patchSlot(idx, { subiendo: false, error: "Error de red. Intenta de nuevo." });
    }
  }

  function agregar() {
    if (imagenes.length < 5) onChange([...imagenes, ""]);
  }

  function quitar(idx: number) {
    // Limpiar estado del slot eliminado y re-indexar los posteriores
    setSlots((s) => {
      const next: Record<number, SlotUpload> = {};
      Object.entries(s).forEach(([k, v]) => {
        const n = Number(k);
        if (n < idx)      next[n]     = v;
        else if (n > idx) next[n - 1] = v; // desplazar hacia arriba
      });
      return next;
    });
    const imgs = imagenes.filter((_, i) => i !== idx);
    onChange(imgs.length ? imgs : [""]);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"
           style={{ color: "var(--hw-text-4)" }}>
          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Imágenes (máx. 5 · JPG, PNG, WebP, GIF · 5 MB c/u)
        </p>
        {imagenes.length < 5 && (
          <button
            type="button"
            onClick={agregar}
            className="hw-btn text-[10px] font-semibold rounded-lg px-2 py-1"
            style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-3)" }}
          >
            + Agregar
          </button>
        )}
      </div>

      <div className="space-y-3">
        {imagenes.map((url, idx) => {
          const { subiendo, error } = getSlot(idx);
          return (
            <div key={idx}>
              {url ? (
                /* ── Vista previa de imagen ya subida ── */
                <div className="relative overflow-hidden rounded-xl"
                     style={{ height: "7rem", background: "var(--hw-surface-2)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Imagen ${idx + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => quitar(idx)}
                    aria-label={`Eliminar imagen ${idx + 1}`}
                    className="absolute right-2 top-2 rounded-full p-1.5 transition-opacity"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    <X className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                /* ── Zona de subida ── */
                <div className="flex gap-2">
                  <label
                    className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed py-3 px-4 text-sm transition-colors hover:bg-[var(--hw-surface-2)]"
                    style={{
                      borderColor: error ? "var(--hw-danger-bd)" : "var(--hw-border)",
                      background:  error ? "var(--hw-danger-lt)"  : undefined,
                      cursor: subiendo ? "wait" : "pointer",
                    }}
                  >
                    {subiendo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--hw-text-4)" }} aria-hidden="true" />
                        <span style={{ color: "var(--hw-text-4)" }}>Subiendo…</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-4 w-4" style={{ color: "var(--hw-text-4)" }} aria-hidden="true" />
                        <span style={{ color: "var(--hw-text-3)" }}>
                          {error ? "Reintentar" : "Seleccionar imagen"}
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      disabled={subiendo}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Limpiar el input para permitir re-seleccionar el mismo archivo
                          e.target.value = "";
                          subirArchivo(idx, file);
                        }
                      }}
                    />
                  </label>
                  {imagenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => quitar(idx)}
                      aria-label={`Eliminar slot ${idx + 1}`}
                      className="hw-btn rounded-lg p-2 text-[var(--hw-text-4)] hover:text-[var(--hw-danger)]"
                      style={{ background: "var(--hw-surface-2)" }}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              {error && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[var(--hw-danger)]" role="alert">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sub-componente: campos comunes del formulario ── */
function CamposProp({
  form,
  rutError,
  showPropietario,
  esManager,
  colaboradores,
  onChangeField,
  onChangeImagenes,
  onRutBlur,
}: {
  form: FormCrear;
  rutError: string;
  showPropietario: boolean;
  /** ADR-0013 (Fase C) — el selector de colaborador es exclusivo del Manager. */
  esManager: boolean;
  colaboradores: Colaborador[];
  onChangeField: <K extends keyof FormCrear>(k: K, v: FormCrear[K]) => void;
  onChangeImagenes: (imgs: string[]) => void;
  onRutBlur: () => void;
}) {
  /* ── Vista previa de ubicación en el mapa (detecta typos antes de guardar) ── */
  const [preview, setPreview] = useState<{ latitud: number; longitud: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const ultimaConsulta = useRef(0);

  function dispararPreview(direccion: string, comuna: string, region: string) {
    if (!direccion.trim()) return;
    // Debounce en el cliente además del rate-limit del servidor — evita
    // disparar dos veces si el usuario tabula rápido entre campos.
    const ahora = Date.now();
    if (ahora - ultimaConsulta.current < 1200) return;
    ultimaConsulta.current = ahora;

    setPreviewLoading(true);
    setPreviewError("");
    previsualizarUbicacion(direccion, comuna, region).then((res) => {
      setPreviewLoading(false);
      if (!res.ok) { setPreviewError(res.error); setPreview(null); return; }
      setPreview({ latitud: res.latitud, longitud: res.longitud });
    });
  }

  return (
    <div className="space-y-4">
      {/* Tipo */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Tipo *</p>
        <div className="flex gap-2">
          {[
            { v: "departamento", l: "Departamento" },
            { v: "casa",         l: "Casa" },
            { v: "cabana",       l: "Cabaña" },
          ].map(({ v, l }) => {
            const active = form.tipo === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChangeField("tipo", v)}
                aria-pressed={active}
                className="hw-btn flex-1 rounded-xl py-2 text-xs font-semibold"
                style={{
                  background: active ? "var(--hw-primary-lt)" : "var(--hw-surface-2)",
                  color:      active ? "var(--hw-primary)"    : "var(--hw-text-3)",
                  border:     `1.5px solid ${active ? "var(--hw-primary)" : "transparent"}`,
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dirección */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Dirección *</p>
        <input
          type="text"
          value={form.direccion}
          onChange={(e) => onChangeField("direccion", e.target.value)}
          onBlur={() => dispararPreview(form.direccion, form.comuna, form.region)}
          placeholder="Av. Providencia 1234, Piso 5, Depto. 501"
          className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
          style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
          autoComplete="street-address"
        />
      </div>

      {/* Región + Comuna — comuna depende de la región elegida */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Región</p>
          <select
            value={form.region}
            onChange={(e) => { onChangeField("region", e.target.value); onChangeField("comuna", ""); }}
            className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
          >
            <option value="">Seleccionar región…</option>
            {REGIONES_CHILE.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Comuna</p>
          <select
            value={form.comuna}
            onChange={(e) => {
              onChangeField("comuna", e.target.value);
              dispararPreview(form.direccion, e.target.value, form.region);
            }}
            disabled={!form.region}
            className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
          >
            <option value="">{form.region ? "Seleccionar comuna…" : "Primero elige una región"}</option>
            {getComunasDeRegion(form.region).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Vista previa en el mapa — ayuda a detectar direcciones mal escritas antes de guardar */}
      {(previewLoading || preview || previewError) && (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--hw-border)" }}>
          {previewLoading && (
            <div className="flex items-center gap-2 p-3 text-xs" style={{ color: "var(--hw-text-4)" }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Ubicando dirección…
            </div>
          )}
          {!previewLoading && previewError && (
            <div className="flex items-center gap-2 p-3 text-xs" style={{ color: "var(--hw-danger)" }}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {previewError}
            </div>
          )}
          {!previewLoading && preview && (
            <>
              <div className="flex items-center gap-2 px-3 pt-2 text-xs font-medium" style={{ color: "var(--hw-text-3)" }}>
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                ¿Es esta la ubicación correcta?
              </div>
              <div className="h-40 w-full">
                <LeafletMapInner latitud={preview.latitud} longitud={preview.longitud} exacta />
              </div>
            </>
          )}
        </div>
      )}

      {/* Piezas / Baños / m² totales */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Piezas",  key: "piezas"    as const, placeholder: "2" },
          { label: "Baños",   key: "banos"     as const, placeholder: "1" },
          { label: "m² tot.", key: "m2Totales" as const, placeholder: "55" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>{label}</p>
            <input
              type="number"
              inputMode="numeric"
              value={form[key]}
              onChange={(e) => onChangeField(key, e.target.value)}
              placeholder={placeholder}
              min="0"
              className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
              style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
            />
          </div>
        ))}
      </div>

      {/* m² construidos / Estacionamientos / Plantas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "m² constr.",       key: "m2Construidos"    as const, placeholder: "48" },
          { label: "Estacionamientos", key: "estacionamientos" as const, placeholder: "1" },
          { label: "Plantas",          key: "plantas"          as const, placeholder: "2" },
        ].map(({ label, key, placeholder }) => (
          <div key={key}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>{label}</p>
            <input
              type="number"
              inputMode="numeric"
              value={form[key]}
              onChange={(e) => onChangeField(key, e.target.value)}
              placeholder={placeholder}
              min="0"
              className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
              style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
            />
          </div>
        ))}
      </div>

      {/* Antigüedad / Orientación */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Antigüedad (años)</p>
          <input
            type="number"
            inputMode="numeric"
            value={form.antiguedadAnios}
            onChange={(e) => onChangeField("antiguedadAnios", e.target.value)}
            placeholder="12"
            min="0"
            className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Orientación</p>
          <select
            value={form.orientacion}
            onChange={(e) => onChangeField("orientacion", e.target.value)}
            className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
          >
            <option value="">Sin especificar</option>
            {ORIENTACIONES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Es condominio */}
      <div className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)" }}>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.esCondominio}
            onChange={(e) => onChangeField("esCondominio", e.target.checked)}
            className="h-4 w-4 rounded accent-blue-600"
          />
          <span className="text-sm font-medium" style={{ color: "var(--hw-text-2)" }}>
            Es condominio
          </span>
        </label>
      </div>

      {/* Ubicación exacta en el mapa público — requiere acuerdo previo con el propietario */}
      <div className="rounded-xl p-3" style={{ background: "var(--hw-success-lt)", border: "1px solid var(--hw-success-bd)" }}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.mostrarUbicacionExacta}
            onChange={(e) => onChangeField("mostrarUbicacionExacta", e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-emerald-600"
          />
          <span>
            <span className="block text-sm font-medium" style={{ color: "var(--hw-success-dk)" }}>
              Mostrar ubicación exacta en el marketplace
            </span>
            <span className="block text-xs mt-0.5" style={{ color: "var(--hw-success-dk)" }}>
              Por defecto, el público solo ve la comuna/región y un área aproximada en el mapa.
              Actívalo solo si ya conversaste con el propietario — se mostrará la dirección
              completa y el pin exacto a cualquier visitante.
            </span>
          </span>
        </label>
      </div>

      {/* Gasto común */}
      <div className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)" }}>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.pagaGastosComunes}
            onChange={(e) => onChangeField("pagaGastosComunes", e.target.checked)}
            className="h-4 w-4 rounded accent-blue-600"
          />
          <span className="text-sm font-medium" style={{ color: "var(--hw-text-2)" }}>
            La propiedad cobra gasto común
          </span>
        </label>
        {form.pagaGastosComunes && (
          <div className="mt-2 pl-7">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Monto GC (CLP)</p>
            <input
              type="number"
              inputMode="numeric"
              value={form.valorGastosComunes}
              onChange={(e) => onChangeField("valorGastosComunes", e.target.value)}
              placeholder="45000"
              min="0"
              className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
              style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
            />
          </div>
        )}
      </div>

      {/* Acepta mascotas */}
      <div className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)" }}>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={form.aceptaMascotas}
            onChange={(e) => onChangeField("aceptaMascotas", e.target.checked)}
            className="h-4 w-4 rounded accent-blue-600"
          />
          <span className="text-sm font-medium" style={{ color: "var(--hw-text-2)" }}>
            Acepta mascotas
          </span>
        </label>
      </div>

      {/* Imágenes */}
      <ImagenesField imagenes={form.imagenes} onChange={onChangeImagenes} />

      {/* Notas */}
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Descripción / notas</p>
        <textarea
          value={form.otrasDescripciones}
          onChange={(e) => onChangeField("otrasDescripciones", e.target.value)}
          placeholder="Incluye estacionamiento, bodega, buenas vistas…"
          rows={2}
          className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)] resize-none"
          style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
        />
      </div>

      {/* Colaborador asignado — ADR-0013 (Fase C). Exclusivo del Manager:
          invisible para un Colaborador, no solo deshabilitado (ROL-UI-5). */}
      {esManager && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Colaborador asignado</p>
          <select
            value={form.asignadoAId}
            onChange={(e) => onChangeField("asignadoAId", e.target.value)}
            className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
          >
            <option value="">Sin asignar</option>
            {colaboradores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      )}

      {/* Propietario (solo en modo crear) */}
      {showPropietario && (
        <div className="border-t pt-4" style={{ borderColor: "var(--hw-border)" }}>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--hw-text-4)" }}>Propietario</p>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Nombre completo *</p>
              <input
                type="text"
                value={form.propietarioNombre}
                onChange={(e) => onChangeField("propietarioNombre", e.target.value)}
                placeholder="Juan Pérez Soto"
                className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
                style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
                autoComplete="name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>RUT *</p>
                <input
                  type="text"
                  value={form.propietarioRut}
                  onChange={(e) => { onChangeField("propietarioRut", e.target.value); }}
                  onBlur={onRutBlur}
                  placeholder="12.345.678-9"
                  className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
                  style={{
                    borderColor: rutError ? "var(--hw-danger)" : "var(--hw-border)",
                    background: "var(--hw-surface)",
                  }}
                  autoComplete="off"
                  inputMode="text"
                />
                {rutError && (
                  <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--hw-danger)" }}>
                    {rutError}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Correo</p>
                <input
                  type="email"
                  value={form.propietarioEmail}
                  onChange={(e) => onChangeField("propietarioEmail", e.target.value)}
                  placeholder="juan@mail.cl"
                  className="w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]"
                  style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)" }}
                  autoComplete="email"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Diagrama de vida del estado (solo lectura) ── */
function DiagramaEstado({
  estado,
  propiedadId,
  onCambioEstado,
}: {
  estado: string;
  propiedadId: string;
  onCambioEstado: () => void;
}) {
  const [activando,    startActivar]    = useTransition();
  const [desactivando, startDesactivar] = useTransition();
  const [err, setErr] = useState("");
  const router = useRouter();

  const nodos: { key: string; label: string; color: string }[] = [
    { key: "borrador",   label: "Borrador",   color: "var(--hw-text-4)" },
    { key: "disponible", label: "Disponible", color: "var(--hw-success)" },
    { key: "reservada",  label: "Reservada",  color: "var(--hw-warning)" },
    { key: "arrendada",  label: "Arrendada",  color: "var(--hw-primary)" },
  ];

  async function doActivar() {
    setErr("");
    startActivar(async () => {
      const res = await activarPropiedad(propiedadId);
      if (!res.ok) { setErr(res.error ?? "Error al activar."); return; }
      router.refresh();
      onCambioEstado();
    });
  }

  async function doDesactivar() {
    setErr("");
    startDesactivar(async () => {
      const res = await desactivarPropiedad(propiedadId);
      if (!res.ok) { setErr(res.error ?? "Error al desactivar."); return; }
      router.refresh();
      onCambioEstado();
    });
  }

  return (
    <div className="rounded-xl p-4" style={{ background: "var(--hw-surface-2)" }}>
      <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--hw-text-4)" }}>
        Ciclo de vida
      </p>

      {/* Diagrama de nodos */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {nodos.map((n, i) => {
          const isCurrent = estado === n.key;
          const isAuto    = n.key === "reservada" || n.key === "arrendada";
          return (
            <div key={n.key} className="flex items-center gap-1 shrink-0">
              <div
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                style={{
                  background: isCurrent ? n.color : "var(--hw-border)",
                  color:      isCurrent ? "white"  : "var(--hw-text-4)",
                  border:     isCurrent ? `2px solid ${n.color}` : "2px solid transparent",
                  opacity:    isAuto && !isCurrent ? 0.6 : 1,
                }}
              >
                {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
                {n.label}
                {isAuto && !isCurrent && (
                  <span className="text-[9px] font-normal opacity-70">auto</span>
                )}
              </div>
              {i < nodos.length - 1 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-[var(--hw-text-4)]" aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>

      {/* Acciones de transición */}
      <div className="mt-3 flex flex-wrap gap-2">
        {estado === "borrador" && (
          <button
            type="button"
            onClick={doActivar}
            disabled={activando}
            className="hw-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: activando ? "var(--hw-border-2)" : "var(--hw-success)" }}
          >
            {activando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
            Activar → Disponible
          </button>
        )}
        {estado === "disponible" && (
          <button
            type="button"
            onClick={doDesactivar}
            disabled={desactivando}
            className="hw-btn flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{
              background: desactivando ? "var(--hw-border-2)" : "var(--hw-surface-2)",
              color:      "var(--hw-text-3)",
              border:     "1.5px solid var(--hw-border)",
            }}
          >
            {desactivando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
            ← Volver a borrador
          </button>
        )}
        {(estado === "reservada" || estado === "arrendada") && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--hw-text-4)" }}>
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {estado === "reservada"
              ? "Propiedad reservada — tiene un contrato pendiente de firma."
              : "Propiedad arrendada — tiene un contrato vigente."}
          </p>
        )}
      </div>

      {err && (
        <p className="mt-2 text-xs font-medium" style={{ color: "var(--hw-danger)" }}>{err}</p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

export function PropiedadesClient({
  propiedades,
  esManager,
  colaboradores,
  cupo,
}: {
  propiedades: Propiedad[];
  esManager: boolean;
  colaboradores: Colaborador[];
  /** null para un Colaborador: no crea propiedades, el cupo no le aplica. */
  cupo: { usado: number; max: number; planLabel: string } | null;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda]         = useState("");
  const [filtro, setFiltro]             = useState<FiltroEstado>("todas");
  const [seleccionada, setSeleccionada] = useState<Propiedad | null>(null);
  const [dateFilter, setDateFilter]     = useState<DateFilterState>({ sort: "nuevas", range: "todos" });
  const [pageSize, setPageSize]         = useState(25);
  // El servidor rechaza igual el alta (lib/plan-limits.ts); deshabilitar el
  // botón evita mandar a alguien a llenar un formulario que ya sabemos que
  // va a fallar. El badge de al lado es el que explica por qué.
  const cupoLleno = cupo !== null && cupo.usado >= cupo.max;

  // Dialog "Nueva propiedad"
  const [openCrear, setOpenCrear]     = useState(false);
  const [formCrear, setFormCrear]     = useState<FormCrear>(FORM_CREAR_INICIAL);
  const [errorCrear, setErrorCrear]   = useState("");
  const [rutErrorCrear, setRutErrorCrear] = useState("");
  const [isPendingCrear, startCrear]  = useTransition();

  // Bajar propiedad a borrador desde el modal de detalle
  const [desactivandoModal, startDesactivarModal] = useTransition();
  const [errDesactivarModal, setErrDesactivarModal] = useState("");

  // Dialog "Editar propiedad"
  const [openEditar, setOpenEditar]   = useState(false);
  const [formEditar, setFormEditar]   = useState<FormProp>({
    tipo: "departamento", direccion: "", comuna: "", region: "",
    piezas: "", banos: "", m2Totales: "",
    m2Construidos: "", estacionamientos: "", plantas: "",
    antiguedadAnios: "", orientacion: "", esCondominio: false,
    pagaGastosComunes: false, valorGastosComunes: "",
    aceptaMascotas: false,
    otrasDescripciones: "", mostrarUbicacionExacta: false, imagenes: [""],
    asignadoAId: "",
  });
  const [errorEditar, setErrorEditar] = useState("");
  const [isPendingEditar, startEditar] = useTransition();

  /* ── helpers formularios ── */
  function setFieldCrear<K extends keyof FormCrear>(k: K, v: FormCrear[K]) {
    setFormCrear((f) => ({ ...f, [k]: v }));
  }
  function setFieldEditar<K extends keyof FormProp>(k: K, v: FormProp[K]) {
    setFormEditar((f) => ({ ...f, [k]: v }));
  }

  function handleRutBlurCrear() {
    const val = formCrear.propietarioRut.trim();
    if (!val) { setRutErrorCrear(""); return; }
    if (!validarRut(val)) {
      setRutErrorCrear("RUT inválido — verifique el dígito verificador.");
    } else {
      setRutErrorCrear("");
      setFieldCrear("propietarioRut", formatearRut(val));
    }
  }

  function handleCrearPropiedad() {
    setErrorCrear("");
    if (rutErrorCrear) return;
    if (formCrear.propietarioRut && !validarRut(formCrear.propietarioRut.trim())) {
      setRutErrorCrear("RUT inválido — verifique el dígito verificador.");
      return;
    }
    startCrear(async () => {
      const res = await crearPropiedad({
        tipo:              formCrear.tipo,
        direccion:         formCrear.direccion.trim(),
        comuna:            formCrear.comuna.trim()  || undefined,
        region:            formCrear.region.trim()  || undefined,
        piezas:            formCrear.piezas    ? parseInt(formCrear.piezas, 10)    : undefined,
        banos:             formCrear.banos     ? parseInt(formCrear.banos, 10)     : undefined,
        m2Totales:         formCrear.m2Totales ? parseFloat(formCrear.m2Totales)   : undefined,
        m2Construidos:     formCrear.m2Construidos    ? parseFloat(formCrear.m2Construidos)    : undefined,
        estacionamientos:  formCrear.estacionamientos ? parseInt(formCrear.estacionamientos, 10) : undefined,
        plantas:           formCrear.plantas          ? parseInt(formCrear.plantas, 10)          : undefined,
        antiguedadAnios:   formCrear.antiguedadAnios  ? parseInt(formCrear.antiguedadAnios, 10)   : undefined,
        orientacion:       formCrear.orientacion.trim() || undefined,
        esCondominio:      formCrear.esCondominio,
        pagaGastosComunes: formCrear.pagaGastosComunes,
        valorGastosComunes: formCrear.pagaGastosComunes && formCrear.valorGastosComunes
          ? parseFloat(formCrear.valorGastosComunes) : undefined,
        aceptaMascotas: formCrear.aceptaMascotas,
        otrasDescripciones: formCrear.otrasDescripciones.trim() || undefined,
        mostrarUbicacionExacta: formCrear.mostrarUbicacionExacta,
        propietarioNombre: formCrear.propietarioNombre.trim(),
        propietarioRut:    formCrear.propietarioRut.trim(),
        propietarioEmail:  formCrear.propietarioEmail.trim() || undefined,
        imagenes:          formCrear.imagenes.map((u) => u.trim()).filter(Boolean),
        // Solo el Manager envía este campo — para un Colaborador queda
        // undefined y el servidor lo trata como "no tocar" (defensa en profundidad).
        ...(esManager ? { asignadoAId: formCrear.asignadoAId } : {}),
      });
      if (!res.ok) { setErrorCrear(res.error); return; }
      setOpenCrear(false);
      setFormCrear(FORM_CREAR_INICIAL);
      setRutErrorCrear("");
      router.refresh();
    });
  }

  function handleDesactivarDesdeModal() {
    if (!seleccionada) return;
    setErrDesactivarModal("");
    startDesactivarModal(async () => {
      const res = await desactivarPropiedad(seleccionada.id);
      if (!res.ok) { setErrDesactivarModal(res.error ?? "Error al bajar la propiedad."); return; }
      setSeleccionada(null);
      router.refresh();
    });
  }

  function abrirEditar(p: Propiedad) {
    setFormEditar(formDesdePropiedad(p));
    setErrorEditar("");
    setOpenEditar(true);
  }

  function handleGuardarEdicion() {
    if (!seleccionada) return;
    setErrorEditar("");
    startEditar(async () => {
      const res = await actualizarPropiedad(seleccionada.id, {
        tipo:              formEditar.tipo,
        direccion:         formEditar.direccion.trim(),
        comuna:            formEditar.comuna.trim()  || undefined,
        region:            formEditar.region.trim()  || undefined,
        piezas:            formEditar.piezas    ? parseInt(formEditar.piezas, 10)    : undefined,
        banos:             formEditar.banos     ? parseInt(formEditar.banos, 10)     : undefined,
        m2Totales:         formEditar.m2Totales ? parseFloat(formEditar.m2Totales)   : undefined,
        m2Construidos:     formEditar.m2Construidos    ? parseFloat(formEditar.m2Construidos)    : undefined,
        estacionamientos:  formEditar.estacionamientos ? parseInt(formEditar.estacionamientos, 10) : undefined,
        plantas:           formEditar.plantas          ? parseInt(formEditar.plantas, 10)          : undefined,
        antiguedadAnios:   formEditar.antiguedadAnios  ? parseInt(formEditar.antiguedadAnios, 10)   : undefined,
        orientacion:       formEditar.orientacion.trim() || undefined,
        esCondominio:      formEditar.esCondominio,
        pagaGastosComunes: formEditar.pagaGastosComunes,
        valorGastosComunes: formEditar.pagaGastosComunes && formEditar.valorGastosComunes
          ? parseFloat(formEditar.valorGastosComunes) : undefined,
        aceptaMascotas: formEditar.aceptaMascotas,
        otrasDescripciones: formEditar.otrasDescripciones.trim() || undefined,
        mostrarUbicacionExacta: formEditar.mostrarUbicacionExacta,
        imagenes:          formEditar.imagenes.map((u) => u.trim()).filter(Boolean),
        ...(esManager ? { asignadoAId: formEditar.asignadoAId } : {}),
      });
      if (!res.ok) { setErrorEditar(res.error); return; }
      setOpenEditar(false);
      setSeleccionada(null);
      router.refresh();
    });
  }

  /* ── filtros y ordenamiento ── */
  const counts = useMemo(() => ({
    todas:      propiedades.length,
    borrador:   propiedades.filter((p) => p.estado === "borrador").length,
    disponible: propiedades.filter((p) => p.estado === "disponible").length,
    reservada:  propiedades.filter((p) => p.estado === "reservada").length,
    arrendada:  propiedades.filter((p) => p.estado === "arrendada").length,
  }), [propiedades]);

  const filtradas = useMemo(() => {
    let r = propiedades;
    if (filtro !== "todas") r = r.filter((p) => p.estado === filtro);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      r = r.filter((p) =>
        p.direccion.toLowerCase().includes(q) ||
        (p.comuna?.toLowerCase().includes(q) ?? false) ||
        TIPO_LABEL[p.tipo]?.toLowerCase().includes(q) ||
        p.propietario.nombre.toLowerCase().includes(q)
      );
    }
    return r;
  }, [propiedades, filtro, busqueda]);

  const propiedadesFinales = useMemo(() => {
    let r = [...filtradas];
    if (dateFilter.range === "recientes_p") r = r.filter((p) => (p.antiguedadAnios ?? 0) < 5);
    if (dateFilter.range === "maduras_p")   r = r.filter((p) => { const a = p.antiguedadAnios ?? 0; return a >= 5 && a <= 15; });
    if (dateFilter.range === "antiguas_p")  r = r.filter((p) => (p.antiguedadAnios ?? 0) > 15);
    r.sort((a, b) => {
      const va = a.antiguedadAnios ?? 0;
      const vb = b.antiguedadAnios ?? 0;
      return dateFilter.sort === "antiguas" ? vb - va : va - vb;
    });
    return r;
  }, [filtradas, dateFilter]);

  const pagina = propiedadesFinales.slice(0, pageSize);

  /* ── render ── */
  return (
    <>
      {/* ── Barra búsqueda + filtros ── */}
      <FilterToolbar
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sortOptions={SORT_OPTIONS_PROP}
        rangeOptions={RANGE_OPTIONS_PROP}
        defaultSort="nuevas"
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        searchPlaceholder="Buscar por dirección, tipo, propietario…"
        rightActions={
          // ADR-0013 (Fase D) — crear propiedad es exclusivo del Manager; un
          // Colaborador gestiona lo asignado, no crea inventario nuevo.
          esManager ? (
            <div className="flex items-center gap-2">
              {cupo && <CupoBadge usado={cupo.usado} max={cupo.max} unidad="propiedades" planLabel={cupo.planLabel} />}
              <button
                type="button"
                onClick={() => { setOpenCrear(true); setErrorCrear(""); setRutErrorCrear(""); setFormCrear(FORM_CREAR_INICIAL); }}
                className="hw-btn-primary"
                style={{ height: "32px", fontSize: "12px", padding: "0 12px" }}
                disabled={cupoLleno}
                title={cupoLleno ? "Alcanzaste el máximo de propiedades de tu plan. Sube de plan para cargar más." : undefined}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Nueva propiedad
              </button>
            </div>
          ) : undefined
        }
      >
        {FILTROS.map((f) => (
          <FilterChip
            key={f.key}
            label={f.label}
            count={counts[f.key]}
            active={filtro === f.key}
            activeColor={f.color ?? "var(--hw-primary-dk)"}
            onClick={() => setFiltro(f.key)}
          />
        ))}
      </FilterToolbar>

      {/* ── Grid de cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 hw-stagger">
        {pagina.map((p) => {
          const style    = TIPO_STYLE[p.tipo] ?? { bg: "var(--hw-surface-2)", text: "var(--hw-text-2)", initial: "P" };
          const miniatura = p.imagenes[0]?.url;
          return (
            <article
              key={p.id}
              className="hw-card hw-card-glow hw-sheen overflow-hidden"
              onClick={() => setSeleccionada(p)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSeleccionada(p); } }}
              tabIndex={0}
              aria-label={`${TIPO_LABEL[p.tipo] ?? p.tipo} en ${p.direccion}. Estado: ${p.estado}. Presiona Enter para ver detalle.`}
              style={{ cursor: "pointer", "--hw-card-glow": estadoStripColor(p.estado) } as React.CSSProperties}
            >
              {miniatura ? (
                <div className="h-32 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={miniatura} alt={`Foto de ${p.direccion}`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div
                  className="h-1 rounded-t-[14px]"
                  aria-hidden="true"
                  style={{ background: estadoStripColor(p.estado), boxShadow: `0 0 12px ${estadoStripColor(p.estado)}` }}
                />
              )}

              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold"
                    style={{ background: style.bg, color: style.text, boxShadow: `0 0 12px color-mix(in srgb, ${style.text} 30%, transparent)` }}
                  >
                    {style.initial}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={estadoTone(p.estado)} pulse={estadoPulse(p.estado)}>{p.estado}</Badge>
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--hw-text-4)]" />
                  </div>
                </div>
                <h3 className="mt-3 font-semibold text-[var(--hw-text-1)]">{TIPO_LABEL[p.tipo] ?? p.tipo}</h3>
                <p className="mt-1 flex items-center gap-1 text-sm text-[var(--hw-text-3)]">
                  <MapPin className="h-3 w-3 shrink-0 text-[var(--hw-text-4)]" />
                  {p.direccion}{p.comuna ? `, ${p.comuna}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-[var(--hw-text-4)]">Propietario: {p.propietario.nombre}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--hw-text-3)]">
                  {p.piezas    != null && <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5 text-[var(--hw-text-4)]" />{p.piezas} pieza{p.piezas !== 1 ? "s" : ""}</span>}
                  {p.banos     != null && <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5 text-[var(--hw-text-4)]" />{p.banos} baño{p.banos !== 1 ? "s" : ""}</span>}
                  {p.estacionamientos != null && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5 text-[var(--hw-text-4)]" />{p.estacionamientos}</span>}
                  {p.m2Totales != null && <span>{p.m2Totales} m²</span>}
                </div>
                {p.pagaGastosComunes && p.valorGastosComunes != null && (
                  <div className="mt-3 flex items-center justify-between rounded-lg px-3 py-1.5 text-xs" style={{ background: "var(--hw-surface-2)" }}>
                    <span className="text-[var(--hw-text-3)]">Gasto común</span>
                    <span className="font-semibold text-[var(--hw-text-2)]">{clp(p.valorGastosComunes)}</span>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {pagina.length === 0 && (
          <div className="col-span-full hw-card p-10 text-center text-sm text-[var(--hw-text-4)]">
            {busqueda ? `No se encontraron propiedades para "${busqueda}".` : "No hay propiedades en este estado."}
          </div>
        )}
      </div>

      {/* Footer paginación */}
      {propiedadesFinales.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs text-[var(--hw-text-4)]">
            {pagina.length} de {propiedadesFinales.length} propiedad{propiedadesFinales.length !== 1 ? "es" : ""}
          </span>
          <PageSizePicker value={pageSize} onChange={setPageSize} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Modal de detalle
      ══════════════════════════════════════════════════ */}
      <Dialog
        open={seleccionada !== null && !openEditar}
        onOpenChange={(open) => { if (!open) setSeleccionada(null); }}
      >
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden gap-0" showCloseButton={false}>
          {seleccionada && (
            <>
              <div aria-hidden="true" className="h-1.5" style={{ background: estadoStripColor(seleccionada.estado) }} />

              <div className="max-h-[85vh] overflow-y-auto p-6">
                {/* Header */}
                <DialogHeader className="mb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          className="rounded-lg px-2 py-0.5 text-xs font-semibold"
                          style={{ background: TIPO_STYLE[seleccionada.tipo]?.bg ?? "var(--hw-surface-2)", color: TIPO_STYLE[seleccionada.tipo]?.text ?? "var(--hw-text-3)" }}
                        >
                          {TIPO_LABEL[seleccionada.tipo] ?? seleccionada.tipo}
                        </span>
                        <Badge tone={estadoTone(seleccionada.estado)} pulse={estadoPulse(seleccionada.estado)}>{seleccionada.estado}</Badge>
                      </div>
                      <DialogTitle className="text-lg font-bold" style={{ color: "var(--hw-text-1)" }}>
                        {seleccionada.direccion}
                      </DialogTitle>
                      {seleccionada.comuna && (
                        <DialogDescription className="mt-0.5 flex items-center gap-1 text-sm" style={{ color: "var(--hw-text-3)" }}>
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {seleccionada.comuna}{seleccionada.region ? `, ${seleccionada.region}` : ""}
                        </DialogDescription>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSeleccionada(null)}
                      aria-label="Cerrar detalle de propiedad"
                      className="hw-btn shrink-0 rounded-lg p-1.5"
                      style={{ color: "var(--hw-text-4)" }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </DialogHeader>

                {/* Galería */}
                {seleccionada.imagenes.length > 0 && (
                  <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                    {seleccionada.imagenes.map((img, i) => (
                      <div key={i} className="h-28 w-44 shrink-0 overflow-hidden rounded-xl" style={{ background: "var(--hw-surface-2)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Amenities */}
                <div className="mb-5 grid grid-cols-3 gap-2" aria-label="Características">
                  {[
                    { icon: <BedDouble className="h-4 w-4" aria-hidden="true" />, label: "Piezas",  val: seleccionada.piezas },
                    { icon: <Bath      className="h-4 w-4" aria-hidden="true" />, label: "Baños",   val: seleccionada.banos },
                    { icon: <Car       className="h-4 w-4" aria-hidden="true" />, label: "Estac.",  val: seleccionada.estacionamientos },
                  ].map(({ icon, label, val }) => (
                    <div key={label} className="flex flex-col items-center rounded-xl py-3 text-center" style={{ background: "var(--hw-surface-2)" }}>
                      <span style={{ color: "var(--hw-text-4)" }}>{icon}</span>
                      <span className="mt-1 text-xl font-bold hw-num" style={{ color: "var(--hw-text-1)" }}>{val ?? "—"}</span>
                      <span className="text-[10px]" style={{ color: "var(--hw-text-4)" }}>{label}</span>
                    </div>
                  ))}
                </div>

                {/* Datos */}
                <dl className="mb-5 grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Propietario",    value: seleccionada.propietario.nombre },
                    { label: "Orientación",    value: seleccionada.orientacion ?? "—" },
                    { label: "M² construidos", value: seleccionada.m2Construidos != null ? `${seleccionada.m2Construidos} m²` : "—" },
                    { label: "M² totales",     value: seleccionada.m2Totales != null ? `${seleccionada.m2Totales} m²` : "—" },
                    { label: "Antigüedad",     value: seleccionada.antiguedadAnios != null ? `${seleccionada.antiguedadAnios} años` : "—" },
                    { label: "Plantas",        value: seleccionada.plantas != null ? String(seleccionada.plantas) : "—" },
                    { label: "¿Condominio?",   value: seleccionada.esCondominio ? "Sí" : "No" },
                    { label: "Contratos",      value: String(seleccionada._count.contratos) },
                    { label: "Colaborador asignado", value: seleccionada.asignadoA?.nombre ?? "Sin asignar" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)" }}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>{label}</dt>
                      <dd className="mt-0.5 text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>{value}</dd>
                    </div>
                  ))}
                </dl>

                {/* GC */}
                {seleccionada.pagaGastosComunes && seleccionada.valorGastosComunes != null && (
                  <div className="mb-4 flex items-center justify-between rounded-xl p-4" style={{ background: "var(--hw-surface-2)" }}>
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--hw-text-2)" }}>
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" style={{ color: "var(--hw-primary)" }} />
                      Gasto común mensual
                    </div>
                    <span className="text-lg font-bold hw-num" style={{ color: "var(--hw-text-1)" }}>
                      {clp(seleccionada.valorGastosComunes)}
                    </span>
                  </div>
                )}

                {/* Descripción */}
                {seleccionada.otrasDescripciones && (
                  <div className="mb-4 rounded-xl p-4" style={{ background: "var(--hw-surface-2)" }}>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>Descripción</p>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--hw-text-2)" }}>{seleccionada.otrasDescripciones}</p>
                  </div>
                )}

                {/* ── Acciones (pie del modal) ── */}
                <div className="border-t pt-4 space-y-2" style={{ borderColor: "var(--hw-border)" }}>
                  {seleccionada.estado === "borrador" ? (
                    <button
                      type="button"
                      onClick={() => abrirEditar(seleccionada)}
                      className="hw-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
                      style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-2)" }}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar propiedad
                    </button>
                  ) : seleccionada.estado === "disponible" ? (
                    <div className="space-y-2">
                      <div
                        className="rounded-xl px-4 py-3 text-xs leading-relaxed"
                        style={{ background: "var(--hw-primary-lt)", border: "1px solid var(--hw-primary-bd)", color: "var(--hw-primary-dk)" }}
                      >
                        <strong>Para editar esta propiedad</strong> primero debes bajarla a Borrador.
                        Esto la retira temporalmente del marketplace público.
                      </div>
                      <button
                        type="button"
                        onClick={handleDesactivarDesdeModal}
                        disabled={desactivandoModal}
                        className="hw-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
                        style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-2)" }}
                      >
                        {desactivandoModal
                          ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Bajando…</>
                          : <><RotateCcw className="h-4 w-4" aria-hidden="true" />Bajar a Borrador y editar</>}
                      </button>
                      {errDesactivarModal && (
                        <p className="text-xs font-medium" style={{ color: "var(--hw-danger)" }}>{errDesactivarModal}</p>
                      )}
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm"
                      style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-4)" }}
                    >
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      No editable —{" "}
                      {seleccionada.estado === "reservada"
                        ? "tiene un contrato pendiente de firma."
                        : "tiene un contrato vigente."}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════
          Dialog: Editar propiedad
      ══════════════════════════════════════════════════ */}
      <Dialog
        open={openEditar && seleccionada !== null}
        onOpenChange={(o) => { if (!o) setOpenEditar(false); }}
      >
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden gap-0" showCloseButton={false}>
          <div className="max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="mb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg font-bold" style={{ color: "var(--hw-text-1)" }}>
                    Editar propiedad
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm" style={{ color: "var(--hw-text-3)" }}>
                    {seleccionada?.direccion}
                  </DialogDescription>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenEditar(false)}
                  aria-label="Cerrar editor"
                  className="hw-btn shrink-0 rounded-lg p-1.5"
                  style={{ color: "var(--hw-text-4)" }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </DialogHeader>

            {/* Diagrama de ciclo de vida */}
            {seleccionada && (
              <div className="mb-5">
                <DiagramaEstado
                  estado={seleccionada.estado}
                  propiedadId={seleccionada.id}
                  onCambioEstado={() => { setOpenEditar(false); setSeleccionada(null); }}
                />
              </div>
            )}

            {errorEditar && (
              <div
                className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                role="alert"
                aria-live="assertive"
                style={{ background: "var(--hw-danger-lt)", color: "var(--hw-danger)" }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {errorEditar}
              </div>
            )}

            {/* Campos (sin propietario en edición) */}
            <CamposProp
              form={formEditar as FormCrear}
              rutError=""
              showPropietario={false}
              esManager={esManager}
              colaboradores={colaboradores}
              onChangeField={(k, v) => setFieldEditar(k as keyof FormProp, v as never)}
              onChangeImagenes={(imgs) => setFieldEditar("imagenes", imgs)}
              onRutBlur={() => {}}
            />

            {/* Botones */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpenEditar(false)}
                disabled={isPendingEditar}
                className="hw-btn rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-3)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarEdicion}
                disabled={isPendingEditar}
                className="hw-btn flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white"
                style={{ background: isPendingEditar ? "var(--hw-border-2)" : "var(--hw-primary)" }}
              >
                {isPendingEditar ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Guardando…</>
                ) : (
                  "Guardar cambios"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════
          Dialog: Nueva propiedad
      ══════════════════════════════════════════════════ */}
      <Dialog open={openCrear} onOpenChange={(o) => { if (!o) { setOpenCrear(false); setRutErrorCrear(""); } }}>
        <DialogContent className="sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden gap-0" showCloseButton={false}>
          <div className="max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="mb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg font-bold" style={{ color: "var(--hw-text-1)" }}>
                    Nueva propiedad
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-sm" style={{ color: "var(--hw-text-3)" }}>
                    Se creará en estado <strong>borrador</strong>. Debes activarla para que sea visible.
                  </DialogDescription>
                </div>
                <button
                  type="button"
                  onClick={() => { setOpenCrear(false); setRutErrorCrear(""); }}
                  aria-label="Cerrar formulario"
                  className="hw-btn shrink-0 rounded-lg p-1.5"
                  style={{ color: "var(--hw-text-4)" }}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </DialogHeader>

            {errorCrear && (
              <div
                className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                role="alert"
                aria-live="assertive"
                style={{ background: "var(--hw-danger-lt)", color: "var(--hw-danger)" }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                {errorCrear}
              </div>
            )}

            <CamposProp
              form={formCrear}
              rutError={rutErrorCrear}
              showPropietario={true}
              esManager={esManager}
              colaboradores={colaboradores}
              onChangeField={(k, v) => { setFieldCrear(k as keyof FormCrear, v as never); if (k === "propietarioRut" && rutErrorCrear) setRutErrorCrear(""); }}
              onChangeImagenes={(imgs) => setFieldCrear("imagenes", imgs)}
              onRutBlur={handleRutBlurCrear}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setOpenCrear(false); setRutErrorCrear(""); }}
                disabled={isPendingCrear}
                className="hw-btn rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-3)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCrearPropiedad}
                disabled={isPendingCrear || !!rutErrorCrear}
                className="hw-btn flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white"
                style={{ background: isPendingCrear || rutErrorCrear ? "var(--hw-border-2)" : "var(--hw-primary)" }}
              >
                {isPendingCrear ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Guardando…</>
                ) : (
                  "Crear propiedad"
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
