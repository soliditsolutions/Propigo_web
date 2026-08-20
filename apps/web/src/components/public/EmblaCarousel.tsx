"use client";

import { Children, useCallback, useEffect, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { EmblaCarouselType, EmblaEventType } from "embla-carousel";

/**
 * Carrusel público basado en Embla, combinando dos ejemplos oficiales:
 *
 *  - **Autoplay** (plugin `embla-carousel-autoplay`): avanza solo y se pausa
 *    al pasar el cursor / enfocar (`stopOnMouseEnter` + `stopOnInteraction:
 *    false` → reanuda al salir). Se desactiva por completo con
 *    `prefers-reduced-motion`.
 *  - **Parallax** (tween sobre el scroll): cada slide con `[data-parallax-layer]`
 *    desplaza su capa interna (la imagen) a distinta velocidad que el marco,
 *    dando profundidad. Los slides sin esa capa (p. ej. corredores, sin foto)
 *    simplemente no llevan parallax — el mismo componente sirve para ambas
 *    secciones.
 *
 * Reemplaza al marquee CSS anterior (Carousel.tsx): el viewport de Embla es
 * `overflow: hidden`, así que el contenido nunca se sale del contenedor.
 */

// Escala del parallax. Se multiplica por la cantidad de snaps para que el
// desplazamiento POR slide sea constante (~16%) sin importar cuántas tarjetas
// haya (con más snaps, cada diffToTarget es menor; el factor lo compensa).
const TWEEN_FACTOR_BASE = 0.16;

interface EmblaCarouselProps {
  children: React.ReactNode;
  ariaLabel: string;
  /** Activa el parallax de la capa `[data-parallax-layer]` interna de cada slide. */
  parallax?: boolean;
  /** Retardo del autoplay en ms. */
  autoplayDelay?: number;
  /** Desactiva el plugin de autoplay (p. ej. para tarjetas de texto: sin
   *  vitrina pasiva compitiendo con la lectura). Por defecto activo, para
   *  no cambiar el comportamiento de los carruseles ya existentes. */
  autoplay?: boolean;
}

export function EmblaCarousel({
  children,
  ariaLabel,
  parallax = false,
  autoplayDelay = 4200,
  autoplay = true,
}: EmblaCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: true, containScroll: "trimSnaps" },
    autoplay ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  );

  const tweenFactor = useRef(0);
  const tweenNodes = useRef<(HTMLElement | null)[]>([]);

  const setTweenNodes = useCallback((api: EmblaCarouselType) => {
    tweenNodes.current = api.slideNodes().map(
      (slide) => slide.querySelector<HTMLElement>("[data-parallax-layer]"),
    );
  }, []);

  const setTweenFactor = useCallback((api: EmblaCarouselType) => {
    tweenFactor.current = TWEEN_FACTOR_BASE * api.scrollSnapList().length;
  }, []);

  const tweenParallax = useCallback((api: EmblaCarouselType, eventName?: EmblaEventType) => {
    const engine = api.internalEngine();
    const scrollProgress = api.scrollProgress();
    const slidesInView = api.slidesInView();
    const isScrollEvent = eventName === "scroll";

    api.scrollSnapList().forEach((scrollSnap, snapIndex) => {
      let diffToTarget = scrollSnap - scrollProgress;
      const slidesInSnap = engine.slideRegistry[snapIndex];

      slidesInSnap.forEach((slideIndex) => {
        if (isScrollEvent && !slidesInView.includes(slideIndex)) return;

        if (engine.options.loop) {
          engine.slideLooper.loopPoints.forEach((loopItem) => {
            const target = loopItem.target();
            if (slideIndex === loopItem.index && target !== 0) {
              const sign = Math.sign(target);
              if (sign === -1) diffToTarget = scrollSnap - (1 + scrollProgress);
              if (sign === 1) diffToTarget = scrollSnap + (1 - scrollProgress);
            }
          });
        }

        const translate = diffToTarget * (-1 * tweenFactor.current) * 100;
        const node = tweenNodes.current[slideIndex];
        if (node) node.style.transform = `translateX(${translate}%)`;
      });
    });
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Movimiento reducido: sin autoplay ni parallax — queda un carrusel
    // arrastrable estático, respetando la preferencia del usuario.
    if (reduce) {
      emblaApi.plugins().autoplay?.stop();
      return;
    }

    if (!parallax) return;

    setTweenNodes(emblaApi);
    setTweenFactor(emblaApi);
    tweenParallax(emblaApi);

    emblaApi
      .on("reInit", setTweenNodes)
      .on("reInit", setTweenFactor)
      .on("reInit", tweenParallax)
      .on("scroll", tweenParallax)
      .on("slideFocus", tweenParallax);

    return () => {
      emblaApi
        .off("reInit", setTweenNodes)
        .off("reInit", setTweenFactor)
        .off("reInit", tweenParallax)
        .off("scroll", tweenParallax)
        .off("slideFocus", tweenParallax);
    };
  }, [emblaApi, parallax, setTweenNodes, setTweenFactor, tweenParallax]);

  return (
    <div className="embla" role="group" aria-label={ariaLabel}>
      <div className="embla__viewport" ref={emblaRef}>
        <div className="embla__container">
          {Children.map(children, (child, i) => (
            <div className="embla__slide" key={i}>
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
