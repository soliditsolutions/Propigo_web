"use client";

import { useState } from "react";
import {
  BrainCircuit, CheckCircle2, AlertTriangle, Info,
  Loader2, ChevronDown, ChevronUp, ShieldCheck, Scale,
  DollarSign, Users, ThumbsUp, Upload, FileText, X,
} from "lucide-react";
import type { ValidacionResultado, ValidacionEstado } from "@/app/api/contratos/[id]/validar/route";
import { CupoBadge } from "@/components/panel/ui";

export type Fase = "pre_firma" | "post_firma";

interface Props {
  contratoId:            string;
  fase:                  Fase;
  resultadoPrevio:       ValidacionResultado | null;
  estadoPrevio:          ValidacionEstado | null;
  validacionAt:          Date | string | null;
  confirmadaAt:          Date | string | null;
  /** Consumo de IA de hoy. null donde no aplica mandar documentos a la IA. */
  cupoIa:                { usado: number; max: number } | null;
}

// ── Paleta de colores por estado ────────────────────────────────────────────
const TONE: Record<ValidacionEstado, {
  bg: string; border: string; text: string; badge: string; badgeBg: string;
}> = {
  aprobado:          { bg: "var(--pgo-success-lt)", border: "var(--pgo-success-bd)", text: "var(--pgo-success-dk)", badge: "var(--pgo-success)", badgeBg: "var(--pgo-success-lt)" },
  con_alertas:       { bg: "var(--pgo-warning-lt)", border: "var(--pgo-warning-bd)", text: "var(--pgo-warning-dk)", badge: "var(--pgo-warning)", badgeBg: "var(--pgo-warning-lt)" },
  requiere_revision: { bg: "var(--pgo-primary-lt)", border: "var(--pgo-primary-bd)", text: "var(--pgo-primary-dk)", badge: "var(--pgo-primary)", badgeBg: "var(--pgo-primary-lt)" },
};

const ESTADO_LABEL: Record<ValidacionEstado, string> = {
  aprobado:          "Listo para firmar",
  con_alertas:       "Con observaciones menores",
  requiere_revision: "Conviene revisar",
};

const ESTADO_ICON: Record<ValidacionEstado, React.ElementType> = {
  aprobado:          CheckCircle2,
  con_alertas:       AlertTriangle,
  requiere_revision: Info,
};

// ── Categorías del análisis ──────────────────────────────────────────────────
const CAT_META = [
  { key: "estructura"         as const, label: "Estructura del contrato", Icon: ShieldCheck },
  { key: "cumplimiento_legal" as const, label: "Cumplimiento legal Chile 2026", Icon: Scale },
  { key: "montos"             as const, label: "Montos, garantía y mora", Icon: DollarSign },
  { key: "informacion_partes" as const, label: "Identificación de partes", Icon: Users },
];

const FASE_CONFIG = {
  pre_firma: {
    titulo:      "Asesor IA — Revisión pre-firma",
    descripcion: "Analiza si el contrato tiene todo lo necesario para ser sólido y legal antes de que ambas partes lo firmen.",
  },
  post_firma: {
    titulo:      "Asesor IA — Revisión post-proceso",
    descripcion: "Verifica que el proceso de firma y activación esté completo y en regla.",
  },
};

// ── Subcomponentes ───────────────────────────────────────────────────────────
function EstadoBadge({ estado }: { estado: ValidacionEstado }) {
  const t = TONE[estado];
  const Icon = ESTADO_ICON[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap"
      style={{ background: t.badgeBg, color: t.badge, border: `1px solid ${t.border}` }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {ESTADO_LABEL[estado]}
    </span>
  );
}

function CategoriaRow({
  label, Icon, ok, alertas,
}: { label: string; Icon: React.ElementType; ok: boolean; alertas: string[] }) {
  const [expandido, setExpandido] = useState(!ok && alertas.length > 0);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${ok ? "var(--pgo-success-bd)" : "var(--pgo-warning-bd)"}` }}
    >
      <button
        type="button"
        onClick={() => alertas.length > 0 && setExpandido(v => !v)}
        className="pgo-btn flex w-full items-center gap-3 px-4 py-3 text-left"
        style={{ background: ok ? "var(--pgo-success-lt)" : "var(--pgo-warning-lt)", cursor: alertas.length > 0 ? "pointer" : "default" }}
        aria-expanded={expandido}
      >
        <Icon
          className="h-4 w-4 shrink-0"
          style={{ color: ok ? "var(--pgo-success)" : "var(--pgo-warning)" }}
          aria-hidden="true"
        />
        <span className="flex-1 text-sm font-medium" style={{ color: ok ? "var(--pgo-success-dk)" : "var(--pgo-warning-dk)" }}>
          {label}
        </span>
        {alertas.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: "var(--pgo-warning-bd)", color: "var(--pgo-warning-dk)" }}
          >
            {alertas.length}
          </span>
        )}
        {ok
          ? <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
          : alertas.length > 0
            ? expandido
              ? <ChevronUp  className="h-4 w-4 shrink-0" style={{ color: "var(--pgo-text-4)" }} aria-hidden="true" />
              : <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--pgo-text-4)" }} aria-hidden="true" />
            : null
        }
      </button>

      {expandido && alertas.length > 0 && (
        <ul className="px-4 pb-3 pt-2 space-y-2" style={{ background: "var(--pgo-warning-lt)" }}>
          {alertas.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--pgo-warning-dk)" }}>
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--pgo-warning)" }} aria-hidden="true" />
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function ValidacionPanel({
  contratoId,
  fase,
  resultadoPrevio,
  estadoPrevio,
  validacionAt,
  confirmadaAt,
  cupoIa,
}: Props) {
  const [cargando,           setCargando]           = useState(false);
  const [confirmando,        setConfirmando]        = useState(false);
  const [resultado,          setResultado]          = useState<ValidacionResultado | null>(resultadoPrevio);
  const [estado,             setEstado]             = useState<ValidacionEstado | null>(estadoPrevio);
  const [fechaVal,           setFechaVal]           = useState<Date | string | null>(validacionAt);
  const [fechaConfirm,       setFechaConfirm]       = useState<Date | string | null>(confirmadaAt);
  const [error,              setError]              = useState<string | null>(null);
  const [archivoSeleccionado, setArchivoSeleccionado] = useState<File | null>(null);
  const [cargandoDoc,        setCargandoDoc]        = useState(false);
  const [consentIaDoc,       setConsentIaDoc]       = useState(false);
  const [cupo,               setCupo]               = useState(cupoIa);

  // El servidor rechaza igual con 429 (lib/plan-limits.ts); esto solo evita
  // que alguien suba un archivo y espere para recibir un error evitable.
  const sinCupoIa = cupo !== null && cupo.usado >= cupo.max;

  const cfg  = fase === "post_firma" ? FASE_CONFIG.post_firma : FASE_CONFIG.pre_firma;
  const tono = estado ? TONE[estado] : null;

  const necesitaConfirmacion =
    resultado !== null &&
    estado !== "aprobado" &&
    fechaConfirm === null;

  async function handleValidar() {
    setCargando(true);
    setError(null);
    setFechaConfirm(null);
    try {
      const res  = await fetch(`/api/contratos/${contratoId}/validar`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; validacion?: ValidacionResultado; error?: string };
      if (!res.ok || !data.ok || !data.validacion) {
        setError(data.error ?? "Error al validar. Intenta nuevamente.");
        return;
      }
      setResultado(data.validacion);
      setEstado(data.validacion.estado);
      setFechaVal(new Date());
    } catch {
      setError("Error de conexión. Verifica tu internet e intenta nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  async function handleValidarDoc() {
    if (!archivoSeleccionado || !consentIaDoc) return;
    setCargandoDoc(true);
    setError(null);
    setFechaConfirm(null);
    try {
      const fd = new FormData();
      fd.append("archivo", archivoSeleccionado);
      fd.append("consentIa", "on");
      const res  = await fetch(`/api/contratos/${contratoId}/validar-doc`, { method: "POST", body: fd });
      const data = await res.json() as {
        ok?: boolean; validacion?: ValidacionResultado; error?: string;
        cupoIa?: { usado: number; max: number };
      };
      // Vale tanto para el 200 como para el 429: en ambos casos la ruta manda
      // el consumo real, así el indicador no queda desfasado del servidor.
      if (data.cupoIa) setCupo(data.cupoIa);
      if (!res.ok || !data.ok || !data.validacion) {
        setError(data.error ?? "Error al analizar el documento. Intenta nuevamente.");
        return;
      }
      setResultado(data.validacion);
      setEstado(data.validacion.estado);
      setFechaVal(new Date());
      setArchivoSeleccionado(null);
    } catch {
      setError("Error de conexión al enviar el documento.");
    } finally {
      setCargandoDoc(false);
    }
  }

  async function handleConfirmar() {
    setConfirmando(true);
    setError(null);
    try {
      const res  = await fetch(`/api/contratos/${contratoId}/validar`, { method: "PUT" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error al confirmar.");
        return;
      }
      setFechaConfirm(new Date());
    } catch {
      setError("Error de conexión al confirmar.");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: tono?.border ?? "var(--pgo-border)", background: tono?.bg ?? "var(--pgo-surface-2)" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 px-5 py-3.5"
        style={{
          background:   tono ? tono.bg    : "var(--pgo-surface-2)",
          borderBottom: `1px solid ${tono?.border ?? "var(--pgo-border)"}`,
        }}
      >
        <BrainCircuit
          className="h-5 w-5 shrink-0"
          style={{ color: tono?.badge ?? "var(--pgo-text-3)" }}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: tono?.text ?? "var(--pgo-text-1)" }}>
            {cfg.titulo}
          </p>
          {fechaVal && (
            <p className="text-xs mt-0.5" style={{ color: tono?.badge ?? "var(--pgo-text-3)", opacity: 0.8 }}>
              Analizado el{" "}
              {new Date(fechaVal).toLocaleString("es-CL", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          )}
        </div>
        {estado && <EstadoBadge estado={estado} />}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-3">

        {/* Descripción inicial */}
        {!resultado && (
          <p className="text-xs leading-relaxed" style={{ color: "var(--pgo-text-3)" }}>
            {cfg.descripcion}
          </p>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
            style={{ background: "var(--pgo-danger-lt)", border: "1px solid var(--pgo-danger-bd)", color: "var(--pgo-danger-dk)" }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Resumen del análisis */}
        {resultado && (
          <p className="text-xs leading-relaxed font-medium" style={{ color: tono?.text ?? "var(--pgo-text-1)" }}>
            {resultado.resumen}
          </p>
        )}

        {/* Alertas críticas */}
        {resultado && resultado.alertas_criticas.length > 0 && (
          <div
            className="rounded-xl px-4 py-3 space-y-2"
            style={{ background: "var(--pgo-danger-lt)", border: "1px solid var(--pgo-danger-bd)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-danger-dk)" }}>
              Puntos que requieren atención
            </p>
            {resultado.alertas_criticas.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--pgo-danger-dk)" }}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                {a}
              </div>
            ))}
          </div>
        )}

        {/* Categorías desplegables */}
        {resultado && (
          <div className="space-y-2">
            {CAT_META.map(({ key, label, Icon }) => (
              <CategoriaRow
                key={key}
                label={label}
                Icon={Icon}
                ok={resultado.categorias[key].ok}
                alertas={resultado.categorias[key].alertas}
              />
            ))}
          </div>
        )}

        {/* Recomendaciones */}
        {resultado && resultado.recomendaciones.length > 0 && (
          <div
            className="rounded-xl px-4 py-3 space-y-2"
            style={{ background: "var(--pgo-primary-lt)", border: "1px solid var(--pgo-primary-bd)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-primary-dk)" }}>
              Sugerencias para fortalecer el contrato
            </p>
            {resultado.recomendaciones.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "var(--pgo-primary-dk)" }}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                {r}
              </div>
            ))}
          </div>
        )}

        {/* Confirmación del corredor — solo cuando hay observaciones y no ha confirmado */}
        {necesitaConfirmacion && (
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "var(--pgo-surface-2)", border: "1px solid var(--pgo-border-2)" }}
          >
            <p className="text-xs mb-2.5" style={{ color: "var(--pgo-text-3)" }}>
              El corredor tiene la decisión final. Si revisaste las observaciones y decides proceder, confírmalo aquí:
            </p>
            <button
              type="button"
              onClick={handleConfirmar}
              disabled={confirmando}
              className="pgo-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold"
              style={{
                background: confirmando ? "var(--pgo-surface-2)" : "var(--pgo-surface)",
                border: `1.5px solid ${confirmando ? "var(--pgo-border-2)" : "var(--pgo-primary)"}`,
                color: confirmando ? "var(--pgo-text-4)" : "var(--pgo-primary)",
              }}
            >
              {confirmando ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Confirmando…</>
              ) : (
                <><ThumbsUp className="h-4 w-4" aria-hidden="true" />He revisado las observaciones — el contrato está listo</>
              )}
            </button>
          </div>
        )}

        {/* Confirmado por el corredor */}
        {fechaConfirm && estado !== "aprobado" && (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-2.5"
            style={{ background: "var(--pgo-success-lt)", border: "1px solid var(--pgo-success-bd)" }}
          >
            <ThumbsUp className="h-4 w-4 shrink-0" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
            <p className="text-xs font-medium" style={{ color: "var(--pgo-success-dk)" }}>
              Revisado y confirmado por el corredor el{" "}
              {new Date(fechaConfirm).toLocaleString("es-CL", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>
        )}

        {/* Botón validar / re-validar */}
        <button
          type="button"
          onClick={handleValidar}
          disabled={cargando}
          className="pgo-btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
          style={{
            opacity: cargando ? 0.6 : 1,
            cursor: cargando ? "not-allowed" : "pointer",
          }}
        >
          {cargando ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Analizando contrato…</>
          ) : (
            <><BrainCircuit className="h-4 w-4" aria-hidden="true" />{resultado ? "Volver a analizar" : "Analizar contrato con IA"}</>
          )}
        </button>

        {/* ── Separador ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px" style={{ background: "var(--pgo-border)" }} />
          <span className="text-xs" style={{ color: "var(--pgo-text-4)" }}>o sube el documento</span>
          <div className="flex-1 h-px" style={{ background: "var(--pgo-border)" }} />
        </div>

        {/* Cupo diario de IA — va acá, antes del selector de archivo, porque
            sirve para decidir si vale la pena ir a buscar el documento. Dentro
            del bloque que aparece recién con el archivo elegido, avisaría tarde. */}
        {cupo && (
          <div className="flex items-center justify-center">
            <CupoBadge usado={cupo.usado} max={cupo.max} unidad="revisiones con IA hoy" />
          </div>
        )}

        {/* ── Subida de archivo PDF / DOCX ──────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label
              className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors"
              style={{
                background:   "var(--pgo-surface-2)",
                border:       "1.5px dashed var(--pgo-border-2)",
                color:        "var(--pgo-text-3)",
                minWidth:     0,
              }}
            >
              <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate flex-1 text-xs">
                {archivoSeleccionado ? archivoSeleccionado.name : "PDF o Word (.pdf / .docx)"}
              </span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(e) => {
                  setArchivoSeleccionado(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </label>
            {archivoSeleccionado && (
              <button
                type="button"
                onClick={() => setArchivoSeleccionado(null)}
                className="pgo-btn shrink-0 rounded-lg p-1.5"
                style={{ background: "var(--pgo-surface-2)", color: "var(--pgo-text-4)" }}
                aria-label="Quitar archivo"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          {archivoSeleccionado && (
            <>
              {/* Consentimiento IA — específico para el envío de este documento a
                  Groq (proveedor externo). Registro auditable en ConsentimientoIa. */}
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={consentIaDoc}
                  onChange={(e) => setConsentIaDoc(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded"
                  style={{ accentColor: "var(--pgo-primary)" }}
                />
                <span className="text-xs leading-relaxed" style={{ color: "var(--pgo-text-3)" }}>
                  Acepto que el texto de este documento sea enviado a nuestro proveedor
                  de análisis por IA (Groq) exclusivamente para esta revisión.
                </span>
              </label>

              <button
                type="button"
                onClick={handleValidarDoc}
                disabled={cargandoDoc || !consentIaDoc || sinCupoIa}
                className="pgo-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{
                  // Fondo y tinta van en par (ver globals.css): el acento teal
                  // suelto con texto blanco no llega al mínimo AA.
                  background: cargandoDoc ? "var(--pgo-text-4)" : "var(--pgo-accent-cyan-btn)",
                  color:      cargandoDoc ? "var(--pgo-bg)"     : "var(--pgo-on-accent-cyan)",
                  cursor:     cargandoDoc || !consentIaDoc || sinCupoIa ? "not-allowed" : "pointer",
                }}
              >
                {cargandoDoc ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Leyendo documento…</>
                ) : sinCupoIa ? (
                  <><FileText className="h-4 w-4" aria-hidden="true" />Sin revisiones con IA por hoy</>
                ) : (
                  <><FileText className="h-4 w-4" aria-hidden="true" />Analizar documento subido</>
                )}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs" style={{ color: "var(--pgo-text-4)" }}>
          Groq · Llama 3.3 70B · Ley 18.101 + Ley 21.461 Chile 2026 · Las observaciones son informativas
        </p>
      </div>
    </div>
  );
}
