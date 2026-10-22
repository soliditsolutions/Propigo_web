"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, CalendarDays } from "lucide-react";
import { renovarContrato } from "./actions";
import { fecha } from "@/lib/format";
import { useToast } from "@/components/ui/toast";

interface Props {
  contratoId:          string;
  fechaFinActual:      Date;   // fecha de término actual del contrato
  valorArriendoActual: number;
  denominacion:        string; // "UF" | "CLP"
}

/**
 * Estima cuántos períodos mensuales adicionales habría entre la
 * fecha siguiente al término actual y la nueva fechaFin (inclusive).
 */
function estimarPeriodos(fechaFinActual: Date, nuevaFechaFin: Date): number {
  if (nuevaFechaFin <= fechaFinActual) return 0;
  // El primer período nuevo comienza el mes siguiente al mes de cierre actual
  const inicioNuevo = new Date(Date.UTC(
    fechaFinActual.getUTCFullYear(),
    fechaFinActual.getUTCMonth() + 1,
    1,
  ));
  if (inicioNuevo > nuevaFechaFin) return 0;
  const ay = inicioNuevo.getUTCFullYear();
  const am = inicioNuevo.getUTCMonth();
  const by = nuevaFechaFin.getUTCFullYear();
  const bm = nuevaFechaFin.getUTCMonth();
  return (by - ay) * 12 + (bm - am) + 1;
}

export function RenovarSection({
  contratoId,
  fechaFinActual,
  valorArriendoActual,
  denominacion,
}: Props) {
  const router = useRouter();
  const { show: toast }      = useToast();
  const [isPending, startTransition] = useTransition();

  const [nuevaFechaFin, setNuevaFechaFin]   = useState("");
  const [cambiaValor, setCambiaValor]       = useState(false);
  const [nuevoValor, setNuevoValor]         = useState(String(valorArriendoActual));

  // Fecha mínima permitida en el input: día siguiente a fechaFinActual
  const minFecha = (() => {
    const d = new Date(fechaFinActual);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
  })();

  // Estimación en tiempo real de períodos a generar
  const periodosEstimados = nuevaFechaFin
    ? estimarPeriodos(fechaFinActual, new Date(nuevaFechaFin + "T00:00:00Z"))
    : 0;

  // Validez del valor de arriendo ingresado
  const valorParseado    = parseFloat(nuevoValor);
  const valorValido      = !cambiaValor || (valorParseado > 0 && !isNaN(valorParseado));
  const puedeEnviar      = nuevaFechaFin.length > 0 && periodosEstimados > 0 && valorValido;

  function handleRenovar() {
    if (!puedeEnviar) return;
    startTransition(async () => {
      const res = await renovarContrato(contratoId, {
        nuevaFechaFin,
        ...(cambiaValor ? { nuevoValorArriendo: valorParseado } : {}),
      });
      if (!res.ok) {
        toast(res.error ?? "Error al renovar el contrato.", "error");
        return;
      }
      toast("Contrato renovado. El calendario de períodos fue actualizado.", "success");
      router.refresh();
    });
  }

  /* ── Formulario de renovación ──────────────────────────────────── */
  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl border-2"
      style={{ borderColor: "var(--pgo-primary-bd)", background: "var(--pgo-primary-lt)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ background: "var(--pgo-primary-lt)", borderBottom: "1px solid var(--pgo-primary-bd)" }}
      >
        <RefreshCw className="h-5 w-5 shrink-0 text-[var(--pgo-primary-dk)]" aria-hidden="true" />
        <div>
          <p className="font-semibold text-[var(--pgo-primary-dk)]">Renovar contrato</p>
          <p className="text-xs mt-0.5 text-[var(--pgo-primary-dk)]">
            Extiende el plazo y genera los períodos de pago adicionales automáticamente.
            El arrendatario y la propiedad no cambian.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* Término actual — informativa */}
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-primary-bd)" }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--pgo-primary)]">
            Término actual
          </span>
          <p className="mt-0.5 font-semibold text-[var(--pgo-primary-dk)]">{fecha(fechaFinActual)}</p>
        </div>

        {/* Nueva fecha de término */}
        <div>
          <label
            htmlFor="renovar-fecha-fin"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--pgo-primary-dk)]"
          >
            Nueva fecha de término <span className="text-[var(--pgo-danger)]">*</span>
          </label>
          <input
            id="renovar-fecha-fin"
            type="date"
            min={minFecha}
            value={nuevaFechaFin}
            onChange={(e) => setNuevaFechaFin(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--pgo-primary-bd)]"
            style={{ borderColor: "var(--pgo-primary-bd)", background: "var(--pgo-surface)", color: "var(--pgo-primary-dk)" }}
          />
          {/* Estimación de períodos */}
          {nuevaFechaFin && periodosEstimados > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--pgo-primary)]">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Se generarán{" "}
              <strong>{periodosEstimados}</strong>{" "}
              período{periodosEstimados !== 1 ? "s" : ""} adicional
              {periodosEstimados !== 1 ? "es" : ""}.
            </p>
          )}
          {nuevaFechaFin && periodosEstimados === 0 && (
            <p className="mt-1.5 text-xs text-[var(--pgo-danger)]">
              La fecha debe estar al menos un mes después del término actual.
            </p>
          )}
        </div>

        {/* Cambio de valor de arriendo (opcional) */}
        <div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--pgo-primary-dk)] select-none">
            <input
              type="checkbox"
              checked={cambiaValor}
              onChange={(e) => setCambiaValor(e.target.checked)}
              className="h-4 w-4 rounded accent-blue-600"
            />
            Actualizar el valor de arriendo en los nuevos períodos
          </label>

          {cambiaValor && (
            <div className="mt-3">
              <label
                htmlFor="renovar-nuevo-valor"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--pgo-primary-dk)]"
              >
                Nuevo valor de arriendo ({denominacion})
              </label>
              <input
                id="renovar-nuevo-valor"
                type="number"
                min="0.01"
                step={denominacion === "UF" ? "0.01" : "1"}
                value={nuevoValor}
                onChange={(e) => setNuevoValor(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--pgo-primary-bd)]"
                style={{ borderColor: "var(--pgo-primary-bd)", background: "var(--pgo-surface)" }}
              />
              <p className="mt-1 text-xs text-[var(--pgo-primary)]">
                Los períodos anteriores conservan el valor original.
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleRenovar}
          disabled={!puedeEnviar || isPending}
          className="pgo-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors"
          style={{
            background: (!puedeEnviar || isPending) ? "var(--pgo-border-2)" : "var(--pgo-primary)",
            cursor: (!puedeEnviar || isPending) ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Renovando contrato…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Renovar contrato
              {periodosEstimados > 0 &&
                ` (+${periodosEstimados} período${periodosEstimados !== 1 ? "s" : ""})`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
