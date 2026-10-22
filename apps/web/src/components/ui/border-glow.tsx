"use client";

import {
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

interface BorderGlowProps {
  children: ReactNode;
  /** Clases del wrapper. Debe controlar el tamaño (ancho/alto) para calzar la card. */
  className?: string;
  /** Radio de esquina en px — debe COINCIDIR con el de la card envuelta (20 auth-card, 16 pf-card). */
  radius?: number;
  /** Color del glow (cualquier color CSS). Por defecto el acento de marca tema-aware (--pf-brand). */
  glowColor?: string;
  /** Cercanía al borde (0-100) a la que empieza a encenderse el glow. Mayor = más pegado al borde. */
  edgeSensitivity?: number;
  /** Barrido de luz al montar (una vez). Úsalo con moderación: no en carruseles con muchas cards. */
  animated?: boolean;
  style?: CSSProperties;
}

/**
 * BorderGlow — glow de borde direccional que sigue el cursor.
 *
 * Adaptación tema-aware del componente BorderGlow (React Bits): un solo color
 * de marca en vez del mesh multicolor original, y todo derivado de tokens
 * (--pf-brand), así respeta el tema dual Aurora dark/light. Pensado SOLO para
 * cards de vitrina (propiedades, planes, corredores) — no para cards densas de
 * datos, donde el efecto sería ruido.
 *
 * Es un wrapper: envuelve la card sin tocar su recorte interno. El realce de
 * hover ES el glow (no hay lift de transform), a propósito, para que el anillo
 * de luz nunca se desalinee con la card — sobre todo dentro de grids con la
 * animación de entrada .pgo-stagger, que hace fill de transform en sus hijos.
 * Los estilos viven en globals.css (.pgo-border-glow), junto a las demás cards.
 */
export function BorderGlow({
  children,
  className = "",
  radius = 20,
  glowColor,
  edgeSensitivity = 32,
  animated = false,
  style,
}: BorderGlowProps) {
  const ref = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    // Proximidad al borde: 0 en el centro, 1 justo en el borde. Se calcula
    // proyectando el vector cursor→centro sobre el borde más cercano.
    let kx = Infinity;
    let ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

    // Ángulo del cursor respecto al centro (0° arriba, sentido horario).
    let deg = 0;
    if (dx !== 0 || dy !== 0) {
      deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (deg < 0) deg += 360;
    }

    el.style.setProperty("--edge-proximity", (edge * 100).toFixed(2));
    el.style.setProperty("--cursor-angle", `${deg.toFixed(2)}deg`);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!animated || !el) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let raf = 0;
    const t0 = performance.now();
    const angleStart = 110;
    const angleEnd = 465;
    const duration = 2600;
    el.classList.add("sweep-active");

    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1);
      const angle = angleStart + (angleEnd - angleStart) * t;
      // Proximidad como medio seno: sube y baja para un barrido suave.
      const prox = Math.sin(t * Math.PI) * 100;
      el.style.setProperty("--cursor-angle", `${angle.toFixed(1)}deg`);
      el.style.setProperty("--edge-proximity", prox.toFixed(1));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        el.classList.remove("sweep-active");
        el.style.setProperty("--edge-proximity", "0");
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.classList.remove("sweep-active");
    };
  }, [animated]);

  return (
    <div
      ref={ref}
      onPointerMove={handlePointerMove}
      className={`pgo-border-glow ${className}`}
      style={
        {
          "--glow-corner": `${radius}px`,
          "--edge-sensitivity": edgeSensitivity,
          ...(glowColor ? { "--glow": glowColor } : null),
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

export default BorderGlow;
