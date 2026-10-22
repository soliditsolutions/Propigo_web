"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Envuelve una sección para que aparezca (fade + translateY) al entrar en el
 * viewport durante el scroll, en vez de estar siempre visible desde el mount.
 * Usa IntersectionObserver una sola vez por elemento — no relanza la
 * animación si el usuario vuelve a scrollear hacia arriba y abajo.
 */
export function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // SIEMPRE arranca en `false`, igual en servidor y cliente: `typeof
  // IntersectionObserver` no puede evaluarse en el estado inicial porque en
  // Node (SSR) el global no existe y ahí SIEMPRE da "undefined" — eso
  // horneaba la clase "-in" en el HTML de cada carga y anulaba el reveal por
  // completo (visible de entrada, sin importar la posición real).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sin soporte de IntersectionObserver (solo se sabe en el cliente, en el
    // efecto), mostrar de inmediato. `queueMicrotask` en vez de llamar
    // setState directo en el cuerpo del efecto — mismo resultado, conforme a
    // la regla de lint que evita setState síncrono ahí.
    if (typeof IntersectionObserver === "undefined") {
      queueMicrotask(() => setVisible(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`pgo-scroll-reveal ${visible ? "pgo-scroll-reveal-in" : ""} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
