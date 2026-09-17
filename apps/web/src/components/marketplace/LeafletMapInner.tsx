"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type LeafletMapInnerProps = {
  latitud: number;
  longitud: number;
  /** true = pin exacto; false = solo círculo de área aproximada, sin marcador. */
  exacta: boolean;
};

export default function LeafletMapInner({ latitud, longitud, exacta }: LeafletMapInnerProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return;

    const mapa = L.map(contenedorRef.current, {
      center: [latitud, longitud],
      zoom: exacta ? 16 : 14,
      scrollWheelZoom: false,
    });
    mapaRef.current = mapa;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapa);

    if (exacta) {
      // Ícono propio en vez del marcador por defecto de Leaflet: sus PNG
      // (marker-icon.png, etc.) resuelven mal con bundlers como Turbopack,
      // que no reescriben las rutas relativas que usa L.Icon.Default.
      const pinIcon = L.divIcon({
        className: "hw-map-pin",
        html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.27 21.73 0 14 0z" fill="#7C3AED"/>
          <circle cx="14" cy="14" r="5.5" fill="white"/>
        </svg>`,
        iconSize: [28, 40],
        iconAnchor: [14, 40],
      });
      L.marker([latitud, longitud], { icon: pinIcon }).addTo(mapa);
    } else {
      const circulo = L.circle([latitud, longitud], {
        radius: 400,
        color: "#7C3AED",
        weight: 1.5,
        fillColor: "#7C3AED",
        fillOpacity: 0.15,
      }).addTo(mapa);
      mapa.fitBounds(circulo.getBounds());
    }

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, [latitud, longitud, exacta]);

  // `isolate` fuerza un nuevo stacking context sobre este div. Sin él,
  // `.leaflet-container` queda en `position: relative; z-index: auto` (así
  // lo define el CSS de Leaflet) — eso NO crea stacking context propio, así
  // que los panes internos de Leaflet (z-index 200-700 en tiles/marcadores)
  // terminan compitiendo en el stacking context de la RAÍZ del documento en
  // vez de quedar contenidos aquí. Un modal en otra parte de la página con
  // z-index 50 (razonable para un overlay) perdía contra eso y el mapa se
  // veía "por encima" del modal, tapando sus campos.
  return <div ref={contenedorRef} className="isolate h-full w-full" />;
}
