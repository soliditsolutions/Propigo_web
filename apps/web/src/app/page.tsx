import Link from "next/link";
import { Building2, Wallet, Globe, ShieldCheck, Users, Star, ArrowRight, KeyRound, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";
import { EmblaCarousel } from "@/components/public/EmblaCarousel";
import { CorredorCard, type CorredorDestacado } from "@/components/public/CorredorCard";
import { PropiedadDestacadaCard, type PropiedadDestacada } from "@/components/public/PropiedadDestacadaCard";
import { HomeHashHandler } from "@/components/public/HomeHashHandler";
import { ScrollWalkthrough } from "@/components/public/ScrollWalkthrough";
import { PlanesStop } from "@/components/public/PlanesStop";
import walkDoor from "@/images/backgrounds/scroll-walkthrough_door.png";
import walkRoom from "@/images/backgrounds/scroll-walkthrough_keys_and_costumers.png";
import walkContract from "@/images/backgrounds/scroll-walkthrough_signed_contract.png";
import walkKeys from "@/images/backgrounds/scroll-walkthrough_get_keys.png";

/** Top 10 corredores por rating agregado (ValoracionCorredor, esVisible=true). */
async function getTopCorredores(): Promise<CorredorDestacado[]> {
  const agregados = await prisma.valoracionCorredor.groupBy({
    by: ["tenantId"],
    where: { esVisible: true },
    _avg: { estrellas: true },
    _count: { estrellas: true },
    orderBy: { _avg: { estrellas: "desc" } },
    take: 10,
  });
  if (agregados.length === 0) return [];

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: agregados.map((a) => a.tenantId) } },
    select: { id: true, nombre: true },
  });
  const nombrePorId = new Map(tenants.map((t) => [t.id, t.nombre]));

  return agregados.map((a) => ({
    tenantId: a.tenantId,
    nombre:   nombrePorId.get(a.tenantId) ?? "Corredor",
    promedio: a._avg.estrellas ?? 0,
    total:    a._count.estrellas,
  }));
}

/**
 * Últimas 10 publicaciones disponibles, ordenadas por fecha de publicación.
 *
 * Antes se ordenaban por el rating del CORREDOR y la sección se titulaba
 * "Propiedades destacadas": eso le prometía al visitante una autoridad que
 * los datos no respaldan — no existe rating por propiedad en el modelo (solo
 * ValoracionCorredor), así que unas pocas reseñas de un corredor definían el
 * orden de todo el carrusel y las estrellas de la tarjeta se leían como si
 * calificaran la propiedad. Recencia es un criterio honesto, no tiene
 * arranque en frío y es lo que el título declara ahora. El rating del
 * corredor se sigue mostrando, pero etiquetado como tal (ver RatingStars).
 */
async function getTopPropiedades(): Promise<PropiedadDestacada[]> {
  const publicaciones = await prisma.publicacion.findMany({
    where: {
      estado: "publicada",
      propiedad: { estado: "disponible" },
    },
    include: {
      propiedad: {
        select: {
          tipo: true, comuna: true, region: true,
          imagenes: { orderBy: { orden: "asc" }, take: 1, select: { url: true } },
        },
      },
      tenant: { select: { id: true, nombre: true } },
    },
    orderBy: { publicadaEn: "desc" },
    take: 40,
  });
  if (publicaciones.length === 0) return [];

  const tenantIds = [...new Set(publicaciones.map((p) => p.tenantId))];
  const agregados = await prisma.valoracionCorredor.groupBy({
    by: ["tenantId"],
    where: { esVisible: true, tenantId: { in: tenantIds } },
    _avg: { estrellas: true },
    _count: { estrellas: true },
  });
  const ratingPorTenant = new Map(
    agregados.map((a) => [a.tenantId, { promedio: a._avg.estrellas ?? 0, total: a._count.estrellas }]),
  );

  const conOrden = publicaciones.map((p) => {
    const rating = ratingPorTenant.get(p.tenantId) ?? null;
    return {
      sortFecha:  p.publicadaEn?.getTime() ?? 0,
      item: {
        publicacionId:      p.id,
        titulo:             p.titulo,
        tipo:               p.propiedad.tipo,
        comuna:             p.propiedad.comuna,
        region:             p.propiedad.region,
        imagenUrl:          p.propiedad.imagenes[0]?.url ?? null,
        precioReferencia:   p.precioReferencia ? p.precioReferencia.toNumber() : null,
        denominacionPrecio: p.denominacionPrecio,
        corredorNombre:     p.tenant.nombre,
        corredorPromedio:   rating?.promedio ?? null,
        corredorTotal:      rating?.total ?? 0,
      } satisfies PropiedadDestacada,
    };
  });

  conOrden.sort((a, b) => b.sortFecha - a.sortFecha);
  return conOrden.slice(0, 10).map((c) => c.item);
}

export default async function Home() {
  const [topCorredores, topPropiedades] = await Promise.all([
    getTopCorredores(),
    getTopPropiedades(),
  ]);

  // Tarjetas de "por qué elegirnos" — ahora glassmorphism (sin foto propia)
  // para que la escena del walkthrough siga viéndose por detrás.
  const features = [
    {
      id: "gestion",
      icon: Building2,
      title: "Contratos y reajustes automáticos",
      text: "Genera el contrato en UF o CLP y aplica el reajuste del IPC en cada aniversario, con la comisión ya calculada. El aniversario lo lleva el sistema, no tú.",
    },
    {
      id: "pagos",
      icon: Wallet,
      title: "Cobros que se concilian solos",
      text: "El sistema detecta cada pago y lo concilia al instante, con un comprobante inmutable y una contabilidad auditable. Te avisa apenas un arriendo se atrasa, no cuando ya perdiste el mes.",
    },
    {
      id: "marketplace",
      icon: Globe,
      title: "Tu vitrina pública, sin comisiones",
      text: "Publica tus propiedades en el marketplace y recibe consultas directas de arrendatarios. Tu catálogo y tu marca, sin pagarle comisión por lead a un portal externo.",
    },
  ];

  /* ── Parada 0 — Puerta: presentación + acciones principales ─────────── */
  const stopHero = (
    <div className="hw-hero-stagger hw-walk-panel mx-auto max-w-2xl p-5 text-center sm:p-7">
      <span className="hw-glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-[var(--pf-text-body)]">
        <ShieldCheck className="h-3.5 w-3.5 text-[var(--hw-success)]" />
        PropTech para corredores de propiedades · Chile
      </span>
      <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight text-[var(--pf-navy)] sm:text-5xl">
        La gestión de arriendos,{" "}
        <span className="pf-headline-accent">automática y sin errores</span>.
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-pretty text-base leading-relaxed text-[var(--pf-text-body)] sm:text-lg">
        Detecta los pagos, aplica el reajuste del IPC en el aniversario de
        cada contrato y deja el respaldo listo para rendirle al propietario.
        Sin planillas.
      </p>
      {/* CTA primario — el negocio es el corredor. hw-sheen: barrido de luz al
          hover, reservado para el CTA principal de la página. */}
      <div className="mt-5 flex justify-center">
        <Link href="/registro">
          {/* --pf-purple-btn, no --pf-purple: texto blanco sobre --pf-purple da
              solo 3.62:1 en tema oscuro (falla AA, 4.5:1) — --pf-purple-btn ya
              existe en el token system justo para esto (4.93:1 oscuro; en claro
              son el mismo valor, sin cambio). */}
          <Button size="lg" className="hw-sheen bg-[var(--pf-purple-btn)] hover:opacity-90">
            Empezar como corredor
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>
      {/* Híbrido: además del pitch al corredor, invitamos al público que busca
          arriendo (explorar el catálogo) o que ya arrienda (consultar su pago).
          Separado por una línea + eyebrow cálido para que no compita con el CTA
          principal pero tenga su propia visibilidad. */}
      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--pf-border)" }}>
        <span className="pf-invite-eyebrow inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
          <HomeIcon className="h-3.5 w-3.5" aria-hidden="true" />
          ¿Buscas arriendo?
        </span>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Link href="/marketplace">
            <Button size="lg" variant="outline" className="hw-cta-secondary">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Ver propiedades disponibles
            </Button>
          </Link>
          <Link href="/portal">
            <Button size="lg" variant="outline" className="hw-cta-secondary">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Consulta tu arriendo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );

  /* ── Parada 1 — Sala: acerca de (beneficios) ─────────────────────────── */
  const stopFeatures = (
    <div id="acerca-de-card">
      {/* Panel de legibilidad: en desktop (≥lg) el encabezado va directo
          sobre la foto del crossfade. Por debajo de `lg` no hay foto detrás
          (ver ScrollWalkthrough.tsx) — el glass panel igual queda bien
          apoyado sobre el fondo aurora de la página, mismo tratamiento que
          login/registro. */}
      <div className="mb-8 flex justify-center">
        <div className="hw-walk-panel px-6 py-4 text-center sm:px-8">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--pf-purple)]">
            Acerca de
          </span>
          <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight text-[var(--pf-navy)] sm:text-3xl">
            Lo que hace{" "}
            <span className="pf-headline-accent">por ti</span>
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-pretty text-sm leading-relaxed text-[var(--pf-text-body)]">
            El arriendo se administra completo desde acá: el contrato, la
            cobranza mensual y la publicación. Cada movimiento queda registrado
            y el propietario puede verlo por su cuenta.
          </p>
        </div>
      </div>

      {/* Desktop (≥lg, 3 tarjetas caben cómodas lado a lado): grilla fija,
          sin cambios respecto al diseño anterior. */}
      <div className="hidden gap-5 lg:grid lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.id} className="hw-auth-card flex h-full flex-col p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pf-purple-tint)] text-[var(--pf-purple)]">
              <f.icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-balance font-semibold text-[var(--pf-navy)]">{f.title}</h3>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--pf-text-body)]">{f.text}</p>
          </div>
        ))}
      </div>

      {/* Mobile/tablet (<lg): mismo componente EmblaCarousel que ya usa
          "Destacado" para propiedades/corredores — no un patrón nuevo. Sin
          parallax (no hay imagen de fondo en la tarjeta) ni autoplay: son 3
          tarjetas con texto para leer con calma, no una vitrina para hojear
          pasivamente. Ancho fijo por tarjeta (no 100%) para que se note que
          hay una siguiente y anime a deslizar en vez de leerse como una
          lista de una sola columna. */}
      <div className="lg:hidden">
        <EmblaCarousel ariaLabel="Qué hace Housing por un corredor" autoplay={false}>
          {features.map((f) => (
            <div key={f.id} className="hw-auth-card flex h-full w-[82vw] max-w-xs shrink-0 flex-col p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pf-purple-tint)] text-[var(--pf-purple)]">
                <f.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-balance font-semibold text-[var(--pf-navy)]">{f.title}</h3>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--pf-text-body)]">{f.text}</p>
            </div>
          ))}
        </EmblaCarousel>
      </div>
    </div>
  );

  /* ── Parada 2 — Contrato firmado: destacado (propiedades + corredores) ── */
  const stopPropiedades = (
    <div id="destacado-card" className="hw-auth-card p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2">
        <Star className="h-5 w-5" style={{ color: "var(--pf-purple)" }} aria-hidden="true" />
        <h2 className="pf-headline-accent text-xl font-bold tracking-tight sm:text-2xl">Destacado</h2>
        <span className="hidden text-sm sm:inline" style={{ color: "var(--pf-text-muted)" }}>
          Las publicaciones más recientes
        </span>
        {/* Acceso al marketplace movido al encabezado (antes ocupaba una fila
            entera al fondo, poco visible y comiendo el alto justo de la parada). */}
        <Link
          href="/marketplace"
          className="group/vt ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-[var(--pf-purple)] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[var(--pf-purple)]"
        >
          Ver todas
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/vt:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>

      <h3 className="mb-2 text-base font-semibold text-[var(--pf-navy)]">Publicaciones recientes</h3>
      {topPropiedades.length > 0 ? (
        <EmblaCarousel ariaLabel="Publicaciones recientes disponibles" parallax autoplayDelay={4200}>
          {topPropiedades.map((p) => (
            <PropiedadDestacadaCard key={p.publicacionId} propiedad={p} />
          ))}
        </EmblaCarousel>
      ) : (
        <p className="text-sm text-[var(--pf-text-body)]">
          Aún no hay propiedades publicadas. Explora el marketplace para ver
          las novedades apenas se publiquen.
        </p>
      )}

      {topCorredores.length > 0 && (
        <div className="mt-3.5">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: "var(--pf-purple)" }} aria-hidden="true" />
            <h3 className="text-base font-semibold text-[var(--pf-navy)]">Corredores mejor valorados</h3>
          </div>
          <EmblaCarousel ariaLabel="Corredores mejor valorados" autoplayDelay={5000}>
            {topCorredores.map((c) => (
              <CorredorCard key={c.tenantId} corredor={c} />
            ))}
          </EmblaCarousel>
        </div>
      )}
    </div>
  );

  return (
    // overflow-x-clip (no overflow-hidden): `hidden` crea un scrollport y
    // rompería el `position: sticky` del escenario walkthrough; `clip` recorta
    // el desborde horizontal sin crear contenedor de scroll.
    <div className="relative min-h-screen overflow-x-clip" style={{ background: "var(--hw-page)" }}>
      <HomeHashHandler />

      {/* Fondo aurora boreal — visible en las secciones fuera del escenario. */}
      <div className="hw-aurora-layer" style={{ position: "fixed" }} aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <PublicNavbar />

        <main className="flex-1">
          {/* Escenario: la cámara camina de la puerta a la entrega de llaves
              y la UI de cada parada entra sobre la escena — incluida
              "Nuestros Planes": en vez de resumirla (se sentía pobre) o
              sacarla del escenario (perdía la foto y las transiciones), su
              contenido es una tabla comparativa densa que sí cabe en un
              frame fijado (ver PlanesStop). */}
          <ScrollWalkthrough
            stops={[
              { image: walkDoor,     node: stopHero },
              { image: walkRoom,     node: stopFeatures,    anchorId: "acerca-de" },
              { image: walkContract, node: stopPropiedades, anchorId: "destacado" },
              { image: walkKeys,     node: <PlanesStop />,  anchorId: "planes" },
            ]}
          />
        </main>

        <PublicFooter />
      </div>
    </div>
  );
}
