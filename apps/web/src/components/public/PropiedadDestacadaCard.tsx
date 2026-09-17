import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { RatingStars } from "./RatingStars";
import { BorderGlow } from "@/components/ui/border-glow";
import { clpOrUf } from "@/lib/format";
import { tipoMeta } from "@/lib/propiedad-meta";

export interface PropiedadDestacada {
  publicacionId:      string;
  titulo:             string;
  tipo:               string;
  comuna:             string | null;
  region:             string | null;
  imagenUrl:          string | null;
  precioReferencia:   number | null;
  denominacionPrecio: string | null;
  corredorNombre:     string;
  corredorPromedio:   number | null;
  corredorTotal:      number;
}

/** Tarjeta de propiedad destacada del home. No existe un rating por
 * propiedad en el modelo de datos (solo por corredor) — se muestra el
 * rating del corredor asociado, que es también el criterio de orden
 * ("propiedades gestionadas por los corredores mejor valorados"). */
export function PropiedadDestacadaCard({ propiedad }: { propiedad: PropiedadDestacada }) {
  const meta = tipoMeta(propiedad.tipo);
  const Icon = meta.icon;

  return (
    <BorderGlow radius={20} className="w-72 shrink-0">
    <Link
      href={`/marketplace/${propiedad.publicacionId}`}
      className="hw-auth-card group flex w-full flex-col overflow-hidden p-0"
    >
      <div className={`relative h-24 w-full overflow-hidden ${propiedad.imagenUrl ? "" : "pf-img-empty"}`}>
        {propiedad.imagenUrl ? (
          // Capa de parallax: EmblaCarousel desplaza este contenedor en X según
          // el scroll (ver [data-parallax-layer] en globals.css, sobredimensionado
          // ~144% para no revelar bordes). El `fill` + `sizes` deja al navegador
          // pedir la variante justa en vez de la foto original a tamaño completo.
          <div data-parallax-layer>
            <Image
              src={propiedad.imagenUrl}
              alt=""
              fill
              sizes="512px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon className="h-11 w-11" style={{ color: "var(--pf-border-input)" }} aria-hidden="true" />
          </div>
        )}
        <span
          className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
        >
          {meta.label}
        </span>
        <span
          className="absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
          style={{ background: "var(--hw-success-lt)", color: "var(--hw-success-dk)" }}
        >
          Disponible
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-1 text-sm font-bold" style={{ color: "var(--pf-navy)" }}>
          {propiedad.titulo}
        </h3>
        <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--pf-text-muted)" }}>
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          {propiedad.comuna || propiedad.region || "Ubicación no especificada"}
        </p>

        <div className="mt-2 flex items-center justify-between">
          <p className="text-sm font-bold" style={{ color: "var(--pf-purple)" }}>
            {clpOrUf(propiedad.precioReferencia, propiedad.denominacionPrecio)} /mes
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2.5" style={{ borderTop: "1px solid var(--pf-border)" }}>
          <div>
            <p className="text-[11px]" style={{ color: "var(--pf-text-light)" }}>{propiedad.corredorNombre}</p>
            {propiedad.corredorPromedio !== null && (
              <RatingStars
                promedio={propiedad.corredorPromedio}
                total={propiedad.corredorTotal}
                size="xs"
                label="Corredor"
              />
            )}
          </div>
          <ArrowRight
            className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1"
            style={{ color: "var(--pf-purple)" }}
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
    </BorderGlow>
  );
}

