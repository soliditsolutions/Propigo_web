"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Images } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Fotos visibles en el mosaico desde `sm`: la principal y cuatro miniaturas. */
export const FOTOS_MOSAICO = 5;

/**
 * Celdas del mosaico según cuántas fotos hay, para que la grilla de 4×2 quede
 * siempre llena: con 2 fotos van mitad y mitad, con 3 la principal y dos
 * franjas, y así. Las fotos que no caben se ocultan desde `sm` (en teléfono
 * todas van en el carrusel).
 */
export function celdaMosaico(i: number, total: number): string {
  if (i === 0) return "sm:col-span-2 sm:row-span-2";
  if (i >= FOTOS_MOSAICO) return "sm:hidden";
  if (total === 2) return "sm:col-span-2 sm:row-span-2";
  if (total === 3) return "sm:col-span-2";
  if (total === 4 && i === 1) return "sm:col-span-2";
  return "";
}

/**
 * Galería de la ficha pública. Antes mostraba solo tres fotos (el resto de las
 * que subió el corredor no se veía en ninguna parte) y las miniaturas usaban
 * `calc(50% - 4px)` sobre una fila sin alto definido, que en Safari colapsaba
 * a una franja de pocos píxeles.
 *
 * Un solo render: en teléfono es un carrusel con scroll-snap y contador; desde
 * `sm`, un mosaico de alto fijo con un botón que abre todas las fotos.
 */
export function GaleriaPropiedad({ titulo, imagenes }: { titulo: string; imagenes: readonly { url: string }[] }) {
  const pista = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const total = imagenes.length;

  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    let cuadro = 0;
    const medir = () => {
      // Solo cuenta en el carrusel; en el mosaico no hay scroll horizontal.
      if (el.clientWidth === 0 || el.scrollWidth <= el.clientWidth) return;
      setActual(Math.min(total - 1, Math.round(el.scrollLeft / el.clientWidth)));
    };
    const alDesplazar = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(medir); };
    el.addEventListener("scroll", alDesplazar, { passive: true });
    return () => { el.removeEventListener("scroll", alDesplazar); cancelAnimationFrame(cuadro); };
  }, [total]);

  const alt = (i: number) => (total > 1 ? `${titulo}, foto ${i + 1} de ${total}` : titulo);

  return (
    <div className="relative" role="region" aria-roledescription="galería" aria-label={`Fotos de ${titulo}`}>
      <div
        ref={pista}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] sm:grid sm:h-80 sm:grid-cols-4 sm:grid-rows-2 sm:gap-2 sm:overflow-visible lg:h-96 [&::-webkit-scrollbar]:hidden"
        // Con teclado, el carrusel se recorre con las flechas una vez enfocado.
        tabIndex={total > 1 ? 0 : undefined}
      >
        {imagenes.map((img, i) => (
          <div
            key={img.url}
            className={`relative aspect-[4/3] w-full shrink-0 snap-center overflow-hidden sm:aspect-auto sm:rounded-2xl ${total === 1 ? "sm:col-span-4 sm:row-span-2" : celdaMosaico(i, total)}`}
            style={{ background: "var(--pf-hero-1)" }}
          >
            <Image
              src={img.url}
              alt={alt(i)}
              fill
              className="object-cover"
              sizes={i === 0 ? "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 512px" : "(max-width: 639px) 100vw, 256px"}
              preload={i === 0}
              loading={i === 0 ? undefined : "lazy"}
            />
          </div>
        ))}
      </div>

      {total > 1 && (
        <span
          className="pgo-num pointer-events-none absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-xs font-semibold sm:hidden"
          style={{ background: "rgb(15 23 42 / 0.72)", color: "#fff" }}
          aria-live="polite"
        >
          {actual + 1} / {total}
        </span>
      )}

      {total > FOTOS_MOSAICO && (
        <Dialog>
          <DialogTrigger
            className="pgo-glass absolute bottom-3 right-3 hidden min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold sm:inline-flex"
            style={{ color: "var(--pf-navy)", border: "1px solid var(--pf-border)" }}
          >
            <Images className="h-4 w-4" aria-hidden="true" />
            Ver las {total} fotos
          </DialogTrigger>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl lg:max-w-4xl" showCloseButton>
            <DialogTitle className="text-base font-bold" style={{ color: "var(--pf-navy)" }}>
              {titulo}
            </DialogTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              {imagenes.map((img, i) => (
                <li key={img.url} className="relative aspect-[4/3] overflow-hidden rounded-xl" style={{ background: "var(--pf-hero-1)" }}>
                  <Image src={img.url} alt={alt(i)} fill className="object-cover" sizes="(max-width: 639px) 100vw, 448px" loading="lazy" />
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
