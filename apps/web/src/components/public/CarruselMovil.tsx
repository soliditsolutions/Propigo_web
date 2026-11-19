"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Grilla que, por debajo de un corte, pasa a carrusel horizontal con
 * scroll-snap y puntos indicadores. Un solo render: en escritorio los hijos
 * son celdas de la grilla (`className`); en teléfono, tarjetas que se deslizan
 * con el dedo, sin JS para moverse (lo hace el navegador). Sirve para listas
 * cortas de tarjetas comparables (planes, funciones) que apiladas alargaban la
 * portada a 9 pantallas.
 *
 * Los puntos son botones (24 px de área táctil) que llevan a cada tarjeta, y
 * `aria-current` marca la que está a la vista.
 */
export function CarruselMovil({
  etiqueta,
  hasta,
  className = "",
  children,
}: {
  /** Nombre accesible del carrusel. */
  etiqueta: string;
  /** Corte bajo el cual es carrusel: `sm` (teléfono) o `lg` (teléfono y tablet). */
  hasta: "sm" | "lg";
  /** Clases de la grilla para cuando NO es carrusel. */
  className?: string;
  children: ReactNode;
}) {
  const pista = useRef<HTMLDivElement>(null);
  const total = Children.count(children);
  const [actual, setActual] = useState(0);

  const medir = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setActual(max <= 0 ? 0 : Math.round((el.scrollLeft / max) * (total - 1)));
  }, [total]);

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    let cuadro = 0;
    const alDesplazar = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(medir); };
    el.addEventListener("scroll", alDesplazar, { passive: true });
    return () => { el.removeEventListener("scroll", alDesplazar); cancelAnimationFrame(cuadro); };
  }, [medir]);

  function irA(i: number) {
    const el = pista.current;
    const tarjeta = el?.children[i] as HTMLElement | undefined;
    if (!el || !tarjeta) return;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: tarjeta.offsetLeft - (el.clientWidth - tarjeta.offsetWidth) / 2, behavior: reducir ? "auto" : "smooth" });
  }

  return (
    <div role="region" aria-roledescription="carrusel" aria-label={etiqueta}>
      <div ref={pista} className={`pgo-carrusel pgo-carrusel--${hasta} ${className}`}>
        {children}
      </div>
      {total > 1 && (
        <div className={`mt-2 flex justify-center gap-1 ${hasta === "sm" ? "sm:hidden" : "lg:hidden"}`}>
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => irA(i)}
              aria-label={`Ir a la tarjeta ${i + 1} de ${total}`}
              aria-current={i === actual ? "true" : undefined}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className="block h-2 rounded-full transition-all duration-200 motion-reduce:transition-none"
                style={{
                  width: i === actual ? 20 : 8,
                  background: i === actual ? "var(--pf-brand)" : "var(--pf-border)",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
