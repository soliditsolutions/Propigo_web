import Image, { type StaticImageData } from "next/image";

/**
 * Foto de fondo decorativa con overlay oscuro configurable — usada para dar
 * color/calidez fotográfica a paneles que hoy son 100% abstractos (aurora +
 * glass). `objectPosition` recorta hacia el lado limpio de las fotos de stock
 * en src/images/banners (que traen paneles de texto en inglés incrustados en
 * el lado izquierdo): apuntar al 70-80% horizontal muestra a las personas sin
 * el texto. El padre DEBE tener `position: relative` y una altura definida.
 */
export function PhotoBanner({
  src,
  objectPosition = "72% center",
  overlay = "linear-gradient(175deg, color-mix(in srgb, var(--pgo-sidebar) 91%, transparent) 0%, color-mix(in srgb, var(--pgo-sidebar) 97%, transparent) 100%)",
  preload = false,
}: {
  src: StaticImageData;
  objectPosition?: string;
  overlay?: string;
  preload?: boolean;
}) {
  return (
    <>
      <Image
        src={src}
        alt=""
        fill
        preload={preload}
        sizes="(max-width: 1024px) 100vw, 480px"
        className="object-cover"
        style={{ objectPosition }}
      />
      <div className="absolute inset-0" style={{ background: overlay }} aria-hidden="true" />
    </>
  );
}
