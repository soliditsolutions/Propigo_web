/**
 * Marketplace público — ficha de propiedad individual.
 * Sin autenticación. Tema PayFlow aplicado.
 */
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  BedDouble, Bath, Car, MapPin, Home,
  ArrowLeft, CheckCircle2, ChevronRight,
} from "lucide-react";
import { CorredorPanel } from "@/components/marketplace/CorredorPanel";
import { PropertyMap } from "@/components/marketplace/PropertyMap";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { PublicFooter } from "@/components/public/PublicFooter";
import { clpOrUf, plural } from "@/lib/format";
import { tipoMeta } from "@/lib/propiedad-meta";
import { idFiltro } from "@/lib/busqueda";
import { geocodificarDireccion, ubicacionAproximada } from "@/lib/geocoding";

export default async function MarketplaceFichaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // SEC: el id viene de la URL en una ruta pública. Sin validarlo, cualquier
  // texto que no sea uuid llegaba a Postgres y devolvía un 500 en vez de un
  // 404 — un enlace mal copiado bastaba para romper la ficha.
  const idPublicacion = idFiltro(id);
  if (!idPublicacion) notFound();

  const pub = await prisma.publicacion.findFirst({
    where: { id: idPublicacion, estado: "publicada" },
    include: {
      propiedad: {
        select: {
          id: true, tipo: true, direccion: true, comuna: true, region: true,
          piezas: true, banos: true, estacionamientos: true,
          m2Totales: true, m2Construidos: true, plantas: true,
          antiguedadAnios: true, esCondominio: true,
          pagaGastosComunes: true, valorGastosComunes: true,
          orientacion: true, otrasDescripciones: true,
          latitud: true, longitud: true, mostrarUbicacionExacta: true,
          imagenes: { orderBy: { orden: "asc" }, select: { url: true, orden: true } },
        },
      },
      tenant: { select: { id: true, nombre: true } },
    },
  });

  if (!pub) notFound();

  /* Valoraciones del corredor */
  const valoracionesDb = await prisma.valoracionCorredor.findMany({
    where:   { tenantId: pub.tenantId, esVisible: true },
    orderBy: { createdAt: "desc" },
    take:    10,
    select: {
      id: true, estrellas: true, comentario: true, createdAt: true,
      nombre: true, apellido: true,
    },
  });

  const totalVal = valoracionesDb.length;
  const promedioVal = totalVal > 0
    ? Math.round((valoracionesDb.reduce((s, v) => s + v.estrellas, 0) / totalVal) * 10) / 10
    : null;

  const prop = pub.propiedad;
  const meta = tipoMeta(prop.tipo);
  const Icon = meta.icon;
  const imagenes = prop.imagenes;

  const amenities = [
    prop.piezas          != null && { icon: BedDouble, label: `${prop.piezas} ${plural(prop.piezas, "pieza")}` },
    prop.banos           != null && { icon: Bath,      label: `${prop.banos} ${plural(prop.banos, "baño")}` },
    prop.estacionamientos != null && { icon: Car,      label: `${prop.estacionamientos} ${plural(prop.estacionamientos, "estacionamiento")}` },
  ].filter(Boolean) as { icon: typeof Home; label: string }[];

  const specs = [
    prop.m2Totales       != null && { label: "Superficie total",     value: `${prop.m2Totales} m²` },
    prop.m2Construidos   != null && { label: "Superficie construida", value: `${prop.m2Construidos} m²` },
    prop.plantas         != null && { label: "Plantas",               value: String(prop.plantas) },
    prop.antiguedadAnios != null && { label: "Antigüedad",            value: `${prop.antiguedadAnios} años` },
    prop.orientacion              && { label: "Orientación",          value: prop.orientacion },
    { label: "¿Condominio?", value: prop.esCondominio ? "Sí" : "No" },
  ].filter(Boolean) as { label: string; value: string }[];

  // SEC / Ley 21.719: por defecto solo se muestra comuna/región y un área
  // aproximada en el mapa. La dirección exacta y el pin solo se exponen si
  // el corredor activó mostrarUbicacionExacta (tras acuerdo con el propietario).
  const direccionMostrada = prop.mostrarUbicacionExacta
    ? [prop.direccion, prop.comuna, prop.region].filter(Boolean).join(", ")
    : [prop.comuna, prop.region].filter(Boolean).join(", ") || "Ubicación no especificada";

  // Auto-reparación: propiedades creadas antes de que existiera este campo, o
  // cuya geocodificación falló en su momento (Nominatim caído/timeout/sin
  // match), quedan con lat/lng nulos para siempre — el mapa desaparecía sin
  // aviso. Reintentamos una vez aquí (best-effort, igual que en creación) y
  // persistimos el resultado para no volver a golpear Nominatim en la
  // próxima visita.
  let latitudNum  = prop.latitud  != null ? Number(prop.latitud)  : null;
  let longitudNum = prop.longitud != null ? Number(prop.longitud) : null;

  if (latitudNum == null && prop.direccion) {
    const geocoded = await geocodificarDireccion(prop.direccion, prop.comuna, prop.region);
    if (geocoded) {
      latitudNum  = geocoded.latitud;
      longitudNum = geocoded.longitud;
      // Ruta pública sin sesión: hay que fijar el tenant para esta escritura
      // puntual o RLS la descarta en silencio (0 filas, sin error) — mismo
      // patrón que usa registro/actions.ts para su primera escritura sin
      // contexto de tenant previo.
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${pub.tenant.id}, true)`;
        await tx.propiedad.update({ where: { id: prop.id }, data: { latitud: geocoded.latitud, longitud: geocoded.longitud } });
      }).catch(() => { /* best-effort — el mapa de esta visita ya tiene las coordenadas igual */ });
    }
  }

  const coordenadasMapa = latitudNum != null && longitudNum != null
    ? prop.mostrarUbicacionExacta
      ? { latitud: latitudNum, longitud: longitudNum }
      : ubicacionAproximada(latitudNum, longitudNum, prop.id)
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--pf-surface)", overflowX: "hidden" }}>

      {/* ── Navbar público ────────────────────────────────────────────── */}
      <PublicNavbar />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">

        {/* Breadcrumb */}
        <nav className="mb-5 flex items-center gap-1.5 text-xs" style={{ color: "var(--pf-text-light)" }}>
          <Link href="/marketplace" className="pf-breadcrumb-a">
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Propiedades
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span style={{ color: "var(--pf-navy)" }} className="line-clamp-1">{pub.titulo}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

          {/* Columna principal */}
          <div className="space-y-5">

            {/* Galería */}
            {imagenes.length > 0 ? (
              <div className="overflow-hidden rounded-2xl">
                {imagenes.length === 1 ? (
                  <div className="relative h-72 w-full overflow-hidden rounded-2xl sm:h-96" style={{ background: "var(--pf-hero-1)" }}>
                    <Image src={imagenes[0].url} alt={pub.titulo} fill className="object-cover" sizes="(max-width: 640px) 100vw, 768px" preload />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative h-60 overflow-hidden rounded-2xl sm:h-80" style={{ background: "var(--pf-hero-1)" }}>
                      <Image src={imagenes[0].url} alt={pub.titulo} fill className="object-cover" sizes="(max-width: 640px) 50vw, 384px" preload />
                    </div>
                    <div className="grid gap-2">
                      {imagenes.slice(1, 3).map((img, i) => (
                        <div
                          key={i}
                          className="relative overflow-hidden rounded-2xl"
                          style={{
                            background: "var(--pf-hero-1)",
                            height: imagenes.slice(1, 3).length === 1 ? "100%" : "calc(50% - 4px)",
                          }}
                        >
                          <Image src={img.url} alt={`Imagen ${i + 2}`} fill className="object-cover" sizes="(max-width: 640px) 50vw, 384px" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pf-img-empty flex h-60 items-center justify-center rounded-2xl">
                <Icon className="h-16 w-16" style={{ color: "var(--pf-border-input)" }} aria-hidden />
              </div>
            )}

            {/* Título y ubicación */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: "var(--pf-brand-tint)", color: "var(--pf-brand)" }}
                >
                  {meta.label}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: "var(--pf-success-bg)", color: "var(--pf-success-color)" }}
                >
                  Disponible
                </span>
              </div>
              <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "var(--pf-navy)" }}>{pub.titulo}</h1>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm" style={{ color: "var(--pf-text-muted)" }}>
                <MapPin className="h-4 w-4 shrink-0" style={{ color: "var(--pf-text-light)" }} aria-hidden />
                {direccionMostrada}
              </p>
            </div>

            {/* Amenities */}
            {amenities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {amenities.map(({ icon: Ic, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
                    style={{ background: "var(--pf-surface)", borderColor: "var(--pf-border)", color: "var(--pf-navy)" }}
                  >
                    <Ic className="h-4 w-4" style={{ color: "var(--pf-text-light)" }} aria-hidden />
                    {label}
                  </div>
                ))}
              </div>
            )}

            {/* Descripción */}
            {pub.descripcion && (
              <div className="pf-card p-5">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pf-text-light)" }}>Descripción</h2>
                <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "var(--pf-text-body)" }}>{pub.descripcion}</p>
              </div>
            )}

            {/* Especificaciones */}
            {specs.length > 0 && (
              <div className="pf-card p-5">
                <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pf-text-light)" }}>Especificaciones</h2>
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {specs.map(({ label, value }) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: "var(--pf-hero-1)" }}>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-light)" }}>{label}</dt>
                      <dd className="mt-0.5 text-sm font-semibold" style={{ color: "var(--pf-navy)" }}>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Gastos comunes */}
            {prop.pagaGastosComunes && prop.valorGastosComunes != null && (
              <div className="pf-card flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--pf-text-body)" }}>
                  <CheckCircle2 className="h-4 w-4" style={{ color: "var(--pf-brand)" }} aria-hidden />
                  Incluye gastos comunes
                </div>
                <span className="font-semibold" style={{ color: "var(--pf-navy)" }}>
                  {prop.valorGastosComunes.toNumber().toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 })} /mes
                </span>
              </div>
            )}

            {/* Ubicación en el mapa — si no hay coordenadas (dirección no
                geocodificable) mostramos un estado explícito en vez de
                omitir la sección en silencio. */}
            {coordenadasMapa ? (
              <PropertyMap
                latitud={coordenadasMapa.latitud}
                longitud={coordenadasMapa.longitud}
                exacta={prop.mostrarUbicacionExacta}
              />
            ) : (
              <div className="pf-card flex items-center gap-2.5 px-5 py-4 text-sm" style={{ color: "var(--pf-text-muted)" }}>
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                Mapa de ubicación no disponible para esta propiedad.
              </div>
            )}

            {/* Notas adicionales */}
            {prop.otrasDescripciones && (
              <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "var(--pgo-warning-bd)", background: "var(--pgo-warning-lt)", color: "var(--pgo-warning-dk)" }}>
                <p className="font-semibold mb-1">Información adicional</p>
                <p className="leading-relaxed">{prop.otrasDescripciones}</p>
              </div>
            )}
          </div>

          {/* ── Panel lateral ─────────────────────────────────────────── */}
          <aside className="space-y-4">
            <CorredorPanel
              publicacionId={pub.id}
              tituloPub={pub.titulo}
              nombreCorredor={pub.tenant.nombre}
              tenantId={pub.tenant.id}
              precioLabel={clpOrUf(pub.precioReferencia?.toNumber() ?? null, pub.denominacionPrecio)}
              precioPie={pub.denominacionPrecio === "UF"
                ? "Valor referencial en UF, se paga en CLP al día de vencimiento"
                : "por mes"}
              valoraciones={{
                promedio:  promedioVal,
                total:     totalVal,
                recientes: valoracionesDb.map(v => ({
                  id:         v.id,
                  estrellas:  v.estrellas,
                  comentario: v.comentario,
                  createdAt:  v.createdAt.toISOString(),
                  nombre:     v.nombre,
                  apellido:   v.apellido,
                })),
              }}
            />
          </aside>
        </div>
      </main>

      {/* ── Footer público ───────────────────────────────────────────── */}
      <PublicFooter className="mt-10" />
    </div>
  );
}
