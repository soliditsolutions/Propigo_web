"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Enlaces de navegación pública, en el orden pedido. Salvo "Inicio", todos
 * anclan a una sección del home (ids "acerca-de" / "destacado" / "planes")
 * — ninguna es una página aparte. El acceso al marketplace NO va aquí: vive en
 * el home (invitación del hero "Ver propiedades disponibles" y el "Ver todas"
 * de la parada Destacado). */
export const NAV_LINKS = [
  { href: "/",             label: "Inicio" },
  { href: "/#acerca-de",   label: "Acerca de" },
  { href: "/#destacado",   label: "Destacado" },
  { href: "/#planes",      label: "Nuestros Planes" },
] as const;

const HOME_HREF = "/";

/**
 * Sección del Home actualmente a la vista (scroll-spy). El navbar y el
 * escenario walkthrough no tienen relación padre-hijo — viven en puntos
 * distintos del árbol — así que en vez de prop-drilling o Context comparten
 * este mini-store externo: ScrollWalkthrough escribe qué ancla está visible
 * mientras el usuario scrollea (calculado a partir de su progreso en modo
 * fijado, o con un IntersectionObserver en modo apilado), el navbar solo
 * lee. `null` representa "Inicio" (la primera parada no tiene anchorId).
 */
type Listener = () => void;
let activeSection: string | null = null;
const listeners = new Set<Listener>();

export function setActiveSection(id: string | null) {
  if (id === activeSection) return;
  activeSection = id;
  listeners.forEach((l) => l());
}

function subscribeActiveSection(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getActiveSectionSnapshot() {
  return activeSection;
}

// En el servidor no hay scroll: "Inicio" es la única sección posible.
function getActiveSectionServerSnapshot() {
  return null;
}

function useActiveSection() {
  return useSyncExternalStore(subscribeActiveSection, getActiveSectionSnapshot, getActiveSectionServerSnapshot);
}

/** Hace scroll suave a la sección y dispara el destello de llegada — se
 * reusa tanto desde el click en el navbar como desde HomeHashHandler
 * (llegada desde otra página con el hash ya en la URL). Si existe un
 * `${id}-card` (el bloque visual dentro de la parada) el destello se aplica
 * ahí; si no, no pasa nada más que el scroll. */
export function scrollToSection(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  const card = document.getElementById(`${id}-card`);
  if (card) {
    card.classList.remove("pgo-anchor-flash");
    // Forzar reflow para poder re-disparar la animación si se hace click dos veces seguidas.
    void card.offsetWidth;
    card.classList.add("pgo-anchor-flash");
  }
}

/**
 * Wrapper de <Link> consciente de la ruta actual: si ya estamos en "/" y el
 * destino es un ancla del home (p. ej. "/#destacado") o "Inicio" de vuelta a
 * "/", Next.js no garantiza ningún scroll porque el pathname no cambia (solo
 * el hash) — así que interceptamos ambos casos y los hacemos manualmente en
 * vez de depender del comportamiento de same-pathname navigation de Next
 * (que en dev, con el router cache, no siempre limpia el hash de forma
 * confiable). Para cualquier otro enlace, comportamiento normal de <Link>.
 */
export function PublicNavLink({
  href,
  className,
  onClick,
  "aria-label": ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeSection = useActiveSection();

  // Los enlaces "/#<ancla>" están activos cuando esa ancla es la sección a
  // la vista (scroll-spy, ver activeSection arriba) — no por el pathname,
  // que no cambia al scrollear. "Inicio" está activo cuando estamos en "/"
  // y ninguna ancla está a la vista todavía (activeSection === null, la
  // parada 0 no tiene anchorId). Cualquier otro enlace de página real usa
  // el comportamiento clásico por pathname.
  const hashIndex = href.indexOf("#");
  const isHomeAnchor = hashIndex !== -1 && href.slice(0, hashIndex) === "/";
  const sectionId = isHomeAnchor ? href.slice(hashIndex + 1) : null;
  const isActive = isHomeAnchor
    ? pathname === "/" && activeSection === sectionId
    : href === "/"
      ? pathname === "/" && activeSection === null
      : pathname.startsWith(href);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/") {
      if (sectionId !== null) {
        e.preventDefault();
        history.pushState(null, "", `#${sectionId}`);
        scrollToSection(sectionId);
      } else if (href === HOME_HREF) {
        e.preventDefault();
        history.replaceState(null, "", HOME_HREF);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    onClick?.();
  }

  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      aria-current={isActive ? "page" : undefined}
      onClick={handleClick}
      // Todos estos enlaces apuntan al Home ("/" o "/#ancla") y el scroll ya
      // se maneja a mano arriba (scrollToSection o scrollTo(0,0)) — sin esto,
      // el scroll-to-top automático de next/link en cada navegación (incluso
      // same-page por hash) competía con nuestra animación y la revertía a
      // mitad de camino: un click real en "Acerca de"/"Destacado" arrancaba
      // el scroll suave hacia la sección pero terminaba de vuelta arriba.
      scroll={false}
    >
      {children}
    </Link>
  );
}

/**
 * Píldora de navegación central — glassmorphism (blur + saturación + borde de
 * cristal + brillo interior). Se oculta en mobile vía CSS (el menú
 * desplegable de PublicNavMenu repite estos mismos enlaces para pantallas
 * chicas, reusando PublicNavLink para el mismo comportamiento de scroll).
 */
export function PublicNavLinks() {
  return (
    <nav className="pf-navbar-links hidden lg:flex" aria-label="Navegación principal">
      <div className="pf-navpill">
        {NAV_LINKS.map((l) => (
          <PublicNavLink key={l.href} href={l.href} className="pf-navpill-link">
            {l.label}
          </PublicNavLink>
        ))}
      </div>
    </nav>
  );
}
