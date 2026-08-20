"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check, ChevronRight, Search, X, AlertCircle,
  Building2, Users, DollarSign, Calendar, Loader2,
} from "lucide-react";
import { generarCalendario, validarRut, formatearRut } from "@housing/core";
import { fecha, cantidad } from "@/lib/format";
import { buscarPersonas, crearContrato } from "./actions";
import type { PersonaBusqueda } from "./actions";

/* ─────────────────────── Types ─────────────────────────────── */

export type PropiedadItem = {
  id: string;
  tipo: string;
  estado: string;
  direccion: string;
  comuna: string | null;
  propietarioId: string;
  propietarioNombre: string;
};

type WizardData = {
  /* Paso 1 */
  propiedadId: string;
  propietarioId: string;
  propiedadDireccion: string;
  propiedadTipo: string;
  /* Paso 2 */
  arrendatarioId: string;
  arrendatarioLabel: string;
  modoArr: "buscar" | "nuevo";
  nuevoNombre: string;
  nuevoRut: string;
  nuevoEmail: string;
  /* Paso 3 */
  denominacion: "UF" | "CLP";
  valorArriendo: string;
  diaVencimiento: string;
  comisionCorredorPct: string;
  reajuste: "anual" | "ninguna";
  moraTasaPct: string;
  moraDiasGracia: string;
  cobraGastoComun: boolean;
  montoGastoComun: string;
  /* Paso 4 */
  fechaInicio: string;
  tipoVigencia: "indefinido" | "fijo";
  fechaFin: string;
  garantiaMeses: "0" | "1" | "2";
  /** Denominación del MONTO de garantía. Independiente de la del arriendo:
   * se puede pactar el arriendo en UF y la garantía en un monto CLP fijo, o
   * viceversa. Por defecto sigue a la del contrato (lo más habitual). */
  garantiaDenominacion: "UF" | "CLP";
  /** Monto de garantía en la denominación elegida (nº de UF, o pesos). */
  garantiaMonto: string;
};

const INITIAL: WizardData = {
  propiedadId: "", propietarioId: "", propiedadDireccion: "", propiedadTipo: "",
  arrendatarioId: "", arrendatarioLabel: "", modoArr: "buscar",
  nuevoNombre: "", nuevoRut: "", nuevoEmail: "",
  denominacion: "UF", valorArriendo: "", diaVencimiento: "5",
  comisionCorredorPct: "50", reajuste: "anual",
  moraTasaPct: "3", moraDiasGracia: "5",
  cobraGastoComun: false, montoGastoComun: "",
  fechaInicio: "", tipoVigencia: "indefinido", fechaFin: "",
  garantiaMeses: "0", garantiaDenominacion: "UF", garantiaMonto: "",
};

const TIPO_LABEL: Record<string, string> = {
  casa: "Casa", departamento: "Departamento", cabana: "Cabaña",
};

/* ─────────────────────── Helpers ───────────────────────────── */

function FieldRow({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
        {label}
      </p>
      {children}
      {hint && (
        <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>{hint}</p>
      )}
    </div>
  );
}

function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, style, ...rest } = p;
  return (
    <input
      {...rest}
      className={`w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)] ${className ?? ""}`}
      style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)", ...style }}
    />
  );
}

function RadioPill<T extends string>({
  name, options, value, onChange,
}: {
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
            style={{
              background: active ? "var(--hw-primary-lt)" : "var(--hw-surface-2)",
              color:      active ? "var(--hw-primary)"    : "var(--hw-text-3)",
              border:     `1.5px solid ${active ? "var(--hw-primary)" : "transparent"}`,
            }}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={active}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {active && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Paso 1: Propiedad ─────────────────── */

function Step1({
  propiedades, propiedadId, onSelect,
}: {
  propiedades: PropiedadItem[];
  propiedadId: string;
  onSelect: (p: PropiedadItem) => void;
}) {
  const [q, setQ] = useState("");

  const filtradas = useMemo(() => {
    if (!q.trim()) return propiedades;
    const lo = q.toLowerCase();
    return propiedades.filter(
      (p) =>
        p.direccion.toLowerCase().includes(lo) ||
        (p.comuna?.toLowerCase().includes(lo) ?? false) ||
        TIPO_LABEL[p.tipo]?.toLowerCase().includes(lo) ||
        p.propietarioNombre.toLowerCase().includes(lo),
    );
  }, [propiedades, q]);

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold" style={{ color: "var(--hw-text-1)" }}>
        Selecciona la propiedad
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--hw-text-3)" }}>
        Solo se muestran propiedades disponibles o reservadas.
      </p>

      {propiedades.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "var(--hw-surface-2)" }}>
          <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>
            No hay propiedades disponibles.{" "}
            <Link
              href="/panel/propiedades"
              className="font-semibold underline"
              style={{ color: "var(--hw-primary)" }}
            >
              Crea una en Propiedades →
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="relative mb-3">
            <Search
              className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              style={{ color: "var(--hw-text-4)" }}
              aria-hidden="true"
            />
            <TextInput
              type="text"
              placeholder="Buscar por dirección, tipo, propietario…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 pr-8"
              aria-label="Buscar propiedad"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Limpiar búsqueda"
                className="hw-btn absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--hw-text-4)" }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {filtradas.map((p) => {
              const selected = propiedadId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p)}
                  aria-pressed={selected}
                  className="hw-btn w-full rounded-xl px-4 py-3 text-left"
                  style={{
                    background: selected ? "var(--hw-primary-lt)" : "var(--hw-surface-2)",
                    border:     `1.5px solid ${selected ? "var(--hw-primary)" : "transparent"}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: "var(--hw-text-1)" }}
                      >
                        {TIPO_LABEL[p.tipo] ?? p.tipo} — {p.direccion}
                        {p.comuna ? `, ${p.comuna}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
                        Propietario: {p.propietarioNombre} · Estado: {p.estado}
                      </p>
                    </div>
                    {selected && (
                      <Check
                        className="h-4 w-4 shrink-0"
                        style={{ color: "var(--hw-primary)" }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </button>
              );
            })}

            {filtradas.length === 0 && (
              <p className="py-6 text-center text-sm" style={{ color: "var(--hw-text-4)" }}>
                Sin resultados para &ldquo;{q}&rdquo;
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Formulario nuevo arrendatario (con validación RUT) ──────── */

function NuevoArrendatarioForm({
  nombre, rut, email, onChangeNuevo,
}: {
  nombre: string;
  rut: string;
  email: string;
  onChangeNuevo: (field: "nombre" | "rut" | "email", value: string) => void;
}) {
  const [rutError, setRutError] = useState("");

  function handleRutBlur() {
    const val = rut.trim();
    if (!val) { setRutError(""); return; }
    if (!validarRut(val)) {
      setRutError("RUT inválido — verifique el dígito verificador.");
    } else {
      setRutError("");
      onChangeNuevo("rut", formatearRut(val));
    }
  }

  return (
    <div className="space-y-4">
      <FieldRow label="Nombre completo *">
        <TextInput
          type="text"
          value={nombre}
          onChange={(e) => onChangeNuevo("nombre", e.target.value)}
          placeholder="María González Fuentes"
          autoComplete="name"
        />
      </FieldRow>
      <FieldRow label="RUT *" hint="Formato: 12.345.678-9">
        <TextInput
          type="text"
          value={rut}
          onChange={(e) => { onChangeNuevo("rut", e.target.value); if (rutError) setRutError(""); }}
          onBlur={handleRutBlur}
          placeholder="12.345.678-9"
          autoComplete="off"
          inputMode="text"
          style={{
            borderColor: rutError ? "var(--hw-danger)" : "var(--hw-border)",
            background: "var(--hw-surface)",
          }}
        />
        {rutError && (
          <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--hw-danger)" }}>
            {rutError}
          </p>
        )}
      </FieldRow>
      <FieldRow label="Correo electrónico">
        <TextInput
          type="email"
          value={email}
          onChange={(e) => onChangeNuevo("email", e.target.value)}
          placeholder="maria@ejemplo.cl"
          autoComplete="email"
        />
      </FieldRow>
    </div>
  );
}

/* ─────────────────────── Paso 2: Arrendatario ──────────────── */

function Step2({
  modo, arrendatarioId, arrendatarioLabel,
  busqueda, resultados, buscando,
  nuevoNombre, nuevoRut, nuevoEmail,
  onChangeBusqueda, onSelectPersona, onClearSeleccion,
  onSetModo, onChangeNuevo,
}: {
  modo: "buscar" | "nuevo";
  arrendatarioId: string;
  arrendatarioLabel: string;
  busqueda: string;
  resultados: PersonaBusqueda[];
  buscando: boolean;
  nuevoNombre: string;
  nuevoRut: string;
  nuevoEmail: string;
  onChangeBusqueda: (q: string) => void;
  onSelectPersona: (p: PersonaBusqueda) => void;
  onClearSeleccion: () => void;
  onSetModo: (m: "buscar" | "nuevo") => void;
  onChangeNuevo: (field: "nombre" | "rut" | "email", value: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold" style={{ color: "var(--hw-text-1)" }}>
        Arrendatario
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--hw-text-3)" }}>
        Busca una persona existente por RUT o nombre, o registra una nueva.
      </p>

      {/* Selector de modo */}
      <div className="mb-4 flex gap-2">
        {(["buscar", "nuevo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSetModo(m)}
            aria-pressed={modo === m}
            className="hw-btn rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{
              background: modo === m ? "var(--hw-primary)" : "var(--hw-surface-2)",
              color:      modo === m ? "white"             : "var(--hw-text-3)",
            }}
          >
            {m === "buscar" ? "Buscar existente" : "Nuevo arrendatario"}
          </button>
        ))}
      </div>

      {modo === "buscar" ? (
        arrendatarioId ? (
          /* Persona ya seleccionada */
          <div
            className="flex items-center justify-between rounded-xl px-4 py-3"
            style={{
              background: "var(--hw-success-lt)",
              border: "1.5px solid var(--hw-success)",
            }}
          >
            <div
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: "var(--hw-success)" }}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {arrendatarioLabel}
            </div>
            <button
              type="button"
              onClick={onClearSeleccion}
              aria-label="Cambiar arrendatario"
              className="hw-btn rounded-lg p-1"
              style={{ color: "var(--hw-text-4)" }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          /* Búsqueda */
          <>
            <div className="relative mb-2">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--hw-text-4)" }}
                aria-hidden="true"
              />
              <TextInput
                type="text"
                placeholder="Nombre o RUT (mínimo 2 caracteres)…"
                value={busqueda}
                onChange={(e) => onChangeBusqueda(e.target.value)}
                className="pl-9"
                aria-label="Buscar arrendatario"
                autoComplete="off"
              />
              {buscando && (
                <Loader2
                  className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin"
                  style={{ color: "var(--hw-text-4)" }}
                  aria-hidden="true"
                />
              )}
            </div>

            {resultados.length > 0 && (
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: "var(--hw-border)" }}
              >
                {resultados.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPersona(p)}
                    className="hw-btn w-full px-4 py-2.5 text-left text-sm"
                    style={{
                      background:   "var(--hw-surface)",
                      borderTop:    i > 0 ? `1px solid var(--hw-border)` : "none",
                      display:      "block",
                    }}
                  >
                    <span className="font-medium" style={{ color: "var(--hw-text-1)" }}>
                      {p.nombre}
                    </span>
                    <span className="ml-2 text-xs hw-num" style={{ color: "var(--hw-text-4)" }}>
                      {p.rut}
                    </span>
                    {p.email && (
                      <span className="ml-2 text-xs" style={{ color: "var(--hw-text-4)" }}>
                        · {p.email}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {busqueda.length >= 2 && resultados.length === 0 && !buscando && (
              <p className="mt-2 text-xs" style={{ color: "var(--hw-text-4)" }}>
                No se encontró ninguna persona.{" "}
                <button
                  type="button"
                  onClick={() => onSetModo("nuevo")}
                  className="font-semibold underline"
                  style={{ color: "var(--hw-primary)" }}
                >
                  Registrar nuevo arrendatario
                </button>
              </p>
            )}
          </>
        )
      ) : (
        /* Formulario nuevo */
        <NuevoArrendatarioForm
          nombre={nuevoNombre}
          rut={nuevoRut}
          email={nuevoEmail}
          onChangeNuevo={onChangeNuevo}
        />
      )}
    </div>
  );
}

/* ─────────────────────── Paso 3: Condiciones ───────────────── */

function Step3({
  data,
  set,
}: {
  data: WizardData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (k: keyof WizardData, v: any) => void;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold" style={{ color: "var(--hw-text-1)" }}>
        Condiciones financieras
      </h2>
      <p className="mb-5 text-sm" style={{ color: "var(--hw-text-3)" }}>
        Define monto, moneda y política de cobro.
      </p>

      <div className="space-y-5">
        {/* Moneda */}
        <FieldRow label="Moneda">
          <RadioPill
            name="denominacion"
            options={[
              { value: "UF",  label: "UF — indexado IPC" },
              { value: "CLP", label: "CLP — peso chileno" },
            ]}
            value={data.denominacion}
            onChange={(v) => set("denominacion", v)}
          />
        </FieldRow>

        <div className="grid grid-cols-2 gap-4">
          <FieldRow label={`Valor arriendo (${data.denominacion}) *`}>
            <TextInput
              type="number"
              inputMode="decimal"
              value={data.valorArriendo}
              onChange={(e) => set("valorArriendo", e.target.value)}
              placeholder={data.denominacion === "UF" ? "24.50" : "350000"}
              min="0"
              step={data.denominacion === "UF" ? "0.01" : "1000"}
            />
          </FieldRow>

          <FieldRow label="Día de vencimiento *" hint="Entre 1 y 28">
            <TextInput
              type="number"
              inputMode="numeric"
              value={data.diaVencimiento}
              onChange={(e) => set("diaVencimiento", e.target.value)}
              placeholder="5"
              min="1"
              max="28"
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Comisión corredor (%)" hint="% de cada período liquidado (fee de administración mensual)">
            <TextInput
              type="number"
              inputMode="decimal"
              value={data.comisionCorredorPct}
              onChange={(e) => set("comisionCorredorPct", e.target.value)}
              placeholder="50"
              min="0"
              max="100"
              step="0.5"
            />
          </FieldRow>

          <FieldRow label="Reajuste">
            <RadioPill
              name="reajuste"
              options={[
                { value: "anual",   label: "IPC anual" },
                { value: "ninguna", label: "Sin reajuste" },
              ]}
              value={data.reajuste}
              onChange={(v) => set("reajuste", v)}
            />
          </FieldRow>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FieldRow label="Tasa de mora (%/mes)" hint="Se aplica tras días de gracia">
            <TextInput
              type="number"
              inputMode="decimal"
              value={data.moraTasaPct}
              onChange={(e) => set("moraTasaPct", e.target.value)}
              placeholder="3"
              min="0"
              step="0.5"
            />
          </FieldRow>

          <FieldRow label="Días de gracia">
            <TextInput
              type="number"
              inputMode="numeric"
              value={data.moraDiasGracia}
              onChange={(e) => set("moraDiasGracia", e.target.value)}
              placeholder="5"
              min="0"
              max="30"
            />
          </FieldRow>
        </div>

        {/* Gasto común */}
        <div className="rounded-xl p-4" style={{ background: "var(--hw-surface-2)" }}>
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={data.cobraGastoComun}
              onChange={(e) => set("cobraGastoComun", e.target.checked)}
              className="h-4 w-4 rounded accent-blue-600"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--hw-text-1)" }}>
                Cobra gasto común
              </p>
              <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
                El corredor recauda el GC y lo traslada al propietario (passthrough)
              </p>
            </div>
          </label>
          {data.cobraGastoComun && (
            <div className="mt-3 pl-7">
              <FieldRow label="Monto gasto común (CLP) *">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  value={data.montoGastoComun}
                  onChange={(e) => set("montoGastoComun", e.target.value)}
                  placeholder="45000"
                  min="1"
                />
              </FieldRow>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── Paso 4: Vigencia ──────────────────── */

type PeriodoPreview = {
  numero: number;
  fechaVencimiento: Date;
  montoBase: number;
  montoGastoComun: number;
};

function Step4({
  data,
  set,
  preview,
}: {
  data: WizardData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set: (k: keyof WizardData, v: any) => void;
  preview: PeriodoPreview[];
}) {
  // La sugerencia (meses × arriendo) solo aplica cuando la garantía se pacta
  // en la MISMA unidad que el arriendo: ahí es una multiplicación directa. Si
  // difieren (arriendo UF, garantía CLP), convertir exigiría el valor UF del
  // día, que no vive en el cliente — se deja sin sugerencia en ese caso.
  const sugerenciaGarantia =
    data.garantiaDenominacion === data.denominacion && data.valorArriendo && data.garantiaMeses !== "0"
      ? parseFloat(data.valorArriendo) * parseInt(data.garantiaMeses, 10)
      : null;
  const sugerenciaGarantiaTxt =
    sugerenciaGarantia === null
      ? null
      : data.garantiaDenominacion === "UF"
        ? `${sugerenciaGarantia.toLocaleString("es-CL", { maximumFractionDigits: 2 })} UF`
        : `$${sugerenciaGarantia.toLocaleString("es-CL")}`;

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold" style={{ color: "var(--hw-text-1)" }}>
        Garantía y vigencia
      </h2>
      <p className="mb-5 text-sm" style={{ color: "var(--hw-text-3)" }}>
        Define las fechas de inicio, duración y garantía del contrato.
      </p>

      <div className="space-y-5">
        {/* Fecha inicio */}
        <FieldRow label="Fecha de inicio *">
          <TextInput
            type="date"
            value={data.fechaInicio}
            onChange={(e) => set("fechaInicio", e.target.value)}
          />
        </FieldRow>

        {/* Tipo de vigencia */}
        <FieldRow label="Duración">
          <RadioPill
            name="tipoVigencia"
            options={[
              { value: "indefinido", label: "Indefinida (12 períodos)" },
              { value: "fijo",       label: "Plazo fijo" },
            ]}
            value={data.tipoVigencia}
            onChange={(v) => set("tipoVigencia", v)}
          />
        </FieldRow>

        {data.tipoVigencia === "fijo" && (
          <FieldRow label="Fecha de término *">
            <TextInput
              type="date"
              value={data.fechaFin}
              onChange={(e) => set("fechaFin", e.target.value)}
              min={data.fechaInicio || undefined}
            />
          </FieldRow>
        )}

        {/* Garantía */}
        <FieldRow label="Meses de garantía" hint="Hasta 2 meses — práctica de mercado recomendada">
          <div className="flex gap-2">
            {(["0", "1", "2"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => set("garantiaMeses", m)}
                aria-pressed={data.garantiaMeses === m}
                className="hw-btn flex-1 rounded-xl py-2 text-sm font-semibold"
                style={{
                  background: data.garantiaMeses === m ? "var(--hw-primary)" : "var(--hw-surface-2)",
                  color:      data.garantiaMeses === m ? "white"             : "var(--hw-text-3)",
                }}
              >
                {m === "0" ? "Sin garantía" : `${m} mes${m === "2" ? "es" : ""}`}
              </button>
            ))}
          </div>
        </FieldRow>

        {data.garantiaMeses !== "0" && (
          <FieldRow
            label="Monto de la garantía *"
            hint={
              sugerenciaGarantiaTxt
                ? `Sugerido: ${sugerenciaGarantiaTxt} (${data.garantiaMeses} × arriendo)`
                : data.garantiaDenominacion === "UF"
                  ? "En UF — se restituye reajustada a la UF del día de término"
                  : "Monto fijo en pesos chilenos"
            }
          >
            <div className="flex gap-2">
              {/* Selector de unidad de la garantía */}
              <div className="flex shrink-0 gap-1">
                {(["UF", "CLP"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set("garantiaDenominacion", u)}
                    aria-pressed={data.garantiaDenominacion === u}
                    className="hw-btn rounded-xl px-3 text-sm font-semibold"
                    style={{
                      background: data.garantiaDenominacion === u ? "var(--hw-primary)" : "var(--hw-surface-2)",
                      color:      data.garantiaDenominacion === u ? "white"             : "var(--hw-text-3)",
                    }}
                  >
                    {u}
                  </button>
                ))}
              </div>
              <TextInput
                type="number"
                inputMode="decimal"
                value={data.garantiaMonto}
                onChange={(e) => set("garantiaMonto", e.target.value)}
                placeholder={
                  sugerenciaGarantia !== null
                    ? String(sugerenciaGarantia)
                    : data.garantiaDenominacion === "UF" ? "20" : "350000"
                }
                min="0"
                step={data.garantiaDenominacion === "UF" ? "0.01" : "1"}
              />
            </div>
          </FieldRow>
        )}

        {/* Vista previa del calendario */}
        {preview.length > 0 && (
          <div>
            <p
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--hw-text-4)" }}
            >
              Vista previa: primeros {cantidad(preview.length, "período", "períodos")}
            </p>
            <div
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--hw-border)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--hw-surface-2)" }}>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--hw-text-4)" }}>
                      Período
                    </th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold" style={{ color: "var(--hw-text-4)" }}>
                      Vencimiento
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--hw-text-4)" }}>
                      Arriendo
                    </th>
                    {data.cobraGastoComun && (
                      <th scope="col" className="px-3 py-2 text-right text-xs font-semibold" style={{ color: "var(--hw-text-4)" }}>
                        GC
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p, i) => (
                    <tr
                      key={p.numero}
                      style={{ borderTop: i > 0 ? "1px solid var(--hw-border)" : "none" }}
                    >
                      <td className="px-3 py-2 hw-num font-medium" style={{ color: "var(--hw-text-2)" }}>
                        #{p.numero}
                      </td>
                      <td className="px-3 py-2 hw-num text-xs" style={{ color: "var(--hw-text-3)" }}>
                        {fecha(p.fechaVencimiento)}
                      </td>
                      <td className="px-3 py-2 hw-num text-right font-medium" style={{ color: "var(--hw-text-1)" }}>
                        {data.denominacion === "UF"
                          ? `${p.montoBase.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`
                          : p.montoBase.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
                      </td>
                      {data.cobraGastoComun && (
                        <td className="px-3 py-2 hw-num text-right text-xs" style={{ color: "var(--hw-text-3)" }}>
                          {p.montoGastoComun.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.tipoVigencia === "indefinido" && (
              <p className="mt-1.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
                Se generarán 12 períodos en total. El sistema avisará al corredor cuando queden menos de 90 días de períodos disponibles.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Main: NuevoContratoClient ─────────── */

const STEPS = [
  { n: 1, label: "Propiedad",    icon: <Building2  className="h-3.5 w-3.5" aria-hidden="true" /> },
  { n: 2, label: "Arrendatario", icon: <Users      className="h-3.5 w-3.5" aria-hidden="true" /> },
  { n: 3, label: "Condiciones",  icon: <DollarSign className="h-3.5 w-3.5" aria-hidden="true" /> },
  { n: 4, label: "Vigencia",     icon: <Calendar   className="h-3.5 w-3.5" aria-hidden="true" /> },
] as const;

export function NuevoContratoClient({ propiedades }: { propiedades: PropiedadItem[] }) {
  const router = useRouter();
  const [step, setStep]     = useState(1);
  // UI1: fechaInicio se calcula al montar (no hardcodeada en INITIAL)
  const [data, setData]     = useState<WizardData>(() => ({
    ...INITIAL,
    fechaInicio: new Date().toISOString().slice(0, 10),
  }));
  const [error, setError]   = useState("");
  const [isPending, startTransition] = useTransition();

  // Estado de búsqueda de personas (paso 2)
  const [busqueda, setBusqueda]     = useState("");
  const [resultados, setResultados] = useState<PersonaBusqueda[]>([]);
  const [buscando, setBuscando]     = useState(false);

  function set<K extends keyof WizardData>(k: K, v: WizardData[K]) {
    setData((d) => ({ ...d, [k]: v }));
  }

  function handleBuscar(q: string) {
    setBusqueda(q);
    if (q.length < 2) { setResultados([]); return; }
    setBuscando(true);
    startTransition(async () => {
      const r = await buscarPersonas(q);
      setResultados(r);
      setBuscando(false);
    });
  }

  function validate(s: number): string | null {
    if (s === 1) {
      if (!data.propiedadId) return "Selecciona una propiedad para continuar.";
    } else if (s === 2) {
      if (data.modoArr === "buscar" && !data.arrendatarioId)
        return "Selecciona o crea un arrendatario para continuar.";
      if (data.modoArr === "nuevo") {
        if (!data.nuevoNombre.trim()) return "El nombre del arrendatario es obligatorio.";
        if (!data.nuevoRut.trim())    return "El RUT del arrendatario es obligatorio.";
      }
    } else if (s === 3) {
      const v = parseFloat(data.valorArriendo);
      if (!Number.isFinite(v) || v <= 0)
        return `Ingresa un valor de arriendo válido en ${data.denominacion}.`;
      const d = parseInt(data.diaVencimiento, 10);
      if (!Number.isInteger(d) || d < 1 || d > 28)
        return "El día de vencimiento debe estar entre 1 y 28.";
      const c = parseFloat(data.comisionCorredorPct);
      if (!Number.isFinite(c) || c < 0 || c > 100)
        return "La comisión del corredor debe estar entre 0 y 100 %.";
      if (data.cobraGastoComun) {
        const gc = parseFloat(data.montoGastoComun);
        if (!Number.isFinite(gc) || gc <= 0)
          return "Ingresa un monto de gasto común válido.";
      }
    } else if (s === 4) {
      if (!data.fechaInicio)           return "La fecha de inicio es obligatoria.";
      if (data.tipoVigencia === "fijo") {
        if (!data.fechaFin)            return "La fecha de término es obligatoria para plazo fijo.";
        if (data.fechaFin <= data.fechaInicio)
          return "La fecha de término debe ser posterior a la de inicio.";
      }
      if (data.garantiaMeses !== "0") {
        const g = parseFloat(data.garantiaMonto);
        if (!Number.isFinite(g) || g <= 0)
          return `Ingresa un monto de garantía válido en ${data.garantiaDenominacion}.`;
      }
    }
    return null;
  }

  function handleNext() {
    const err = validate(step);
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
  }

  function handleBack() {
    setError("");
    setStep((s) => s - 1);
  }

  function handleSubmit() {
    const err = validate(4);
    if (err) { setError(err); return; }
    setError("");

    startTransition(async () => {
      const arrendatarioNuevo =
        data.modoArr === "nuevo"
          ? {
              nombre: data.nuevoNombre.trim(),
              rut:    data.nuevoRut.trim(),
              email:  data.nuevoEmail.trim() || undefined,
            }
          : undefined;

      const res = await crearContrato({
        propiedadId:   data.propiedadId,
        propietarioId: data.propietarioId,
        arrendatarioId: data.modoArr === "buscar" ? data.arrendatarioId : "",
        arrendatarioNuevo,
        denominacion:      data.denominacion,
        valorArriendo:     parseFloat(data.valorArriendo),
        diaVencimiento:    parseInt(data.diaVencimiento, 10),
        comisionCorredorPct: parseFloat(data.comisionCorredorPct),
        reajuste:          data.reajuste,
        moraTasaPct:       parseFloat(data.moraTasaPct),
        moraDiasGracia:    parseInt(data.moraDiasGracia, 10),
        cobraGastoComun:   data.cobraGastoComun,
        montoGastoComun:   data.cobraGastoComun ? parseFloat(data.montoGastoComun) : 0,
        garantiaMeses:     parseInt(data.garantiaMeses, 10),
        garantiaDenominacion: data.garantiaDenominacion,
        // Monto en la denominación elegida; el servidor lo convierte a CLP con
        // la UF del día de inicio para el asiento contable (ver actions.ts).
        garantiaMonto:     parseInt(data.garantiaMeses, 10) > 0
          ? parseFloat(data.garantiaMonto)
          : 0,
        fechaInicio:       data.fechaInicio,
        fechaFin:          data.tipoVigencia === "fijo" ? data.fechaFin : undefined,
      });

      if (!res.ok) { setError(res.error); return; }
      router.push(`/panel/contratos/${res.contratoId}`);
    });
  }

  /* Vista previa del calendario (paso 4) */
  const calendarPreview = useMemo<PeriodoPreview[]>(() => {
    const v = parseFloat(data.valorArriendo);
    const d = parseInt(data.diaVencimiento, 10);
    // UI3: consistente con validación server-side (max 28, no 31)
    if (!Number.isFinite(v) || v <= 0 || !Number.isInteger(d) || d < 1 || d > 28) return [];
    if (!data.fechaInicio) return [];
    try {
      const ini = new Date(data.fechaInicio + "T00:00:00Z");
      let fin: Date;
      if (data.tipoVigencia === "fijo" && data.fechaFin) {
        fin = new Date(data.fechaFin + "T00:00:00Z");
        if (fin <= ini) return [];
      } else {
        fin = new Date(Date.UTC(ini.getUTCFullYear(), ini.getUTCMonth() + 12, 0));
      }
      const gc = data.cobraGastoComun ? (parseFloat(data.montoGastoComun) || 0) : 0;
      return generarCalendario({
        fechaInicio:    ini,
        fechaFin:       fin,
        diaVencimiento: d,
        montoArriendo:  v,
        denominacion:   data.denominacion,
        montoGastoComun: gc,
      }).slice(0, 3);
    } catch {
      return [];
    }
  }, [
    data.valorArriendo, data.diaVencimiento, data.fechaInicio,
    data.tipoVigencia,  data.fechaFin,        data.denominacion,
    data.cobraGastoComun, data.montoGastoComun,
  ]);

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-2xl">
      {/* Barra de progreso */}
      <nav aria-label="Pasos del asistente" className="mb-8">
        <ol className="flex items-start">
          {STEPS.map(({ n, label, icon }, i) => {
            const done    = step > n;
            const current = step === n;
            return (
              <li key={n} className="flex flex-1 items-start">
                <div className="flex flex-col items-center gap-1">
                  <div
                    aria-current={current ? "step" : undefined}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: done    ? "var(--hw-success)"  :
                                  current ? "var(--hw-primary)"   :
                                            "var(--hw-surface-2)",
                      color:     done || current ? "white" : "var(--hw-text-4)",
                    }}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden="true" /> : icon}
                  </div>
                  <span
                    className="text-[10px] font-medium"
                    style={{
                      color: done    ? "var(--hw-success)" :
                             current ? "var(--hw-primary)"  :
                                       "var(--hw-text-4)",
                    }}
                  >
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="mt-4 h-0.5 flex-1 mx-1"
                    aria-hidden="true"
                    style={{ background: step > n ? "var(--hw-success)" : "var(--hw-border)" }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Alerta de error */}
      {error && (
        <div
          className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
          role="alert"
          aria-live="assertive"
          style={{ background: "var(--hw-danger-lt)", color: "var(--hw-danger)" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Contenido del paso actual */}
      <div className="hw-card p-6">
        {step === 1 && (
          <Step1
            propiedades={propiedades}
            propiedadId={data.propiedadId}
            onSelect={(p) => {
              set("propiedadId",       p.id);
              set("propietarioId",     p.propietarioId);
              set("propiedadDireccion", p.direccion);
              set("propiedadTipo",     p.tipo);
              setError("");
            }}
          />
        )}

        {step === 2 && (
          <Step2
            modo={data.modoArr}
            arrendatarioId={data.arrendatarioId}
            arrendatarioLabel={data.arrendatarioLabel}
            busqueda={busqueda}
            resultados={resultados}
            buscando={buscando}
            nuevoNombre={data.nuevoNombre}
            nuevoRut={data.nuevoRut}
            nuevoEmail={data.nuevoEmail}
            onChangeBusqueda={handleBuscar}
            onSelectPersona={(p) => {
              set("arrendatarioId",    p.id);
              set("arrendatarioLabel", `${p.nombre} (${p.rut})`);
              setResultados([]);
              setBusqueda("");
              setError("");
            }}
            onClearSeleccion={() => {
              set("arrendatarioId",    "");
              set("arrendatarioLabel", "");
              setBusqueda("");
              setResultados([]);
            }}
            onSetModo={(m) => {
              set("modoArr",           m);
              set("arrendatarioId",    "");
              set("arrendatarioLabel", "");
              setBusqueda("");
              setResultados([]);
              setError("");
            }}
            onChangeNuevo={(field, value) => {
              if (field === "nombre") set("nuevoNombre", value);
              if (field === "rut")    set("nuevoRut",    value);
              if (field === "email")  set("nuevoEmail",  value);
            }}
          />
        )}

        {step === 3 && <Step3 data={data} set={set} />}

        {step === 4 && <Step4 data={data} set={set} preview={calendarPreview} />}
      </div>

      {/* Navegación */}
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1 || isPending}
          className="hw-btn rounded-xl px-4 py-2 text-sm font-semibold"
          style={{
            background: "var(--hw-surface-2)",
            color:      "var(--hw-text-3)",
            opacity:    step === 1 ? 0.4 : 1,
            cursor:     step === 1 ? "not-allowed" : "pointer",
          }}
        >
          ← Volver
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={isPending}
            className="hw-btn flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--hw-primary)" }}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="hw-btn flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold text-white"
            style={{ background: isPending ? "var(--hw-border-2)" : "var(--hw-success)" }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Creando…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                Crear contrato
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
