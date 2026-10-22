"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import { ChevronDown } from "lucide-react";
import { setActiveSection } from "./PublicNavLinks";
import { ScrollReveal } from "./ScrollReveal";

/**
 * Si el escenario queda "pinned" (fijado, desktop) o "stacked" (apilado,
 * mobile/reduced-motion) se decide de forma asíncrona tras hidratar (ver
 * el primer `useLayoutEffect` de abajo) — antes de eso vale `null` ("todavía
 * no se sabe"). HomeHashHandler necesita esta señal para el caso de llegar
 * a "/#<ancla>" desde otra página: si intentara hacer scroll antes de que
 * esto se resuelva, `document.getElementById(ancla)` puede encontrar el
 * marcador equivocado (el id vive en un lugar distinto según el modo) o
 * ninguno, y aterrizar mal. Mismo patrón de mini-store externo que
 * `activeSection` en PublicNavLinks, por la misma razón: viven en partes
 * distintas del árbol.
 */
type LayoutMode = "pinned" | "stacked" | null;
let layoutMode: LayoutMode = null;
const layoutModeListeners = new Set<() => void>();

export function getWalkthroughLayoutMode() {
  return layoutMode;
}

export function subscribeWalkthroughLayoutMode(listener: () => void) {
  layoutModeListeners.add(listener);
  return () => layoutModeListeners.delete(listener);
}

function setWalkthroughLayoutMode(mode: "pinned" | "stacked") {
  layoutMode = mode;
  layoutModeListeners.forEach((l) => l());
}

export type WalkStop = {
  /**
   * Fotograma de fondo de esta parada. Opcional: una parada sin foto (ej.
   * "Nuestros Planes") muestra el `--pgo-page` liso que ya queda detrás del
   * crossfade — el mismo tratamiento "tarjeta glass sobre aurora, no sobre
   * foto" que login/registro y que el modo apilado ya le daba a esta parada.
   * Una decisión de compra necesita más calma visual que una parada narrativa.
   */
  image?: StaticImageData;
  /** Contenido (UI) que aparece sobre la foto en esta parada. */
  node: ReactNode;
  /**
   * id para enlaces con hash (ej. "conocenos"). Con el escenario fijado la
   * parada vive superpuesta arriba del todo, así que el ancla no puede ir en
   * ella: se emite un marcador invisible a la altura de scroll donde esa
   * parada queda activa (parada i ⇒ i × SCROLL_PER_STOP_VH dentro de la pista).
   */
  anchorId?: string;
};

// Cuánto scroll físico (en vh) hace falta para pasar de una parada a la
// siguiente. 100vh sería 1:1 con la pantalla — con eso, un scroll chico ya
// desplazaba bastante el progreso y la transición se sentía a la primera
// señal de la rueda, sin margen. Con más recorrido por parada, hace falta
// "empujar" un poco más antes de que algo se mueva de verdad, y un scroll
// que no llega a completar la transición queda muy lejos del punto de cruce
// como para leerse a medio camino — vuelve a foco limpio en vez de difuso.
//
// Subido de 160 a 220: con 160, un scroll rápido y sostenido (flick fuerte de
// trackpad, rueda a fondo) atravesaba una parada intermedia en ~0.23s —
// apenas un parpadeo, se sentía como "saltarse" la categoría. `target` se
// recalcula en cada frame desde la posición de scroll EN VIVO (no es un salto
// a un punto fijo), así que mientras el usuario siga scrolleando rápido, el
// lerp nunca llega a desacelerar cerca de una parada intermedia — solo
// cruzarla más lento ayuda, y eso se logra con más distancia física por
// parada, no ajustando el lerp (que apenas mueve la aguja aquí, verificado
// por simulación). Con 220vh el mismo scroll rápido da ~0.33s de lectura
// (+43%) y el scroll normal también mejora (no es un trade-off, ambos ganan);
// el costo es una página ~30% más larga en total scroll.
const SCROLL_PER_STOP_VH = 220;

// La última parada cae justo en el borde donde el escenario se despega de
// `position: sticky` (scrollY === sectionTop + travel, el máximo posible).
// A ese pixel exacto, según redondeo, el navegador puede considerarlo ya
// "despegado" — la parada aparece descentrada (cortada arriba, aire de más
// abajo) en vez de fijada en pantalla completa. Este margen mueve tanto el
// ancla como el snap de esa última parada unos pixeles ANTES del borde, para
// aterrizar siempre del lado seguro (todavía fijado).
const LAST_STOP_SAFETY_PX = 4;

// Paso máximo del lerp por frame (en unidades de `pos`, 1 = una parada).
// El scrub usa `current += (target - current) * 0.14` — proporcional a la
// distancia. Esto NO es lo que arregla el "se saltea 2 categorías" del scroll
// rápido y SOSTENIDO (eso lo resuelve subir SCROLL_PER_STOP_VH arriba, ver su
// comentario — con target recalculándose en cada frame desde el scroll en
// vivo, el lerp casi no cambia el tiempo de cruce, verificado por
// simulación). Este tope cubre un caso distinto: un salto INSTANTÁNEO de
// `target` en un solo tick (ej. click en el navbar hacia una parada lejana,
// o `scrollIntoView` disparado por código) — sin tope, `current` cruzaría las
// paradas de en medio a máxima velocidad proporcional al salto. No toca el
// caso normal (transición a la parada vecina, diff≈1 → paso≈0.14, bajo el
// tope).
const MAX_TICK_STEP = 0.16;

// Amplificación aplicada a cada evento de rueda/trackpad antes de convertirlo
// en scroll real (ver `onWheel` más abajo). Sin esto, cruzar una parada
// completa (SCROLL_PER_STOP_VH) con una rueda de mouse tradicional — que
// entrega ~100-120px de scroll nativo por "click" — pedía unas 20 vueltas de
// rueda: se sentía pesado, sobre todo comparado con trackpad (que ya scrollea
// fluido por naturaleza). Con 2x, la misma parada pide la mitad.
const WHEEL_AMPLIFY = 2;

// Tope de píxeles que un solo evento de rueda puede mover, YA amplificado.
// Una rueda física entrega ~100-120px por click — bien por debajo del tope,
// así que un scroll normal no lo nota. Lo que acota es el caso contrario: un
// evento de deltaY grande (fling de trackpad, mouse de alta resolución)
// amplificado 2x podría saltar una distancia enorme de una sola vez. Esto no
// solo protege el amplificador nuevo — mejora la protección que ya existía
// contra "saltarse una categoría" con scroll muy rápido (antes el scroll
// nativo no tenía ningún tope por evento).
const WHEEL_MAX_STEP_PX = 240;

// Normaliza `deltaY` a píxeles sin importar `deltaMode`. En Chrome/Edge casi
// siempre es 0 (píxeles) incluso para rueda física — los casos 1 y 2 son
// infrecuentes en la práctica (algunos navegadores/configuraciones antiguas)
// pero sin este ajuste un deltaY "en líneas" se leería como si fueran
// píxeles y el salto resultante sería minúsculo o gigante según el caso.
function wheelDeltaToPx(e: WheelEvent) {
  if (e.deltaMode === 1) return e.deltaY * 16;
  if (e.deltaMode === 2) return e.deltaY * window.innerHeight;
  return e.deltaY;
}

/**
 * Escenario "walkthrough": el fondo fotográfico queda fijado ocupando la
 * pantalla mientras el usuario scrollea por una pista alta y transparente;
 * conforme avanza, los fotogramas hacen crossfade de uno al siguiente y la UI
 * de cada parada entra y sale sobre la escena.
 *
 * El layout fijado (pista de N×100vh + `sticky`) vive en CSS — ver
 * `.pgo-walk-*` en globals.css — para que el primer paint ya sea correcto.
 * Este componente solo calcula el progreso y anima opacidad/desplazamiento.
 *
 * Scrub con inercia: el valor mostrado persigue al objetivo con un lerp
 * (~0.14/frame) en vez de seguirlo 1:1 — da "peso cinematográfico" y evita
 * cortes bruscos al girar la rueda muy rápido.
 *
 * Acepta N paradas: hoy 4 fotogramas clave. Si más adelante se graba el
 * recorrido real en video y se exporta como secuencia, el mismo componente
 * recibe esos frames sin cambios de arquitectura.
 */
export function ScrollWalkthrough({
  stops,
  /** % de color de página mezclado sobre la foto (legibilidad). Menor = foto más visible.
   * Bajado de {58,30,62}: --pgo-page es un extremo opuesto por tema (casi negro en
   * oscuro, casi blanco en claro) — con esos valores la MISMA intensidad lavaba la
   * foto hacia negro en un tema y hacia blanco en el otro, perdiendo nitidez en
   * ambos. El texto no depende de este velo para contraste: cada parada vive sobre
   * su propia tarjeta glass (.pgo-walk-panel / .pgo-auth-card), así que se puede
   * bajar bastante sin comprometer legibilidad. */
  scrim = { top: 30, mid: 12, bottom: 34 },
}: {
  stops: WalkStop[];
  scrim?: { top: number; mid: number; bottom: number };
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stopRefs   = useRef<(HTMLDivElement | null)[]>([]);
  const [motionEnabled, setMotionEnabled] = useState(false);
  // Si el layout está fijado (media query de escritorio, sin scripting/
  // reduced-motion) — se decide aparte de `motionEnabled` porque este último
  // solo se activa dentro de tick() (que corre en un requestAnimationFrame
  // posterior al primer scroll/mount). Con un `useEffect` normal, en la
  // ventana entre el mount y ese primer rAF, el marcador de ancla ("#conocenos")
  // todavía no existe: un click en "Conócenos" o el handler que llega desde
  // otra página (ver ConocenosHashHandler) puede correr justo en ese hueco y
  // no encontrar el elemento — scrollIntoView es un no-op silencioso. Con
  // useLayoutEffect, `pinned` queda listo antes del primer paint del cliente
  // (sin depender de scroll ni de que decodifique ninguna imagen).
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState(0);
  // Fotogramas ya decodificados. Hasta que estén todos, el recorrido se queda
  // en la primera parada: si se permite scrubbear antes, al llegar rápido a un
  // fotograma aún no descargado la pantalla queda en negro un instante.
  const [loaded, setLoaded] = useState(0);

  const n = stops.length;
  // Paradas sin foto (ver WalkStop.image) nunca disparan `onLoad` — contar
  // contra `n` las habría dejado esperando por siempre el safety-net de 3s
  // en cada carga. `loaded` solo cuenta imágenes reales, así que se compara
  // contra cuántas hay, no contra el total de paradas.
  const imageStops = stops.filter((s) => s.image).length;
  const framesReady = loaded >= imageStops;
  // Solo se anima cuando el efecto está activo Y las fotos están listas.
  const active = motionEnabled && framesReady;

  // Corre antes del primer paint del cliente — así `pinned` (y con él, el
  // marcador de ancla) está listo casi de inmediato, sin depender de que el
  // usuario haga scroll (el efecto de abajo solo activa `motionEnabled`
  // dentro de tick(), programado desde un useEffect normal — un rAF extra de
  // margen frente a ese camino). El setState va dentro del rAF (no
  // sincrónico en el cuerpo del efecto) para no encadenar renders en el
  // commit, tal como ya se hace en el efecto de scroll de abajo.
  useLayoutEffect(() => {
    // `lg` (1024px), no `md` (768px): a 768px un tablet en portrait no tiene
    // ancho de sobra para el escenario cinematográfico de escritorio (el
    // navbar completo tampoco cabe ahí — ver el mismo corte en
    // PublicNavLinks/PublicNavMenu). Por debajo de 1024px el modo apilado
    // (rediseñado para mobile-first, no un clon aplanado del escenario) es
    // la experiencia correcta, no solo un fallback de degradación.
    const desktopMq = window.matchMedia("(min-width: 1024px)");
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const raf = requestAnimationFrame(() => {
      const isPinned = desktopMq.matches && !reduceMq.matches;
      setPinned(isPinned);
      setWalkthroughLayoutMode(isPinned ? "pinned" : "stacked");
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const reduceMq  = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopMq = window.matchMedia("(min-width: 1024px)");

    let raf = 0;
    let attached = false;
    let current = 0;
    let snapTimer = 0;

    // Devuelve tanto el progreso 0..1 (para el snap) como el rect ya leído,
    // así onScrollEnd no repite el mismo getBoundingClientRect.
    function readRect() {
      const el = sectionRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return null;
      return { rect, travel };
    }

    function readTarget() {
      const r = readRect();
      if (!r) return 0;
      const p = Math.min(1, Math.max(0, -r.rect.top / r.travel));
      return p * (n - 1);
    }

    function tick() {
      raf = 0;
      const target = readTarget();
      const step = (target - current) * 0.14;
      const clampedStep = Math.sign(step) * Math.min(Math.abs(step), MAX_TICK_STEP);
      current += clampedStep;
      if (Math.abs(target - current) < 0.0008) current = target;
      setPos(current);
      setMotionEnabled(true);
      // Sigue animando hasta alcanzar el objetivo (inercia del scrub).
      if (current !== target) raf = requestAnimationFrame(tick);
    }

    // Al dejar de scrollear a mitad de una transición, termina el viaje
    // hacia la parada más cercana en vez de dejarlo a medio camino (solo la
    // foto, sin ninguna UI encima — se leía como que la página se congeló).
    // Mueve el scroll real (no solo el estado visual): el propio lerp de
    // tick() ya se encarga de que la UI llegue con la misma inercia
    // "cinematográfica" de siempre, ni instantáneo ni lento.
    function onScrollEnd() {
      const r = readRect();
      if (!r) return;
      // Píxeles scrolleados MÁS ALLÁ del punto donde el sticky se despega
      // (positivo = el usuario ya salió del escenario hacia el footer). El
      // progreso de abajo se clampea a la última parada, así que sin esta
      // salida el snap lo "secuestraba" de vuelta al escenario y el footer
      // quedaba inalcanzable: cada vez que soltaba la rueda, volvía a subir.
      // El umbral es apenas mayor que el margen de seguridad: aterrizar
      // JUSTO en el borde (overshoot ≈ 0, el caso del bug de sticky-release)
      // sí se corrige; pasarse de largo con intención, no.
      const overshoot = -r.rect.top - r.travel;
      if (overshoot > LAST_STOP_SAFETY_PX * 2) return;
      const rawPos = Math.min(1, Math.max(0, -r.rect.top / r.travel)) * (n - 1);
      const nearest = Math.round(rawPos);
      const isLastStop = nearest === n - 1;
      // La tolerancia de "ya está bastante cerca, no molestar" (pensada para
      // no reajustar de más en paradas intermedias) equivale a varios
      // píxeles reales cerca del borde de la última parada — más que
      // suficiente para caer del lado "despegado" del sticky (ver
      // LAST_STOP_SAFETY_PX arriba) sin que esta guarda lo detecte. Para esa
      // parada puntual siempre se recalcula el aterrizaje exacto.
      if (!isLastStop && Math.abs(rawPos - nearest) < 0.02) return;
      const targetRectTop = -r.travel * (nearest / (n - 1));
      const safety = isLastStop ? LAST_STOP_SAFETY_PX : 0;
      const newTop = window.scrollY + (r.rect.top - targetRectTop) - safety;
      if (isLastStop && Math.abs(newTop - window.scrollY) < 0.5) return;
      // "smooth" en vez de "instant": el salto al soltar la rueda a medio
      // camino se sentía como un tirón. El propio scroll nativo ahora anima
      // el acomodo; tick() sigue leyendo la posición en vivo en cada frame,
      // así que el crossfade acompaña ese movimiento en vez de quedar
      // desincronizado.
      window.scrollTo({ top: newTop, behavior: "smooth" });
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(tick);
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(onScrollEnd, 150);
    }

    // Reemplaza el scroll nativo de la rueda/trackpad DENTRO del escenario por
    // uno amplificado (ver constantes arriba). Al estar en el propio
    // `sectionRef.current` (no en `window`), esto se auto-limita: mientras el
    // cursor esté sobre el escenario (toda su extensión de N×220vh) los
    // eventos le llegan a él primero; apenas el usuario scrollea más allá del
    // final (el `sticky` se despega y el footer entra a la pantalla), el
    // cursor deja de estar sobre este elemento y la rueda vuelve a comportarse
    // nativamente — sin necesidad de revisar la posición de scroll acá.
    function onWheel(e: WheelEvent) {
      const raw = wheelDeltaToPx(e);
      if (raw === 0) return;
      e.preventDefault();
      const amplified = Math.sign(raw) * Math.min(Math.abs(raw) * WHEEL_AMPLIFY, WHEEL_MAX_STEP_PX);
      // "instant", no "auto": `html` tiene `scroll-behavior: smooth` a nivel
      // global (para la navegación por ancla del navbar) — "auto" hereda esa
      // CSS y cada notch de rueda quedaba animándose de a poco en vez de
      // saltar ya. tick() ya provee su propio suavizado (el lerp del
      // crossfade), así que el salto de scroll en sí debe ser inmediato.
      window.scrollBy({ top: amplified, behavior: "instant" });
    }

    function sync() {
      const enable = !reduceMq.matches && desktopMq.matches;
      setPinned(enable);
      if (enable && !attached) {
        attached = true;
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        sectionRef.current?.addEventListener("wheel", onWheel, { passive: false });
        raf = requestAnimationFrame(tick);
      } else if (!enable && attached) {
        attached = false;
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onScroll);
        sectionRef.current?.removeEventListener("wheel", onWheel);
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        window.clearTimeout(snapTimer);
        current = 0;
        setPos(0);
        setMotionEnabled(false);
      }
    }

    sync();
    reduceMq.addEventListener("change", sync);
    desktopMq.addEventListener("change", sync);
    return () => {
      reduceMq.removeEventListener("change", sync);
      desktopMq.removeEventListener("change", sync);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(snapTimer);
    };
  }, [n]);

  // Las paradas inactivas salen del orden de tabulación: sin esto se puede
  // tabular a botones invisibles (mismo criterio que el drawer de filtros).
  const activeIndex = Math.round(pos);
  useEffect(() => {
    stopRefs.current.forEach((el, i) => {
      if (el) el.inert = active && i !== activeIndex;
    });
  }, [activeIndex, active]);

  // Scroll-spy (modo fijado): el navbar vive en otra parte del árbol (ver
  // PublicNavLinks), así que en vez de prop-drilling avisa por el store
  // compartido qué parada está a la vista. Depende de `pinned`, no de
  // `active` (que también exige framesReady) — el progreso de scroll ya es
  // válido apenas motionEnabled arranca, sin esperar a que las fotos carguen.
  useEffect(() => {
    if (!pinned) return;
    setActiveSection(stops[activeIndex]?.anchorId ?? null);
  }, [pinned, activeIndex, stops]);

  // Scroll-spy (modo apilado: mobile o reduced-motion): ahí cada parada es
  // una sección normal de la página, así que en vez de progreso continuo
  // basta observar cuál cruza el centro del viewport. La parada 0 (hero)
  // no tiene anchorId — se observa igual y se mapea a `null` ("Inicio").
  useEffect(() => {
    if (pinned) return;
    const entries = stopRefs.current
      .map((el, i) => (el ? { el, id: stops[i]?.anchorId ?? null } : null))
      .filter((e): e is { el: HTMLDivElement; id: string | null } => e !== null);
    if (entries.length === 0) return;

    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed.filter((o) => o.isIntersecting);
        if (visible.length === 0) return;
        const closest = visible.reduce((a, b) =>
          Math.abs(a.boundingClientRect.top) < Math.abs(b.boundingClientRect.top) ? a : b,
        );
        const match = entries.find((e) => e.el === closest.target);
        if (match) setActiveSection(match.id);
      },
      // Franja angosta centrada en el viewport: dispara cuando una parada
      // cruza el medio de la pantalla, no apenas asoma por abajo.
      { rootMargin: "-45% 0px -50% 0px" },
    );
    entries.forEach(({ el }) => observer.observe(el));
    return () => observer.disconnect();
  }, [pinned, stops]);

  // Al desmontar (navegar fuera del Home) no dejamos una sección "pegada":
  // si se vuelve, el próximo mount la recalcula de inmediato de todos modos,
  // pero esto evita un parpadeo con el valor viejo mientras tanto.
  useEffect(() => {
    return () => setActiveSection(null);
  }, []);

  // Red de seguridad: si algún `onLoad` no llega (imagen servida desde caché
  // en ciertos navegadores), no dejamos el recorrido trabado en la parada 1.
  useEffect(() => {
    if (!motionEnabled || framesReady) return;
    const t = window.setTimeout(() => setLoaded(n), 3000);
    return () => window.clearTimeout(t);
  }, [motionEnabled, framesReady, n]);

  const scrimBg =
    `linear-gradient(to bottom,` +
    ` color-mix(in srgb, var(--pgo-page) ${scrim.top}%, transparent) 0%,` +
    ` color-mix(in srgb, var(--pgo-page) ${scrim.mid}%, transparent) 40%,` +
    ` color-mix(in srgb, var(--pgo-page) ${scrim.mid}%, transparent) 60%,` +
    ` color-mix(in srgb, var(--pgo-page) ${scrim.bottom}%, transparent) 100%)`;


  return (
    <section
      ref={sectionRef}
      className="pgo-walk-section"
      // La última parada solo necesita la pantalla final (100vh); el
      // recorrido hasta ahí son (n-1) tramos de SCROLL_PER_STOP_VH — así
      // travel/(n-1) da exactamente SCROLL_PER_STOP_VH, que es lo que usan
      // los marcadores de ancla de abajo para alinearse con pos === i.
      style={{ "--pgo-walk-height": `${(n - 1) * SCROLL_PER_STOP_VH + 100}vh` } as CSSProperties}
    >
      {/* Marcadores de ancla — invisibles, a la altura de scroll de cada parada.
          Gateados por `pinned` (listo antes del primer paint, ver arriba) y no
          por `motionEnabled`: si dependieran de este último, un click en
          "Conócenos" — o el handler que llega desde otra página — podía
          correr en el hueco antes de que existiera el marcador y quedar sin
          efecto (scrollIntoView sobre un elemento que aún no existe). */}
      {pinned &&
        stops.map((s, i) =>
          s.anchorId ? (
            <div
              key={`anchor-${s.anchorId}`}
              id={s.anchorId}
              // Sin scroll-margin: el marcador es invisible y el contenido de
              // la parada va centrado en el viewport, así que no hay navbar
              // que despejar — un margen aquí dejaría el recorrido a medio
              // camino de la parada (pos ≈ 2.87 en vez de 3). La ÚLTIMA
              // parada sí resta unos pixeles (LAST_STOP_SAFETY_PX): cae justo
              // en el borde de scroll donde el `sticky` se despega, y sin
              // este margen un click puede aterrizar ya "despegado".
              className="absolute left-0 h-px w-px"
              style={{
                top: i === n - 1
                  ? `calc(${i * SCROLL_PER_STOP_VH}vh - ${LAST_STOP_SAFETY_PX}px)`
                  : `${i * SCROLL_PER_STOP_VH}vh`,
              }}
              aria-hidden="true"
            />
          ) : null,
        )}

      <div className="pgo-walk-stage">
        {/* ── Fondo: fotogramas + velo de legibilidad ── */}
        <div className="pgo-walk-frames" aria-hidden="true">
          {stops.map((s, i) => {
            // Los fotogramas solo se montan con el efecto activo. Hasta
            // entonces (y siempre en modo apilado) la escena inicial la pone
            // el fondo de la parada 0, así nunca hay una copia oculta de la
            // misma foto: el mismo src y `sizes` comparten URL, así que al
            // montarse el fotograma 0 sale de caché sin parpadeo.
            if (!motionEnabled) return null;
            // Parada sin foto (ver WalkStop.image): no hay fotograma que
            // montar — el frame anterior ya se encarga de desvanecerse con
            // su propia distancia, dejando ver el --pgo-page liso detrás.
            if (!s.image) return null;
            const dist = Math.abs(pos - i);
            const opacity = active ? Math.max(0, 1 - dist) : i === 0 ? 1 : 0;
            // Ken Burns sutil: entra levemente ampliada y se asienta al llegar.
            const scale = active ? 1 + Math.min(1, dist) * 0.05 : 1;
            return (
              <Image
                key={i}
                src={s.image}
                alt=""
                fill
                // Eager: son el asset principal del recorrido y deben estar
                // decodificados antes del primer scrub.
                loading="eager"
                sizes="100vw"
                className="object-cover"
                onLoad={() => setLoaded((c) => c + 1)}
                style={{ opacity, transform: `scale(${scale})` }}
              />
            );
          })}
          <div className="absolute inset-0" style={{ background: scrimBg }} />
        </div>

        {/* ── UI: cada parada entra y sale sobre la escena ── */}
        <div className="pgo-walk-ui">
          {stops.map((s, i) => {
            const d = pos - i;
            // La opacidad debe llegar a 0 antes del punto medio entre paradas
            // (|d| = 0.5) — nunca después: con una caída que cruzara ese punto,
            // en el cruce las DOS paradas quedaban visibles a la vez y se
            // superponían (el título del hero fantasmeaba sobre las tarjetas).
            // Así, en |d| = 0.5 ambas valen 0 y nunca coexisten: queda un
            // instante de solo-foto y entra limpia la siguiente. El divisor
            // (ancho de la caída) sí se puede angostar — con 0.14 la opacidad
            // plena dura hasta |d| = 0.36 en vez de 0.32, así un scroll que no
            // llega a la mitad del camino todavía se ve nítido.
            const vis = Math.max(0, Math.min(1, (0.5 - Math.abs(d)) / 0.14));
            return (
              <div
                key={i}
                ref={(el) => { stopRefs.current[i] = el; }}
                // Apilado (mobile/sin JS) el ancla sí puede vivir en la parada.
                id={!pinned ? s.anchorId : undefined}
                className={`pgo-walk-stop${i === 0 ? " pgo-walk-stop-hero" : ""}`}
                style={
                  active
                    ? {
                        opacity: vis,
                        transform: `translateY(${d * -34}px)`,
                        pointerEvents: vis > 0.55 ? "auto" : "none",
                        visibility: vis <= 0.001 ? "hidden" : "visible",
                      }
                    : undefined
                }
              >
                {/* Fondo por-parada — SOLO en la parada 0 (Inicio). Es la escena
                    inicial en todos los modos: en apilado (mobile/reduced-
                    motion/sin JS) siempre, y en escritorio hasta que el
                    crossfade de arriba está listo (`active`), momento en que
                    se apaga y la foto la pone el fotograma 0, idéntico.
                    Las paradas 1+ NO llevan foto en apilado: son fotogramas
                    compuestos para 100vh de escritorio, y recortados por
                    `object-cover` a la altura variable de una tarjeta de
                    texto se ven como una porción arbitraria de la escena
                    (a veces sin ningún elemento reconocible) — y esa porción
                    cambia parada a parada según cuánto texto tenga cada una.
                    Sin fondo, se ve el `--pgo-page` + `.pgo-aurora-layer` de
                    la página (mismo tratamiento que login/registro/Nuestros
                    Planes: tarjeta glass sobre aurora, no sobre foto). Es el
                    LCP de la portada: carga eager y con prioridad alta (React
                    además la precarga en el <head> con el mismo srcset). */}
                {i === 0 && s.image && (
                  <div
                    className="pgo-walk-stop-bg"
                    aria-hidden="true"
                    style={active ? { display: "none" } : undefined}
                  >
                    <Image
                      src={s.image}
                      alt=""
                      fill
                      sizes="100vw"
                      loading="eager"
                      fetchPriority="high"
                      className="object-cover"
                    />
                    <div className="absolute inset-0" style={{ background: scrimBg }} />
                  </div>
                )}
                {/* ScrollReveal: no-op en modo fijado (el fade ya lo maneja `vis`
                    arriba, y el stop siempre está geométricamente en viewport así
                    que dispara casi al montar) — pero en modo apilado (mobile/
                    reduced-motion) es la ÚNICA transición entre categorías: sin
                    esto, cada parada aparecía de golpe al hacer scroll normal. */}
                <div className="relative mx-auto w-full max-w-6xl">
                  <ScrollReveal>{s.node}</ScrollReveal>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Hint de scroll (solo modo fijado) — affordance del hero: sin
            señal, el escenario fijado parece una página de una sola pantalla.
            Se desvanece apenas el usuario empieza a avanzar.

            Nota de diseño: acá vivió un rail de puntos de progreso, se quitó
            a propósito. El navbar ya lista las mismas 4 paradas, con el mismo
            estado activo (scroll-spy) y el mismo click de navegación — un
            segundo control idéntico es nav duplicado, no una ayuda. */}
        {pinned && (
          <div
            className="pgo-walk-hint"
            aria-hidden="true"
            style={{ opacity: Math.max(0, 1 - pos * 4) }}
          >
            <span>Desliza para recorrer</span>
            <ChevronDown className="h-4 w-4" />
          </div>
        )}
      </div>
    </section>
  );
}
