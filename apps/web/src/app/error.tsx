"use client";

import { ErrorDeRuta } from "@/components/ui/error-de-ruta";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorDeRuta error={error} retry={retry} variante="pagina" salida={{ href: "/", texto: "Ir al inicio" }} />;
}
