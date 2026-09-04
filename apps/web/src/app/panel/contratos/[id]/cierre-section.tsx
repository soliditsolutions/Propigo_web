"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  XCircle, Loader2, CheckCircle2, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { terminarContrato } from "./actions";
import { clp, cantidad } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

/**
 * Causales de término, en el lenguaje del corredor. El orden es intencional:
 * las más habituales por tipo de término van primero. `desahucio` marca las
 * que exigen la fecha de notificación (Ley 18.101 cuenta el plazo desde ahí).
 */
const CAUSALES: {
  valor: string; etiqueta: string; tipos: ("normal" | "anticipado")[]; desahucio?: boolean;
}[] = [
  { valor: "vencimiento_plazo",            etiqueta: "Venció el plazo pactado",              tipos: ["normal"] },
  { valor: "mutuo_acuerdo",                etiqueta: "Mutuo acuerdo de las partes",          tipos: ["normal", "anticipado"] },
  { valor: "desahucio_arrendatario",       etiqueta: "El arrendatario avisa que se va",      tipos: ["anticipado"], desahucio: true },
  { valor: "desahucio_arrendador",         etiqueta: "El arrendador pone término con aviso", tipos: ["anticipado"], desahucio: true },
  { valor: "no_pago_renta",                etiqueta: "No pago de la renta",                  tipos: ["anticipado"] },
  { valor: "incumplimiento_contrato",      etiqueta: "Incumplimiento de otra obligación",    tipos: ["anticipado"] },
  { valor: "destruccion_inmueble",         etiqueta: "El inmueble se destruyó o quedó inhabitable", tipos: ["anticipado"] },
  { valor: "expiracion_derecho_arrendador",etiqueta: "Se extinguió el derecho del arrendador (venta, remate)", tipos: ["anticipado"] },
  { valor: "otra",                         etiqueta: "Otra causal",                          tipos: ["normal", "anticipado"] },
];

interface Props {
  contratoId:          string;
  /** Fecha de término pactada del contrato — null si es de plazo indefinido.
   * Se usa para calcular, solo informativamente, la renta del período que
   * falta hasta esa fecha (ver mesesRestantes más abajo). */
  fechaFin:            Date | null;
  valorArriendo:       number;
  denominacion:        string;  // "CLP" | "UF"
  /** Monto de garantía disponible HOY (ya revalorizado a la UF del día si la
   * garantía se pactó en UF). Es el máximo que el corredor puede retener o
   * devolver, y lo que terminarContrato liquidará. */
  garantiaDisponibleCLP: number;
  /** Denominación de la garantía ("UF" | "CLP" | null) — para avisar cuando el
   * monto mostrado viene revalorizado y no coincide con lo depositado. */
  garantiaDenominacion?: string | null;
  garantiaMontoBase?:    number | null;
  permitirTerminoNormal?: boolean;  // false = solo disponible en el último mes
}

/**
 * Meses que faltan hasta fechaFin, redondeados hacia arriba (un día de sobra
 * ya cuenta como un mes completo — igual criterio que un contrato real: no
 * se prorratea al día). Puramente informativo, no se persiste ni se cobra.
 */
function mesesRestantes(fechaFin: Date): number {
  const hoy    = new Date();
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const finUTC = Date.UTC(fechaFin.getFullYear(), fechaFin.getMonth(), fechaFin.getDate());
  const diasRestantes = Math.ceil((finUTC - hoyUTC) / (1000 * 60 * 60 * 24));
  return diasRestantes > 0 ? Math.ceil(diasRestantes / 30) : 0;
}

export function CierreSection({
  contratoId,
  fechaFin,
  valorArriendo,
  denominacion,
  garantiaDisponibleCLP,
  garantiaDenominacion,
  garantiaMontoBase,
  permitirTerminoNormal = true,
}: Props) {
  const router = useRouter();
  const { show: toast }              = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmado, setConfirmado]       = useState(false);
  const [tipo, setTipo]                   = useState<"normal" | "anticipado">(() =>
    permitirTerminoNormal ? "normal" : "anticipado"
  );
  const [montoRetencion, setMontoRetencion] = useState(0);
  const [causal, setCausal]               = useState("");
  const [fechaDesahucio, setFechaDesahucio] = useState("");

  // Las causales que corresponden al tipo elegido. Cambiar de tipo puede dejar
  // una causal que ya no aplica: en ese caso se limpia, para no terminar un
  // contrato "normal" con la causal de un no-pago.
  const causalesDisponibles = CAUSALES.filter((c) => c.tipos.includes(tipo));
  const causalActual = CAUSALES.find((c) => c.valor === causal);
  const requiereFechaDesahucio = !!causalActual?.desahucio;
  // No se puede terminar sin causal, ni con un desahucio sin su fecha.
  const puedeTerminar = !!causal && (!requiereFechaDesahucio || !!fechaDesahucio);

  /* Renta del período faltante — informativa. La Ley 18.101 no regula el
   * término anticipado por el arrendatario; lo habitual y más defendible
   * legalmente (Código Civil, cláusula penal Art. 1535 y ss. + Art. 1489)
   * es que deba las rentas del período que falta, no un monto fijo arbitrario
   * — igual criterio que usan los contratos de arriendo reales en Chile. */
  const meses = fechaFin ? mesesRestantes(fechaFin) : 0;
  const rentaPeriodoFaltanteDisplay = meses > 0
    ? denominacion === "UF"
      ? `${meses * valorArriendo} UF aprox.`
      : clp(meses * valorArriendo)
    : null;

  function handleTerminar() {
    if (!confirmado) return;
    startTransition(async () => {
      const res = await terminarContrato(contratoId, {
        tipo, montoRetencion,
        causal: causal as never,
        fechaNotificacionDesahucio: requiereFechaDesahucio ? fechaDesahucio : undefined,
      });
      if (!res.ok) {
        toast(res.error ?? "Error al terminar el contrato.", "error");
        return;
      }
      const label = tipo === "anticipado" ? "término anticipado" : "término";
      toast(`Contrato dado de ${label}. La propiedad volvió a disponible.`, "success");
      router.refresh();
    });
  }

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl border-2"
      style={{ borderColor: "var(--hw-danger-bd)", background: "var(--hw-danger-lt)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ background: "var(--hw-danger-lt)", borderBottom: "1px solid var(--hw-danger-bd)" }}
      >
        <XCircle className="h-5 w-5 shrink-0" style={{ color: "var(--hw-danger-dk)" }} aria-hidden="true" />
        <div>
          <p className="font-semibold" style={{ color: "var(--hw-danger-dk)" }}>
            Dar término al contrato
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--hw-danger-dk)" }}>
            La propiedad volverá al estado <strong>disponible</strong> y podrá ser rearrendada.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-5">

        {/* Tipo de término */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-danger-dk)" }}>
            Tipo de término
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["normal", "anticipado"] as const).map((t) => {
              const active   = tipo === t;
              const disabled = t === "normal" && !permitirTerminoNormal;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    if (disabled) return;
                    setTipo(t);
                    // Si la causal elegida no pertenece al nuevo tipo, se limpia.
                    if (causal && !CAUSALES.find((c) => c.valor === causal)?.tipos.includes(t)) {
                      setCausal("");
                      setFechaDesahucio("");
                    }
                  }}
                  aria-pressed={active}
                  disabled={disabled}
                  title={disabled ? "Disponible solo durante el último mes del contrato" : undefined}
                  className="hw-btn rounded-xl py-3 px-4 text-sm font-semibold text-left"
                  style={{
                    background: disabled ? "var(--hw-surface-2)" : active ? "var(--hw-danger-lt)" : "var(--hw-surface)",
                    border:     `2px solid ${disabled ? "var(--hw-border)" : active ? "var(--hw-danger)" : "var(--hw-danger-bd)"}`,
                    color:      disabled ? "var(--hw-text-4)" : active ? "var(--hw-danger-dk)" : "var(--hw-danger-dk)",
                    cursor:     disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <p className="font-semibold">
                    {t === "normal" ? "Término normal" : "Término anticipado"}
                  </p>
                  <p className="text-xs font-normal mt-0.5 opacity-80">
                    {t === "normal"
                      ? disabled
                        ? "Disponible a ≤ 1 mes del vencimiento"
                        : "Vencimiento natural o preaviso cumplido"
                      : "El arrendatario se va antes del plazo pactado"}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Causal de término — de ella dependen el plazo de restitución y el
            procedimiento que procede, así que no es opcional. */}
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-danger-dk)" }}>
            Causal de término
          </legend>
          <select
            value={causal}
            onChange={(e) => {
              setCausal(e.target.value);
              if (!CAUSALES.find((c) => c.valor === e.target.value)?.desahucio) setFechaDesahucio("");
            }}
            className="w-full rounded-xl border py-2.5 px-3 text-sm outline-none"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)", color: "var(--hw-text-1)" }}
          >
            <option value="">Selecciona una causal…</option>
            {causalesDisponibles.map((c) => (
              <option key={c.valor} value={c.valor}>{c.etiqueta}</option>
            ))}
          </select>
          {requiereFechaDesahucio && (
            <div className="mt-3">
              <label htmlFor="fechaDesahucio" className="mb-1 block text-xs font-semibold" style={{ color: "var(--hw-text-3)" }}>
                Fecha en que se notificó el desahucio
              </label>
              <input
                id="fechaDesahucio"
                type="date"
                value={fechaDesahucio}
                onChange={(e) => setFechaDesahucio(e.target.value)}
                className="w-full rounded-xl border py-2 px-3 text-sm outline-none"
                style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)", color: "var(--hw-text-1)" }}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--hw-text-4)" }}>
                La Ley 18.101 cuenta el plazo de restitución desde la notificación, no desde hoy.
              </p>
            </div>
          )}
        </fieldset>

        {/* Aviso renta del período faltante (solo anticipado, informativo) */}
        {tipo === "anticipado" && rentaPeriodoFaltanteDisplay && (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--hw-warning-lt)", border: "1px solid var(--hw-warning-bd)" }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--hw-warning-dk)" }} aria-hidden="true" />
            <div className="text-xs" style={{ color: "var(--hw-warning-dk)" }}>
              <p className="font-semibold">Renta del período faltante (informativa)</p>
              <p className="mt-0.5">
                {meses === 1 ? "Queda" : "Quedan"} {cantidad(meses, "mes", "meses")} hasta el término pactado: <strong>{rentaPeriodoFaltanteDisplay}</strong>.
                Es habitual pactar que el arrendatario deba las rentas del período que falta
                (Art. 1489 Código Civil) cuando pone término anticipado. El cobro se gestiona fuera del sistema.
              </p>
            </div>
          </div>
        )}
        {tipo === "anticipado" && !fechaFin && (
          <div
            className="flex items-start gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--hw-warning-lt)", border: "1px solid var(--hw-warning-bd)" }}
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--hw-warning-dk)" }} aria-hidden="true" />
            <p className="text-xs" style={{ color: "var(--hw-warning-dk)" }}>
              Este contrato es de plazo indefinido: no aplica el cálculo de renta del período faltante.
            </p>
          </div>
        )}

        {/* Garantía — retención / devolución */}
        {garantiaDisponibleCLP > 0 && (
          <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-danger-bd)" }}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "var(--hw-danger-dk)" }} aria-hidden="true" />
              <p className="text-sm font-semibold" style={{ color: "var(--hw-danger-dk)" }}>
                Garantía a restituir: {clp(garantiaDisponibleCLP)}
              </p>
            </div>
            {garantiaDenominacion === "UF" && garantiaMontoBase != null && (
              <p className="text-[11px]" style={{ color: "var(--hw-danger-dk)", opacity: 0.85 }}>
                Pactada en {garantiaMontoBase} UF — monto revalorizado a la UF de hoy.
              </p>
            )}

            <div>
              <label
                htmlFor="monto-retencion"
                className="mb-1 block text-xs font-semibold"
                style={{ color: "var(--hw-danger-dk)" }}
              >
                Monto a retener por daños (0 = devuelve todo)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: "var(--hw-danger-dk)" }}>$</span>
                <input
                  id="monto-retencion"
                  type="number"
                  min={0}
                  max={garantiaDisponibleCLP}
                  step={1000}
                  value={montoRetencion}
                  onChange={(e) => setMontoRetencion(Math.min(garantiaDisponibleCLP, Math.max(0, Number(e.target.value))))}
                  className="w-40 rounded-lg border px-3 py-1.5 text-sm tabular-nums"
                  style={{ borderColor: "var(--hw-danger-bd)", color: "var(--hw-danger-dk)", outline: "none" }}
                />
              </div>
            </div>

            {/* Resumen visual */}
            <div className="grid grid-cols-2 gap-2 rounded-lg p-3" style={{ background: "var(--hw-danger-lt)" }}>
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-danger-dk)" }}>
                  Se retiene
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: "var(--hw-danger-dk)" }}>
                  {clp(montoRetencion)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-success)" }}>
                  Se devuelve
                </p>
                <p className="mt-0.5 text-sm font-bold tabular-nums" style={{ color: "var(--hw-success-dk)" }}>
                  {clp(garantiaDisponibleCLP - montoRetencion)}
                </p>
              </div>
            </div>

            <p className="text-[11px]" style={{ color: "var(--hw-danger-dk)", opacity: 0.8 }}>
              Ambos montos quedarán registrados en el ledger inmutable del contrato.
            </p>
          </div>
        )}

        {/* Confirmación */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-red-600"
          />
          <span className="text-xs font-medium" style={{ color: "var(--hw-danger-dk)" }}>
            Confirmo que deseo dar{" "}
            {tipo === "anticipado" ? "término anticipado" : "término"} a este contrato.
            Esta acción <strong>no se puede revertir</strong>.
          </span>
        </label>

        <button
          type="button"
          onClick={handleTerminar}
          disabled={!confirmado || !puedeTerminar || isPending}
          className="hw-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
          style={{
            background: (!confirmado || !puedeTerminar || isPending) ? "var(--hw-border-2)" : "var(--hw-danger)",
            cursor: (!confirmado || !puedeTerminar) ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Terminando contrato…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Confirmar{" "}
              {tipo === "anticipado" ? "término anticipado" : "término de contrato"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
