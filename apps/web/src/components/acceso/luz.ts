"use client";

import { useEffect, type RefObject } from "react";

/** Posición del puntero: gx/gy en % dentro del elemento y px/py de -1 a 1 desde su centro. */
export type Luz = { gx: number; gy: number; px: number; py: number };

type Caja = { left: number; top: number; width: number; height: number };

const acotar = (v: number) => Math.min(1, Math.max(0, v));
const redondear = (v: number) => Math.round(v * 1000) / 1000;

export function luzDesdePuntero(x: number, y: number, caja: Caja): Luz {
  const fx = caja.width > 0 ? acotar((x - caja.left) / caja.width) : 0.5;
  const fy = caja.height > 0 ? acotar((y - caja.top) / caja.height) : 0.5;
  return {
    gx: redondear(fx * 100),
    gy: redondear(fy * 100),
    px: redondear(fx * 2 - 1),
    py: redondear(fy * 2 - 1),
  };
}

/** Solo con mouse o trackpad y sin pedido de menos movimiento: en táctil no hay puntero que seguir. */
const CONSULTA = "(pointer: fine) and (prefers-reduced-motion: no-preference)";

/**
 * Publica la posición del puntero como variables CSS (--gx, --gy, --px, --py) y
 * marca data-luz="on" mientras está encima. El CSS decide qué hacer con ellas
 * (reflejo, inclinación, paralaje). Un cuadro por animación como máximo.
 */
export function useLuzPuntero(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia(CONSULTA).matches) return;

    let cuadro = 0;
    let ultimo: { x: number; y: number } | null = null;

    const pintar = () => {
      cuadro = 0;
      if (!ultimo) return;
      const l = luzDesdePuntero(ultimo.x, ultimo.y, el.getBoundingClientRect());
      el.style.setProperty("--gx", `${l.gx}%`);
      el.style.setProperty("--gy", `${l.gy}%`);
      el.style.setProperty("--px", String(l.px));
      el.style.setProperty("--py", String(l.py));
      el.dataset.luz = "on";
    };
    const mover = (e: PointerEvent) => {
      ultimo = { x: e.clientX, y: e.clientY };
      if (!cuadro) cuadro = requestAnimationFrame(pintar);
    };
    const salir = () => {
      ultimo = null;
      cancelAnimationFrame(cuadro);
      cuadro = 0;
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
      delete el.dataset.luz;
    };

    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerleave", salir);
    return () => {
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerleave", salir);
      cancelAnimationFrame(cuadro);
    };
  }, [ref]);
}
