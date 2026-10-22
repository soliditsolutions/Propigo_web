"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";

// Leaflet toca `window`/`document`: solo puede cargarse en el navegador.
const LeafletMapInner = dynamic(() => import("@/components/marketplace/LeafletMapInner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "var(--pgo-surface-2)" }}
    >
      <MapPin className="h-6 w-6 animate-pulse" style={{ color: "var(--pgo-text-4)" }} aria-hidden />
    </div>
  ),
});

/**
 * Mapa de la propiedad arrendada, para el portal del arrendatario.
 *
 * No reutiliza `PropertyMap` del marketplace a propósito: ese componente
 * está escrito para un visitante que evalúa arrendar ("el corredor autorizó
 * mostrar la ubicación exacta", "contacta para coordinar una visita") y usa
 * los tokens `--pf-*` del sitio público. Acá quien mira es el arrendatario
 * que YA vive en la propiedad, así que:
 *
 *  - La ubicación siempre va exacta. El flag `mostrarUbicacionExacta` existe
 *    para proteger la privacidad de una propiedad *publicada* frente a
 *    desconocidos; ocultarle el pin a quien vive ahí no protege nada y solo
 *    hace inútil el mapa.
 *  - El estilo usa los tokens `--pgo-*` del panel/portal, para que la tarjeta
 *    calce con el resto de las secciones.
 */
export function UbicacionSection({
  latitud,
  longitud,
  direccion,
}: {
  latitud: number | null;
  longitud: number | null;
  direccion: string;
}) {
  // Sin coordenadas no hay nada que dibujar. Se informa en vez de renderizar
  // un mapa vacío o, peor, centrado en el océano por un default de 0,0.
  const sinCoordenadas = latitud === null || longitud === null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--pgo-surface)",
        border: "1px solid var(--pgo-border)",
        boxShadow: "var(--pgo-shadow)",
      }}
    >
      <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--pgo-border)" }}>
        <h2
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--pgo-text-4)" }}
        >
          <MapPin className="h-4 w-4" aria-hidden />
          Ubicación
        </h2>
        <p className="mt-1 text-xs" style={{ color: "var(--pgo-text-3)" }}>
          {direccion}
        </p>
      </div>

      {sinCoordenadas ? (
        <div className="px-5 py-6 text-center">
          <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
            Todavía no hay coordenadas registradas para esta propiedad.
            Puedes pedirle a tu corredor que las agregue.
          </p>
        </div>
      ) : (
        <div className="h-64 w-full sm:h-80">
          <LeafletMapInner latitud={latitud} longitud={longitud} exacta />
        </div>
      )}
    </div>
  );
}
