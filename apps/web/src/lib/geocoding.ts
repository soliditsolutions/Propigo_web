/**
 * Geocodificación best-effort de direcciones chilenas vía Nominatim (OpenStreetMap).
 *
 * Nominatim es gratuito y no requiere API key, pero exige un User-Agent
 * identificable y máximo 1 solicitud/segundo por IP (política de uso de OSM).
 * Si la geocodificación falla (dirección ambigua, servicio caído, timeout),
 * la propiedad simplemente queda sin latitud/longitud — nunca debe bloquear
 * la creación/edición de la propiedad.
 */

import { logError } from "./logger";
import { MARCA, CORREO } from "@/lib/marca";

export type Coordenadas = { latitud: number; longitud: number };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = `${MARCA}/1.0 (${CORREO.tecnologia})`;

// Nominatim geocodifica a nivel de edificio/calle, no de unidad interna —
// un segmento como "depto 12" o "oficina 304" en la dirección hace que la
// búsqueda completa no encuentre nada (0 resultados) aunque el edificio en
// sí sí esté indexado en OSM. Se descartan esos segmentos solo para la
// consulta a Nominatim; la dirección original (con la unidad) sigue
// siendo la que se guarda y se muestra al usuario.
const UNIT_SUFFIX_RE = /^(depto\.?|dpto\.?|oficina|of\.?|casa|local|piso|block|bloque|torre)\s*\.?\s*\S+$/i;

function direccionParaGeocodificar(direccion: string): string {
  const limpia = direccion
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !UNIT_SUFFIX_RE.test(s))
    .join(", ");
  // Si tras filtrar no queda nada (la dirección era solo un segmento de
  // unidad, caso extremo), mejor intentar con el texto original que con
  // una consulta vacía.
  return limpia || direccion;
}

export async function geocodificarDireccion(
  direccion: string,
  comuna: string | null,
  region: string | null,
): Promise<Coordenadas | null> {
  if (!direccion.trim()) return null;
  const query = [direccionParaGeocodificar(direccion), comuna, region, "Chile"].filter(Boolean).join(", ");

  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
      countrycodes: "cl",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;

    const lat = Number(data[0].lat);
    const lon = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { latitud: lat, longitud: lon };
  } catch (e) {
    logError("geocodificarDireccion", e);
    return null;
  }
}

/**
 * Aplica un desplazamiento pseudo-aleatorio pero determinístico a una
 * coordenada, para mostrar un área aproximada en el mapa público cuando el
 * corredor no ha autorizado mostrar la ubicación exacta (mostrarUbicacionExacta=false).
 *
 * SEC: el desplazamiento se deriva de un hash del id interno de la propiedad
 * — un valor que esta ruta nunca envía al cliente (solo se expone el id de
 * la Publicacion). Es estable entre recargas (mismo punto siempre) pero no
 * es reconstruible a partir de lo que el navegador recibe: quien inspeccione
 * la respuesta HTML/JSON solo ve el punto ya desplazado, nunca el real.
 */
export function ubicacionAproximada(
  lat: number,
  lng: number,
  seedId: string,
): Coordenadas {
  const hash = hashCadena(seedId);
  const anguloRad = (hash % 360) * (Math.PI / 180);
  const radioMetros = 150 + (Math.floor(hash / 360) % 250); // 150–400 m

  const deltaLat = (radioMetros * Math.cos(anguloRad)) / 111_320;
  const deltaLng =
    (radioMetros * Math.sin(anguloRad)) /
    (111_320 * Math.cos((lat * Math.PI) / 180));

  return { latitud: lat + deltaLat, longitud: lng + deltaLng };
}

function hashCadena(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
