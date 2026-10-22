/**
 * Skeleton de carga para todas las rutas del panel.
 * Imita la estructura común: título, fila de KPIs y bloque de contenido.
 */
export default function PanelLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando contenido">
      {/* Título */}
      <div className="pgo-skeleton mb-2 h-7 w-48" />
      <div className="pgo-skeleton mb-6 h-4 w-72" />

      {/* Fila de KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="pgo-card p-5">
            <div className="pgo-skeleton h-3 w-20" />
            <div className="pgo-skeleton mt-3 h-7 w-28" />
            <div className="pgo-skeleton mt-3 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Bloque de contenido */}
      <div className="pgo-card mt-6 p-5">
        <div className="pgo-skeleton h-5 w-40" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="pgo-skeleton h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
