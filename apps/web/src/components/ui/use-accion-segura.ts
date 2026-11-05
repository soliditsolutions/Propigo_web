"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { describirFalloAccion } from "@/lib/fallo-accion";

/**
 * Ejecuta una server action sin que un fallo de red, del servidor o de sesión
 * rompa la página: si la llamada se rechaza, muestra el aviso que corresponde
 * y devuelve `undefined`. Si la acción responde (aunque sea con `ok: false`),
 * devuelve su resultado tal cual y el componente lo maneja como siempre.
 *
 *   const res = await ejecutar(() => guardarAction(datos));
 *   if (!res) return; // ya se avisó
 */
export function useAccionSegura() {
  const { show } = useToast();

  return useCallback(
    async <T,>(llamada: () => Promise<T>): Promise<T | undefined> => {
      try {
        return await llamada();
      } catch (err) {
        console.error("[accion-segura]", err);
        const fallo = describirFalloAccion(err, navigator.onLine, window.location.pathname);
        show(fallo.mensaje, "error", fallo.accion ? { accion: fallo.accion } : undefined);
        return undefined;
      }
    },
    [show],
  );
}
