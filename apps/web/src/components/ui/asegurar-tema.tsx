"use client";

import { useEffect } from "react";
import { asegurarTema } from "@/lib/theme";

/**
 * Reaplica el tema al montar. Las páginas de error y de "no encontrado" lo
 * necesitan: cuando Next vuelve a renderizar el documento en el cliente (un
 * error del servidor o un notFound() desde la página), se pierde el
 * data-theme que fijó el script anti-parpadeo y la página quedaría con los
 * colores del tema por defecto.
 */
export function AsegurarTema() {
  useEffect(asegurarTema, []);
  return null;
}
