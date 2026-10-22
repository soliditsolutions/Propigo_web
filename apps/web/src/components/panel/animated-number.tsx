"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Número que cuenta desde 0 hasta su valor final al montar.
 * - Respeta prefers-reduced-motion (muestra el valor final de inmediato).
 * - El texto accesible es siempre el valor final (aria-label fijo).
 */
export function AnimatedNumber({
  value,
  format = "clp",
  durationMs = 700,
}: {
  value: number;
  /** "clp" → $1.234.567 · "int" → 1.234 */
  format?: "clp" | "int";
  durationMs?: number;
}) {
  const fmt = (n: number) =>
    format === "clp"
      ? `$${Math.round(n).toLocaleString("es-CL")}`
      : Math.round(n).toLocaleString("es-CL");

  const [display, setDisplay] = useState(() => fmt(value));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      value === 0
    ) {
      queueMicrotask(() => setDisplay(fmt(value)));
      return;
    }

    const inicio = performance.now();
    const tick = (ahora: number) => {
      const t = Math.min((ahora - inicio) / durationMs, 1);
      // easeOutCubic — frena suave al llegar
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(fmt(value * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, format]);

  return (
    <span className="pgo-num" aria-label={fmt(value)}>
      {display}
    </span>
  );
}
