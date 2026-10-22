"use client";

import { Children, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Huincha automática (marquee) para el sitio público (corredores, propiedades
 * destacadas). Cuando hay contenido suficiente para superar el ancho del
 * contenedor, el contenido se repite N veces y se anima con CSS puro en loop
 * infinito hacia la izquierda — sin JS de scroll ni dependencias externas.
 * Se detiene con `:hover`/`:focus-within` (ver `.pgo-marquee` en globals.css)
 * y respeta `prefers-reduced-motion` (cae a scroll manual).
 *
 * Con pocos ítems reales (ej. un tenant nuevo con 1 propiedad), duplicar y
 * animar no tiene sentido: no hay nada nuevo "entrando por la derecha", solo
 * la misma tarjeta repitiéndose en loop. Por eso medimos el ancho real del
 * grupo (sin duplicar) contra el contenedor — si ya cabe entero, se muestra
 * una sola vez, estático, sin animación (`pgo-marquee-static` en globals.css).
 * Recién cuando el contenido real desborda el contenedor se activa el loop,
 * momento en el que sí hay variedad suficiente para que se sienta como una
 * cola de contenido y no como una repetición.
 */
export function Carousel({
  children,
  ariaLabel,
}: {
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const items = Children.toArray(children);
  const n = Math.max(items.length, 1);

  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [shouldLoop, setShouldLoop] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    function check() {
      if (!container || !measure) return;
      setShouldLoop(measure.scrollWidth > container.clientWidth + 1);
    }
    check();

    const ro = new ResizeObserver(check);
    ro.observe(container);
    ro.observe(measure);
    return () => ro.disconnect();
  }, [n]);

  // Objetivo: al menos ~8 tarjetas en total (holgado incluso para el
  // contenedor más ancho), con un mínimo de 2 copias para que la técnica del
  // desplazamiento de "un grupo completo" siga siendo válida.
  const copias = shouldLoop ? Math.max(2, Math.ceil(8 / n)) : 1;
  // La distancia recorrida por vuelta es siempre el ancho de UN grupo
  // (n tarjetas), sin importar cuántas copias haya — por eso la duración
  // escala solo con `n`, para que la velocidad (px/s) sea constante
  // independiente de cuántas copias se necesiten para llenar el contenedor.
  const duracionSeg = Math.max(n * 4.5, 14);
  const desplazamiento = `${100 / copias}%`;

  const inertRefs = useRef<(HTMLDivElement | null)[]>([]);

  // `inert` se fija imperativamente (no como prop JSX): en esta versión de
  // React el atributo booleano vía JSX dispara una advertencia de hidratación
  // espuria en consola aunque el resultado en el DOM es correcto. Asignarlo
  // directamente evita el warning sin cambiar el comportamiento.
  useEffect(() => {
    inertRefs.current.forEach((el) => { if (el) el.inert = true; });
  }, [copias]);

  return (
    <div
      ref={containerRef}
      className={`pgo-marquee${shouldLoop ? "" : " pgo-marquee-static"}`}
      role="group"
      aria-label={ariaLabel}
    >
      <div
        className="pgo-marquee-track"
        style={shouldLoop ? ({ animationDuration: `${duracionSeg}s`, "--pgo-marquee-shift": desplazamiento } as React.CSSProperties) : undefined}
      >
        {Array.from({ length: copias }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              if (i === 0) measureRef.current = el;
              if (i > 0) inertRefs.current[i] = el;
            }}
            className="pgo-marquee-group"
            // Solo el primer grupo es contenido real — el resto son copias
            // decorativas para el loop continuo, ocultas de lectores de
            // pantalla y fuera del orden de tabulación (inert, vía ref).
            aria-hidden={i > 0 ? "true" : undefined}
          >
            {items}
          </div>
        ))}
      </div>
    </div>
  );
}
