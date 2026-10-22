import { ShieldCheck, Download } from "lucide-react";

/**
 * Ejercicio del derecho de acceso / portabilidad (Ley 21.719, L-DP2/L-DP3).
 *
 * Solo se muestra al manager. Son descargas GET directas; el servidor vuelve a
 * verificar el rol y registra el export en la auditoría del equipo.
 */
export function ExportDatosPersona({ personaId, nombre }: { personaId: string; nombre: string }) {
  const base = `/api/panel/personas/${personaId}/export-datos`;
  return (
    <details className="group mt-3 border-t border-[var(--pgo-border-2)] pt-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-[var(--pgo-text-3)] hover:text-[var(--pgo-text-1)]">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Datos personales (Ley 21.719)
      </summary>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--pgo-text-4)]">
        Entrega a {nombre} de todo lo que la plataforma guarda de esta persona,
        a solicitud suya.
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <a
          href={`${base}?formato=pdf`}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--pgo-surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--pgo-text-2)] hover:bg-[var(--pgo-surface-3)]"
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          Copia (PDF)
        </a>
        <a
          href={`${base}?formato=json`}
          className="inline-flex items-center gap-1 rounded-lg bg-[var(--pgo-surface-2)] px-2 py-1 text-[11px] font-semibold text-[var(--pgo-text-2)] hover:bg-[var(--pgo-surface-3)]"
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          Portabilidad (JSON)
        </a>
      </div>
    </details>
  );
}
