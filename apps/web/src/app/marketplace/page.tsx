/**
 * Marketplace público — listado de propiedades publicadas.
 * Sin autenticación. Tema PayFlow: gradiente hero, cards con lift, CTA dark.
 */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { terminoBusqueda, numeroFiltro, enteroFiltro, idFiltro, opcionFiltro } from "@/lib/busqueda";
import { TipoPropiedad } from "@/generated/prisma/enums";

/** Lista cerrada contra la que se valida `?tipo=`. */
const TIPOS_PROPIEDAD = Object.values(TipoPropiedad);
import {
  BedDouble, Bath, Car, MapPin,
  Search, ArrowRight, CheckCircle2, PawPrint, Calendar,
} from "lucide-react";
import { FilterPanel } from "./filter-panel";
import { TerminosAviso } from "@/components/public/TerminosAviso";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BorderGlow } from "@/components/ui/border-glow";
import { clpOrUf, plural } from "@/lib/format";
import { tipoMeta } from "@/lib/propiedad-meta";
import Image from "next/image";
import marketplaceHero from "@/images/backgrounds/001_Marketplace.png";

type SP = {
  q?: string; tipo?: string; corredor?: string;
  region?: string; comuna?: string;
  piezasMin?: string; piezasMax?: string; banosMin?: string;
  estacionamiento?: string; m2TotMin?: string; m2TotMax?: string;
  m2ConMin?: string; m2ConMax?: string;
  pagaGC?: string; mascotas?: string;
  precioMin?: string; precioMax?: string;
  publicadaDias?: string;
};

/**
 * Filtros de la URL, ya validados.
 *
 * SEC: esta página es pública y sin sesión, así que cada parámetro es texto que
 * escribe cualquiera. Antes pasaban directo a Prisma: `?precioMin=abc` llegaba
 * como NaN, `?corredor=x` como uuid inválido y `?tipo=x` como un enum que no
 * existe — los tres tumbaban la página con un 500. Un filtro que no se entiende
 * ahora simplemente no se aplica.
 */
function filtros(sp: SP) {
  return {
    q:        terminoBusqueda(sp.q),
    tipo:     opcionFiltro<TipoPropiedad>(sp.tipo, TIPOS_PROPIEDAD),
    corredor: idFiltro(sp.corredor),
    dias:     enteroFiltro(sp.publicadaDias, { min: 1, max: 3650 }),
    precioMin: numeroFiltro(sp.precioMin, { max: 1e12 }),
    precioMax: numeroFiltro(sp.precioMax, { max: 1e12 }),
    piezasMin: enteroFiltro(sp.piezasMin, { max: 100 }),
    piezasMax: enteroFiltro(sp.piezasMax, { max: 100 }),
    banosMin:  enteroFiltro(sp.banosMin,  { max: 100 }),
    m2TotMin:  numeroFiltro(sp.m2TotMin,  { max: 1e7 }),
    m2TotMax:  numeroFiltro(sp.m2TotMax,  { max: 1e7 }),
    m2ConMin:  numeroFiltro(sp.m2ConMin,  { max: 1e7 }),
    m2ConMax:  numeroFiltro(sp.m2ConMax,  { max: 1e7 }),
  };
}

async function getPublicaciones(sp: SP) {
  // SEC: el término pasa por terminoBusqueda y no crudo. Prisma entrega el
  // texto de `contains` al LIKE sin escapar, así que `?q=%` traía el catálogo
  // completo desde una ruta pública y sin sesión.
  const f = filtros(sp);
  const q = f.q;
  const fechaMin = f.dias !== null
    ? new Date(Date.now() - f.dias * 86_400_000)
    : undefined;

  return prisma.publicacion.findMany({
    where: {
      estado: "publicada",
      ...(f.corredor ? { tenantId: f.corredor } : {}),
      ...(fechaMin ? { publicadaEn: { gte: fechaMin } } : {}),
      ...(f.precioMin !== null || f.precioMax !== null
        ? {
            denominacionPrecio: "CLP",
            precioReferencia: {
              ...(f.precioMin !== null ? { gte: f.precioMin } : {}),
              ...(f.precioMax !== null ? { lte: f.precioMax } : {}),
            },
          }
        : {}),
      propiedad: {
        estado: "disponible",
        ...(f.tipo ? { tipo: f.tipo } : {}),
        ...(q ? {
          OR: [
            // SEC: solo se busca por dirección exacta si el corredor autorizó
            // mostrarla — de lo contrario, el buscador serviría como oráculo
            // para confirmar la dirección real por fuerza bruta.
            { direccion: { contains: q, mode: "insensitive" }, mostrarUbicacionExacta: true },
            { comuna:    { contains: q, mode: "insensitive" } },
            { region:    { contains: q, mode: "insensitive" } },
          ],
        } : {}),
        // SEC/FIX: antes filtraba también por `ciudad`, un campo que no existe en
        // Propiedad (solo tiene comuna/region) — hubiera lanzado un error de
        // Prisma en cuanto alguien usara ese filtro. Ahora que región/comuna
        // vienen de un <select> con la lista cerrada, se compara por igualdad
        // exacta en vez de substring.
        ...(sp.region  ? { region: { equals: sp.region } } : {}),
        ...(sp.comuna  ? { comuna: { equals: sp.comuna } } : {}),
        ...(f.piezasMin !== null || f.piezasMax !== null
          ? { piezas: { ...(f.piezasMin !== null ? { gte: f.piezasMin } : {}), ...(f.piezasMax !== null ? { lte: f.piezasMax } : {}) } }
          : {}),
        ...(f.banosMin !== null ? { banos: { gte: f.banosMin } } : {}),
        ...(sp.estacionamiento === "1" ? { estacionamientos: { gte: 1 } } : {}),
        ...(f.m2TotMin !== null || f.m2TotMax !== null
          ? { m2Totales: { ...(f.m2TotMin !== null ? { gte: f.m2TotMin } : {}), ...(f.m2TotMax !== null ? { lte: f.m2TotMax } : {}) } }
          : {}),
        ...(f.m2ConMin !== null || f.m2ConMax !== null
          ? { m2Construidos: { ...(f.m2ConMin !== null ? { gte: f.m2ConMin } : {}), ...(f.m2ConMax !== null ? { lte: f.m2ConMax } : {}) } }
          : {}),
        ...(sp.pagaGC    === "1" ? { pagaGastosComunes: false } : {}),
        ...(sp.mascotas  === "1" ? { aceptaMascotas: true } : {}),
      },
    },
    include: {
      propiedad: {
        select: {
          id: true, tipo: true, direccion: true, comuna: true, region: true,
          piezas: true, banos: true, estacionamientos: true, m2Totales: true,
          aceptaMascotas: true, pagaGastosComunes: true, mostrarUbicacionExacta: true,
          imagenes: { orderBy: { orden: "asc" }, take: 1, select: { url: true } },
        },
      },
      tenant: { select: { nombre: true } },
    },
    orderBy: { publicadaEn: "desc" },
    take: 48,
  });
}

const PREDEFINED_FILTERS = [
  {
    id: "mascotas",
    label: "Acepta mascotas",
    icon: PawPrint,
    params: { mascotas: "1" },
  },
  {
    id: "estacionamiento",
    label: "Con estacionamiento",
    icon: Car,
    params: { estacionamiento: "1" },
  },
  {
    id: "sin_gc",
    label: "Sin gastos comunes",
    icon: CheckCircle2,
    params: { pagaGC: "1" },
  },
  {
    id: "recientes",
    label: "Últimos 7 días",
    icon: Calendar,
    params: { publicadaDias: "7" },
  },
];

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp   = await searchParams;
  const q    = sp.q?.trim() ?? "";
  const tipo = sp.tipo ?? "todas";

  const [publicaciones, corredorFiltro] = await Promise.all([
    getPublicaciones(sp),
    // Mismo motivo que en filtros(): sin validar, un `?corredor=x` cualquiera
    // llegaba a una columna uuid y tumbaba la página.
    idFiltro(sp.corredor)
      ? prisma.tenant.findUnique({ where: { id: idFiltro(sp.corredor)! }, select: { nombre: true } })
      : Promise.resolve(null),
  ]);

  const tipos = [
    { key: "todas",        label: "Todas" },
    { key: "departamento", label: "Departamentos" },
    { key: "casa",         label: "Casas" },
    { key: "cabana",       label: "Cabañas" },
  ];

  const trustBadges = [
    "Corredores certificados",
    "Sin costo de búsqueda",
    "Ley 21.719 · Chile",
  ];

  // Para pasar al FilterPanel (client) como prop serializable
  const spRecord: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined) spRecord[k] = v;
  }

  const hayFiltrosActivos = Object.keys(sp).some(
    (k) => !["q", "tipo"].includes(k) && sp[k as keyof SP],
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--pf-surface)", overflowX: "hidden" }}>

      {/* Aviso de T&C + anti-fraude — se muestra solo en el primer acceso */}
      <TerminosAviso />

      {/* ── Navbar público ────────────────────────────────────────────── */}
      <PublicNavbar />

      {/* ── Hero section ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ paddingTop: "96px", paddingBottom: "72px" }}>
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "linear-gradient(160deg, var(--pf-hero-1) 0%, var(--pf-hero-2) 45%, var(--pf-surface) 100%)" }}
        />
        {/* Foto sutil — puerta+llaves compuesta a propósito para dejar el
            centro (donde cae el buscador) limpio. Pintada sobre el gradiente
            opaco de arriba (con su propia opacidad baja) y por debajo del
            aurora. */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.28 }} aria-hidden="true">
          <Image
            src={marketplaceHero}
            alt=""
            fill
            className="object-cover"
            style={{ objectPosition: "35% 30%" }}
          />
        </div>
        {/* Parche puntual — cubre el watermark del generador (esquina
            inferior derecha de la foto), que la ventana de recorte de este
            contenedor no alcanza a excluir por sí sola. */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "radial-gradient(circle at 88% 84%, var(--pf-surface) 0%, transparent 20%)" }}
        />
        {/* Desvanece la foto antes del borde inferior del hero — sin esto la
            imagen se ve nítida hasta el último píxel y corta en seco contra
            la barra de filtros de abajo (efecto "recuadro"). */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "linear-gradient(to bottom, transparent 0%, transparent 70%, var(--pf-surface) 100%)" }}
        />
        {/* Acento aurora — mismo lenguaje visual del home, atenuado para no competir con el buscador */}
        <div className="hw-aurora-layer" style={{ opacity: 0.5 }} aria-hidden="true" />
        <div
          className="absolute top-0 right-0 pointer-events-none"
          aria-hidden="true"
          style={{
            width: "600px", height: "500px", opacity: 0.28,
            background: "radial-gradient(circle at 80% 20%, rgba(99,91,255,0.22) 0%, transparent 60%)",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span
            className="mb-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
          >
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Corredores verificados · Housing SOLIDIT
          </span>

          <h1
            className="hw-enter mt-2 text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ color: "var(--pf-navy)", letterSpacing: "-0.02em" }}
          >
            Propiedades <span className="pf-headline-accent">disponibles</span>
          </h1>
          <p className="mt-4 text-lg" style={{ color: "var(--pf-text-body)", animationDelay: "60ms" }}>
            Arriendos en Chile gestionados por corredores certificados Housing
          </p>

          {/* Buscador + botón filtros */}
          <form method="GET" action="/marketplace" className="mt-8 flex flex-col gap-2 sm:flex-row">
            {/* Preservar otros params al buscar por texto */}
            {tipo && tipo !== "todas" && <input type="hidden" name="tipo" value={tipo} />}
            {Object.entries(sp).filter(([k]) => !["q", "tipo"].includes(k)).map(([k, v]) =>
              v ? <input key={k} type="hidden" name={k} value={v} /> : null
            )}
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                aria-hidden
                style={{ color: "var(--pf-text-light)" }}
              />
              <input
                name="q"
                type="text"
                defaultValue={q}
                placeholder="Dirección, comuna o región…"
                className="pf-input w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="pf-btn-primary flex-1 sm:flex-none"
                style={{ padding: "0 20px", height: "48px", borderRadius: "12px", fontSize: "14px" }}
              >
                <Search className="h-4 w-4" aria-hidden />
                Buscar
              </button>
              {/* Drawer de filtros (client component) */}
              <FilterPanel searchParams={spRecord} />
            </div>
          </form>

          {/* Trust badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-5">
            {trustBadges.map((badge) => (
              <span key={badge} className="pf-trust">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pf-success-check)" }} aria-hidden />
                {badge}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Filtros rápidos ────────────────────────────────────────────── */}
      <div className="border-b" style={{ background: "var(--pf-surface)", borderColor: "var(--pf-border)" }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6">

          {/* Chips de tipo */}
          <div className="flex gap-1 overflow-x-auto">
            {tipos.map((t) => {
              const active = tipo === t.key;
              const params = new URLSearchParams(spRecord);
              params.delete("tipo");
              if (t.key !== "todas") params.set("tipo", t.key);
              return (
                <Link
                  key={t.key}
                  href={`/marketplace${params.toString() ? `?${params}` : ""}`}
                  className="shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all"
                  style={{
                    background:  active ? "var(--pf-purple-btn)" : "transparent",
                    color:       active ? "#fff" : "var(--pf-text-muted)",
                    border:      active ? "1px solid var(--pf-purple-btn)" : "1px solid transparent",
                  }}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {/* Chips predefinidos */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {PREDEFINED_FILTERS.map((pf) => {
              const params = new URLSearchParams(spRecord);
              // Toggle: si ya está activo, quitar; si no, agregar
              const isActive = Object.entries(pf.params).every(([k, v]) => params.get(k) === v);
              if (isActive) {
                Object.keys(pf.params).forEach((k) => params.delete(k));
              } else {
                Object.entries(pf.params).forEach(([k, v]) => params.set(k, v));
              }
              const PfIcon = pf.icon;
              return (
                <Link
                  key={pf.id}
                  href={`/marketplace${params.toString() ? `?${params}` : ""}`}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? "var(--pf-purple-tint)" : "var(--pf-surface)",
                    color:      isActive ? "var(--pf-purple)" : "var(--pf-text-muted)",
                    border:     `1.5px solid ${isActive ? "var(--pf-purple)" : "var(--pf-border)"}`,
                  }}
                >
                  <PfIcon className="h-3 w-3" aria-hidden />
                  {pf.label}
                </Link>
              );
            })}

            {/* Limpiar todos los filtros avanzados */}
            {hayFiltrosActivos && (() => {
              const limpiarP = new URLSearchParams();
              if (q) limpiarP.set("q", q);
              if (tipo !== "todas") limpiarP.set("tipo", tipo);
              const limpiarHref = `/marketplace${limpiarP.toString() ? `?${limpiarP}` : ""}`;
              return (
              <Link
                href={limpiarHref}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all"
                style={{
                  background: "var(--pf-surface)",
                  color: "var(--pf-text-muted)",
                  border: "1.5px solid var(--pf-border)",
                }}
              >
                ✕ Limpiar filtros
              </Link>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Resultados ────────────────────────────────────────────────── */}
      <main
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6"
        style={{ background: "var(--pf-surface)" }}
      >
        {corredorFiltro && (
          <div
            className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{ background: "var(--pf-purple-tint)", border: "1px solid color-mix(in srgb, var(--pf-purple) 25%, transparent)" }}
          >
            <p className="text-sm" style={{ color: "var(--pf-navy)" }}>
              Mostrando propiedades de <strong>{corredorFiltro.nombre}</strong>
            </p>
            <Link href="/marketplace" className="text-xs font-semibold" style={{ color: "var(--pf-purple)" }}>
              Ver todos los corredores ✕
            </Link>
          </div>
        )}
        {publicaciones.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{ background: "var(--pf-purple-tint)" }}
            >
              <Search className="h-7 w-7" style={{ color: "var(--pf-purple)" }} aria-hidden />
            </div>
            <p className="text-lg font-semibold" style={{ color: "var(--pf-navy)" }}>
              {q || tipo !== "todas" || hayFiltrosActivos
                ? "No se encontraron propiedades con estos filtros."
                : "No hay propiedades disponibles en este momento."}
            </p>
            <p className="text-sm" style={{ color: "var(--pf-text-muted)" }}>
              Los corredores publican propiedades nuevas todas las semanas. Vuelve a mirar en unos días.
            </p>
            {(q || tipo !== "todas" || hayFiltrosActivos) && (
              <Link href="/marketplace" className="pf-btn-secondary" style={{ padding: "10px 20px", fontSize: "13px" }}>
                Ver todas las propiedades
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm" style={{ color: "var(--pf-text-muted)" }}>
              {publicaciones.length} {plural(publicaciones.length, "propiedad", "propiedades")} {plural(publicaciones.length, "disponible", "disponibles")}
              {q && <> para <strong style={{ color: "var(--pf-navy)" }}>&ldquo;{q}&rdquo;</strong></>}
            </p>

            <div className="hw-stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {publicaciones.map((pub) => {
                const prop = pub.propiedad;
                const meta = tipoMeta(prop.tipo);
                const Icon = meta.icon;
                const img  = prop.imagenes[0]?.url;

                return (
                  <BorderGlow key={pub.id} radius={16}>
                  <Link
                    href={`/marketplace/${pub.id}`}
                    className="pf-card group flex w-full flex-col overflow-hidden"
                    style={{ borderRadius: "16px", textDecoration: "none" }}
                  >
                    {/* Imagen o placeholder */}
                    <div className="relative h-44 w-full overflow-hidden" style={{ background: "var(--pf-hero-1)" }}>
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={pub.titulo}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Icon className="h-14 w-14" style={{ color: "var(--pf-border-input)" }} aria-hidden />
                        </div>
                      )}
                      {/* Badge tipo */}
                      <span
                        className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
                      >
                        {meta.label}
                      </span>
                      {/* Badge mascotas */}
                      {prop.aceptaMascotas && (
                        <span
                          className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: "color-mix(in srgb, var(--pf-surface) 90%, transparent)", color: "var(--pf-text-muted)" }}
                          title="Acepta mascotas"
                        >
                          <PawPrint className="h-3 w-3" aria-hidden />
                        </span>
                      )}
                    </div>

                    {/* Contenido */}
                    <div className="flex flex-1 flex-col p-4">
                      <h2 className="line-clamp-2 text-sm font-bold" style={{ color: "var(--pf-navy)" }}>
                        {pub.titulo}
                      </h2>
                      <p className="mt-1 flex items-center gap-1 text-xs" style={{ color: "var(--pf-text-muted)" }}>
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        {prop.mostrarUbicacionExacta
                          ? `${prop.direccion}${prop.comuna ? `, ${prop.comuna}` : ""}`
                          : prop.comuna || prop.region || "Ubicación no especificada"}
                      </p>

                      {/* Amenities */}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: "var(--pf-text-muted)" }}>
                        {prop.piezas    != null && (
                          <span className="flex items-center gap-1">
                            <BedDouble className="h-3.5 w-3.5" style={{ color: "var(--pf-text-light)" }} aria-hidden />
                            {prop.piezas} {plural(prop.piezas, "pieza")}
                          </span>
                        )}
                        {prop.banos != null && (
                          <span className="flex items-center gap-1">
                            <Bath className="h-3.5 w-3.5" style={{ color: "var(--pf-text-light)" }} aria-hidden />
                            {prop.banos} {plural(prop.banos, "baño")}
                          </span>
                        )}
                        {prop.estacionamientos != null && (
                          <span className="flex items-center gap-1">
                            <Car className="h-3.5 w-3.5" style={{ color: "var(--pf-text-light)" }} aria-hidden />
                            {prop.estacionamientos}
                          </span>
                        )}
                        {prop.m2Totales != null && (
                          <span>{prop.m2Totales.toNumber()} m²</span>
                        )}
                      </div>

                      {/* Badges de comodidades */}
                      {(prop.aceptaMascotas || !prop.pagaGastosComunes) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {prop.aceptaMascotas && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
                            >
                              <PawPrint className="h-2.5 w-2.5" aria-hidden />
                              Mascotas
                            </span>
                          )}
                          {!prop.pagaGastosComunes && (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ background: "var(--pf-success-bg)", color: "var(--pf-success-color)" }}
                            >
                              Sin GC
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-auto pt-4">
                        <p className="text-base font-bold" style={{ color: "var(--pf-purple)" }}>
                          {clpOrUf(pub.precioReferencia?.toNumber() ?? null, pub.denominacionPrecio)} /mes
                        </p>
                        <p className="mt-0.5 text-[11px]" style={{ color: "var(--pf-text-light)" }}>
                          Por {pub.tenant.nombre}
                        </p>
                      </div>
                    </div>

                    {/* CTA row */}
                    <div
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ borderTop: "1px solid var(--pf-border)" }}
                    >
                      <span className="text-xs font-semibold" style={{ color: "var(--pf-purple)" }}>Ver detalle</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1"
                        style={{ color: "var(--pf-purple)" }}
                        aria-hidden
                      />
                    </div>
                  </Link>
                  </BorderGlow>
                );
              })}
            </div>
          </>
        )}
      </main>

      {/* ── CTA dark ─────────────────────────────────────────────────── */}
      <section className="pf-cta-dark">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-bold text-white sm:text-3xl" style={{ letterSpacing: "-0.01em" }}>
            ¿Eres corredor de propiedades?
          </h2>
          <p className="mt-3 text-base" style={{ color: "#A0AEC0" }}>
            Publica tu catálogo con tu marca y recibe las consultas directo, sin pagar comisión por cada contacto.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/registro"
              className="pf-btn-primary"
              style={{ padding: "14px 32px", fontSize: "15px", fontWeight: 700 }}
            >
              Crear cuenta gratuita
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--pf-text-light)" }}
            >
              Ya tengo cuenta →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer público ───────────────────────────────────────────── */}
      <PublicFooter />
    </div>
  );
}
