"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { reactivarAvisos, pausarAvisos } from "./preferencias-actions";

/**
 * Control de avisos por correo en el portal.
 *
 * Es el único lugar donde se puede volver a activar: la baja se hace desde el
 * enlace del correo (sin sesión), pero reactivar exige identificarse, para
 * que nadie reactive avisos a nombre de otro.
 */
export function PreferenciasAvisos({
  suscrito,
  descripcion,
}: {
  suscrito: boolean;
  descripcion: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function alternar() {
    setError("");
    startTransition(async () => {
      const r = suscrito ? await pausarAvisos() : await reactivarAvisos();
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "var(--hw-surface-2)", border: "1px solid var(--hw-border-2)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {suscrito
            ? <Bell    className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--hw-success)" }} aria-hidden="true" />
            : <BellOff className="mt-0.5 h-5 w-5 shrink-0" style={{ color: "var(--hw-text-4)" }} aria-hidden="true" />}
          <div className="min-w-0">
            <p className="font-semibold" style={{ color: "var(--hw-text-1)" }}>Avisos por correo</p>
            <p className="text-xs" style={{ color: "var(--hw-text-3)" }}>{descripcion}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={alternar}
          disabled={isPending}
          className="hw-btn shrink-0 rounded-xl px-4 py-2 text-sm font-semibold"
          style={
            suscrito
              ? { background: "var(--hw-surface)", color: "var(--hw-text-2)" }
              : { background: "var(--hw-primary)", color: "#fff" }
          }
        >
          {isPending
            ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            : suscrito ? "Dejar de recibirlos" : "Volver a recibirlos"}
        </button>
      </div>

      {!suscrito && (
        <p className="mt-3 text-xs" style={{ color: "var(--hw-text-4)" }}>
          Mientras estén desactivados no te llegan recordatorios de vencimiento ni avisos de
          atraso. Tu contrato y tus plazos siguen igual: puedes revisarlos acá cuando quieras.
        </p>
      )}

      {error && <p className="mt-2 text-sm" style={{ color: "var(--hw-danger)" }}>{error}</p>}
    </div>
  );
}
