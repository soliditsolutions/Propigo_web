"use client";

import { ErrorDeRuta } from "@/components/ui/error-de-ruta";
import { MARCA } from "@/lib/marca";
import "./globals.css";

/**
 * Último recurso: reemplaza al layout raíz cuando es él el que falla. Debe
 * traer su propio <html>/<body> y estilos. El script anti-parpadeo del layout
 * no corre aquí (necesita el nonce del proxy); ErrorDeRuta aplica el tema al
 * montar.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es">
      <body className="min-h-full antialiased">
        <title>{`Error | ${MARCA}`}</title>
        <ErrorDeRuta error={error} retry={retry} variante="pagina" salida={{ href: "/", texto: "Ir al inicio" }} />
      </body>
    </html>
  );
}
