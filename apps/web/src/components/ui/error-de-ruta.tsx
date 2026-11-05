"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import {
  EstadoPagina,
  ESTADO_BTN_PRIMARIO,
  ESTADO_BTN_SECUNDARIO,
  ESTILO_BTN_SECUNDARIO,
} from "@/components/ui/estado-pagina";

function suscribirConexion(aviso: () => void) {
  window.addEventListener("online", aviso);
  window.addEventListener("offline", aviso);
  return () => {
    window.removeEventListener("online", aviso);
    window.removeEventListener("offline", aviso);
  };
}

/**
 * Contenido común de los `error.tsx`: explica qué pasó, ofrece reintentar y
 * una salida segura. En producción Next reemplaza el mensaje de los errores
 * del servidor por uno genérico; el `digest` es lo que permite a soporte
 * encontrar el error en el log, por eso se muestra.
 */
export function ErrorDeRuta({
  error,
  retry,
  salida,
  variante,
}: {
  error: unknown;
  retry: () => void;
  salida: { href: string; texto: string };
  variante: "pagina" | "panel";
}) {
  useEffect(() => {
    console.error("[error-de-ruta]", error);
  }, [error]);

  // useSyncExternalStore con snapshot de servidor "en línea": evita un
  // desajuste de hidratación si el límite se renderiza primero en el servidor.
  const sinConexion = !useSyncExternalStore(suscribirConexion, () => navigator.onLine, () => true);
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  return (
    <EstadoPagina
      variante={variante}
      tono="error"
      icono={sinConexion ? WifiOff : TriangleAlert}
      titulo={sinConexion ? "No hay conexión a internet" : "No pudimos cargar esta página"}
      descripcion={
        sinConexion ? (
          <p>Revisa tu conexión y vuelve a intentarlo. Lo que ya guardaste no se pierde.</p>
        ) : (
          <p>
            Ocurrió un problema de nuestro lado. Vuelve a intentarlo; si se repite, escríbenos
            indicando el código de referencia.
          </p>
        )
      }
      referencia={digest}
      acciones={
        <>
          <Link href={salida.href} className={ESTADO_BTN_SECUNDARIO} style={ESTILO_BTN_SECUNDARIO}>
            {salida.texto}
          </Link>
          <button type="button" onClick={() => retry()} className={ESTADO_BTN_PRIMARIO}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </>
      }
    />
  );
}
