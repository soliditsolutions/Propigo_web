"use client";

import { useRef, useState } from "react";
import { ListTree } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Índice de un texto legal para teléfono y tablet: un botón fijo abre la lista
 * de secciones en una hoja. Elegir una cierra la hoja y navega al ancla, lo
 * que abre la sección plegada (ver SeccionLegal). Desde `lg` se usa el índice
 * lateral y este botón no aparece.
 */
export function IndiceLegalMovil({ secciones }: { secciones: readonly { id: string; label: string }[] }) {
  const [abierto, setAbierto] = useState(false);
  // Se navega cuando la hoja terminó de cerrarse: mientras está abierta el
  // diálogo bloquea el scroll y, al cerrar, restauraría la posición anterior
  // encima del salto al ancla.
  const pendiente = useRef<string | null>(null);

  function alCerrar(abiertoAhora: boolean) {
    const id = pendiente.current;
    if (abiertoAhora || !id) return;
    pendiente.current = null;
    // pushState no dispara hashchange (y con el mismo ancla tampoco lo haría
    // el navegador): se avisa a mano y SeccionLegal abre y sube la sección.
    if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    // El foco sigue al lector: al encabezado de la sección elegida, no de
    // vuelta al botón «Contenido».
    document.querySelector<HTMLElement>(`#${CSS.escape(id)} button[aria-expanded]`)?.focus({ preventScroll: true });
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto} onOpenChangeComplete={alCerrar}>
      <DialogTrigger
        className="pgo-glass fixed bottom-5 right-4 z-30 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold lg:hidden"
        style={{ color: "var(--pf-navy)", border: "1px solid var(--pf-border)", boxShadow: "var(--pgo-shadow-2)" }}
      >
        <ListTree className="h-4 w-4" aria-hidden="true" />
        Contenido
      </DialogTrigger>
      <DialogContent className="pgo-auth-card gap-0 p-5 sm:max-w-md" showCloseButton>
        <DialogTitle className="mb-3 text-base font-bold" style={{ color: "var(--pf-navy)" }}>
          Contenido
        </DialogTitle>
        <nav aria-label="Secciones">
          <ol className="grid gap-1">
            {secciones.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => { e.preventDefault(); pendiente.current = s.id; setAbierto(false); }}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-[var(--pf-surface)]"
                  style={{ color: "var(--pf-text-body)" }}
                >
                  <span className="pgo-num w-5 text-right text-xs" style={{ color: "var(--pf-text-light)" }}>{i + 1}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
