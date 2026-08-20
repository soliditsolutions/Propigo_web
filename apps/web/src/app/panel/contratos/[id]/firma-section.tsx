"use client";

import { useState, useTransition } from "react";
import { PenLine, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { activarContrato, cancelarContratoBorrador } from "./actions";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { ValidacionPanel } from "../validacion-panel";
import type { ValidacionResultado, ValidacionEstado } from "@/app/api/contratos/[id]/validar/route";

interface Props {
  contratoId:            string;
  validacionIa:          ValidacionResultado | null;
  validacionEstado:      ValidacionEstado | null;
  validacionAt:          Date | null;
  validacionConfirmadaAt: Date | null;
  cupoIa:                 { usado: number; max: number } | null;
}

export function FirmaSection({ contratoId, validacionIa, validacionEstado, validacionAt, validacionConfirmadaAt, cupoIa }: Props) {
  const router = useRouter();
  const { show: toast }                = useToast();
  const [isPending,    startTransition] = useTransition();
  const [isCancelling, startCancel]     = useTransition();
  const [confirmado, setConfirmado]     = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  function handleActivar() {
    if (!confirmado) return;
    startTransition(async () => {
      const res = await activarContrato(contratoId);
      if (!res.ok) {
        toast(res.error ?? "Error al activar el contrato.", "error");
        return;
      }
      toast("Contrato activado correctamente.", "success");
      router.refresh();
    });
  }

  function handleCancelar() {
    if (!confirmCancel) return;
    startCancel(async () => {
      const res = await cancelarContratoBorrador(contratoId);
      if (!res.ok) {
        toast(res.error ?? "Error al cancelar el contrato.", "error");
        return;
      }
      toast("Contrato cancelado. La propiedad volvió a disponible.", "success");
      router.refresh();
    });
  }

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl border-2"
      style={{ borderColor: "var(--hw-warning-bd)", background: "var(--hw-warning-lt)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ background: "var(--hw-warning-lt)", borderBottom: "1px solid var(--hw-warning-bd)" }}
      >
        <PenLine className="h-5 w-5 shrink-0" style={{ color: "var(--hw-warning-dk)" }} aria-hidden="true" />
        <div>
          <p className="font-semibold" style={{ color: "var(--hw-warning-dk)" }}>
            Contrato pendiente de firma
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--hw-warning-dk)" }}>
            El contrato está en borrador. Ambas partes deben acordar y firmar antes de activarlo.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* Asesor IA — revisión pre-firma */}
        {/* key por contrato: el panel guarda el resultado de la validación y el
            archivo adjunto en estado local, inicializado desde props. `useState(prop)`
            solo toma el valor al montar, y al navegar de un contrato a otro React
            reutiliza la misma instancia (misma posición del árbol) — sin esto, el
            resultado y el archivo del contrato anterior sobreviven al cambio. */}
        <ValidacionPanel
          key={contratoId}
          contratoId={contratoId}
          fase="pre_firma"
          resultadoPrevio={validacionIa}
          estadoPrevio={validacionEstado}
          validacionAt={validacionAt}
          confirmadaAt={validacionConfirmadaAt}
          cupoIa={cupoIa}
        />

        <div className="space-y-2 text-sm" style={{ color: "var(--hw-warning-dk)" }}>
          <p className="font-medium">Pasos para activar el contrato:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs" style={{ color: "var(--hw-warning-dk)" }}>
            <li>Prepara el contrato físico o digital y entrega copia a ambas partes.</li>
            <li>Coordina la reunión de firma entre el propietario y el arrendatario.</li>
            <li>Una vez firmado por ambas partes, confirma y activa el contrato.</li>
          </ol>
        </div>

        {/* Confirmación */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={confirmado}
            onChange={(e) => setConfirmado(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded accent-yellow-600"
          />
          <span className="text-xs font-medium" style={{ color: "var(--hw-warning-dk)" }}>
            Confirmo que ambas partes han firmado el contrato de arriendo y acepto activarlo.
          </span>
        </label>

        <button
          type="button"
          onClick={handleActivar}
          disabled={!confirmado || isPending}
          className="hw-btn flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
          style={{
            background: (!confirmado || isPending) ? "var(--hw-border-2)" : "var(--hw-success)",
            cursor: !confirmado ? "not-allowed" : "pointer",
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Activando contrato…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Activar contrato
            </>
          )}
        </button>

        {/* ── Separador y opción de cancelar ── */}
        <div className="border-t pt-4" style={{ borderColor: "var(--hw-warning-bd)" }}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-warning-dk)" }}>
            ¿El proceso de firma no prosperó?
          </p>
          <label className="flex cursor-pointer items-start gap-3 mb-3">
            <input
              type="checkbox"
              checked={confirmCancel}
              onChange={(e) => setConfirmCancel(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-red-600"
            />
            <span className="text-xs font-medium" style={{ color: "var(--hw-warning-dk)" }}>
              Confirmo que deseo cancelar este contrato. La propiedad volverá a{" "}
              <strong>disponible</strong> y esta acción no se puede revertir.
            </span>
          </label>
          <button
            type="button"
            onClick={handleCancelar}
            disabled={!confirmCancel || isCancelling}
            className="hw-btn flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold"
            style={{
              background: "var(--hw-surface)",
              border: `1.5px solid ${(!confirmCancel || isCancelling) ? "var(--hw-border-2)" : "var(--hw-danger)"}`,
              color: (!confirmCancel || isCancelling) ? "var(--hw-text-4)" : "var(--hw-danger)",
              cursor: !confirmCancel ? "not-allowed" : "pointer",
            }}
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cancelando…
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Cancelar contrato (proceso no concretado)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
