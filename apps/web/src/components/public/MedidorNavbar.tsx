"use client";

import { useEffect } from "react";

/**
 * Publica el alto real del navbar público en `--pf-navbar-alto` (en <html>)
 * para que lo que se pega bajo él (la barra de categorías del marketplace)
 * quede justo debajo. El alto depende del ancho (65 px en teléfono, 79 en
 * escritorio) y del zoom de texto, así que se mide en vez de fijarlo.
 */
export function MedidorNavbar() {
  useEffect(() => {
    const navbar = document.querySelector<HTMLElement>(".pf-navbar");
    if (!navbar) return;
    const raiz = document.documentElement;
    const publicar = () => raiz.style.setProperty("--pf-navbar-alto", `${navbar.offsetHeight}px`);
    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(navbar);
    return () => { observador.disconnect(); raiz.style.removeProperty("--pf-navbar-alto"); };
  }, []);
  return null;
}
