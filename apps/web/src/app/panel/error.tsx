"use client";

import { ErrorDeRuta } from "@/components/ui/error-de-ruta";

/** Queda dentro del menú del panel: el corredor puede navegar a otra sección. */
export default function PanelError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorDeRuta error={error} retry={retry} variante="panel" salida={{ href: "/panel", texto: "Ir al resumen" }} />;
}
