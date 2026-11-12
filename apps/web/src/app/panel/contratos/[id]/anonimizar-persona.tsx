"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Loader2 } from "lucide-react";
import { anonimizarPersonaAction, PALABRA_CONFIRMACION } from "./supresion-actions";
import { useAccionSegura } from "@/components/ui/use-accion-segura";

/**
 * Derecho de supresión (Ley 21.719, L-DP5). Solo se muestra al manager. Va
 * plegado y exige escribir una palabra: es irreversible.
 */
export function AnonimizarPersona({ personaId, nombre }: { personaId: string; nombre: string }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [listo, setListo] = useState<{ conservado: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const ejecutar = useAccionSegura();
  const router = useRouter();

  function confirmar() {
    setError("");
    startTransition(async () => {
      const r = await ejecutar(() => anonimizarPersonaAction(personaId, texto));
      if (!r) return;
      if (!r.ok) { setError(r.error); return; }
      setListo({ conservado: r.conservado });
      router.refresh();
    });
  }

  return (
    <details className="group mt-2 border-t border-[var(--pgo-border-2)] pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-[var(--pgo-text-3)] hover:text-[var(--pgo-text-1)]">
        <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
        Supresión de datos (Ley 21.719)
      </summary>

      {listo ? (
        <div role="status" className="mt-2 space-y-1.5 text-[11px] leading-snug text-[var(--pgo-text-3)]">
          <p className="font-semibold text-[var(--pgo-success)]">Listo: los datos de {nombre} fueron anonimizados.</p>
          <p>Por ley se conserva, y debes decírselo a la persona:</p>
          <ul className="list-disc space-y-1 pl-4">
            {listo.conservado.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-[11px] leading-snug text-[var(--pgo-text-4)]">
            Quita a {nombre} su nombre, RUT, correo y teléfono, y borra sus avisos, accesos y cuentas bancarias.
            <strong> No se puede deshacer.</strong> Se conservan los comprobantes y asientos que la ley obliga a guardar,
            y no se puede hacer con contratos vigentes ni períodos sin liquidar.
          </p>
          <label htmlFor={`anon-${personaId}`} className="block text-[11px] font-semibold text-[var(--pgo-text-3)]">
            Escribe {PALABRA_CONFIRMACION} para confirmar
          </label>
          <input
            id={`anon-${personaId}`} value={texto} onChange={(e) => setTexto(e.target.value)}
            autoComplete="off" spellCheck={false}
            className="pgo-input w-full rounded-lg px-2 py-1.5 text-xs"
          />
          {error && <p role="alert" className="text-[11px] text-[var(--pgo-danger-dk)]">{error}</p>}
          <button
            type="button" onClick={confirmar}
            disabled={isPending || texto.trim() !== PALABRA_CONFIRMACION}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--pgo-danger-lt)] px-2 py-1 text-[11px] font-semibold text-[var(--pgo-danger-dk)] disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            Anonimizar a esta persona
          </button>
        </div>
      )}
    </details>
  );
}
