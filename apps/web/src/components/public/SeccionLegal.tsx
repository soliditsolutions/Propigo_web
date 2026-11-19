"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Sección de un texto legal (términos, privacidad). En teléfono y tablet se
 * pliega: las páginas legales medían 20+ pantallas en un iPhone SE y no se
 * podía ubicar nada. Desde `lg` (con el índice lateral a la vista) todo queda
 * abierto y el título es texto normal.
 *
 * El contenido siempre está en el HTML (buscadores y lectura sin JS). Se abre
 * sola si la URL apunta a ella (`/privacidad#derechos`), al llegar o al
 * navegar desde el índice.
 */
export function SeccionLegal({
  id,
  titulo,
  icono,
  sangria = false,
  children,
}: {
  id: string;
  titulo: string;
  icono?: ReactNode;
  /** Sangría del cuerpo bajo el ícono desde sm (privacidad). */
  sangria?: boolean;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);
  const idCuerpo = useId();

  useEffect(() => {
    const revisar = () => {
      if (window.location.hash !== `#${id}`) return;
      setAbierta(true);
      // El navegador saltó al ancla con la sección todavía plegada: cerca del
      // final de la página no alcanzaba a subirla. Se reajusta ya desplegada.
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    };
    revisar();
    window.addEventListener("hashchange", revisar);
    return () => window.removeEventListener("hashchange", revisar);
  }, [id]);

  const icon = icono ? (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
      style={{ background: "var(--pf-brand-tint)", color: "var(--pf-brand)" }}
      aria-hidden="true"
    >
      {icono}
    </span>
  ) : null;

  return (
    <section id={id} className="mb-0 scroll-mt-24 max-lg:border-b lg:mb-10" style={{ borderColor: "var(--pf-border)" }}>
      <h2 className="text-xl font-bold" style={{ color: "var(--pf-navy)", letterSpacing: "-0.01em" }}>
        <button
          type="button"
          className="flex min-h-12 w-full items-center gap-3 py-2 text-left lg:hidden"
          aria-expanded={abierta}
          aria-controls={idCuerpo}
          onClick={() => setAbierta((a) => !a)}
        >
          {icon}
          <span className="flex-1">{titulo}</span>
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
            style={{ color: "var(--pf-text-light)", transform: abierta ? "rotate(180deg)" : undefined }}
            aria-hidden="true"
          />
        </button>
        <span className="mb-4 hidden items-center gap-3 lg:flex">
          {icon}
          {titulo}
        </span>
      </h2>
      <div
        id={idCuerpo}
        className={`space-y-4 pb-4 text-base leading-relaxed [overflow-wrap:anywhere] lg:pb-0 ${sangria ? "sm:pl-12" : ""} ${abierta ? "" : "max-lg:hidden"}`}
        style={{ color: "var(--pf-text-body)" }}
      >
        {children}
      </div>
    </section>
  );
}
