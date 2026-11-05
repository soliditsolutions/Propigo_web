import type { LucideIcon } from "lucide-react";
import { AsegurarTema } from "@/components/ui/asegurar-tema";

/**
 * Bloque de estado para páginas de error y "no encontrado". Sin hooks, así lo
 * usan tanto los límites de error (Client Components) como los not-found
 * (Server Components).
 *
 * `variante="pagina"` ocupa la pantalla completa (sitio público, portal);
 * `variante="panel"` se integra como tarjeta dentro del menú del panel.
 */
export function EstadoPagina({
  icono: Icono,
  tono = "neutro",
  titulo,
  descripcion,
  acciones,
  referencia,
  variante = "pagina",
}: {
  icono: LucideIcon;
  tono?: "neutro" | "error";
  titulo: string;
  descripcion: React.ReactNode;
  acciones: React.ReactNode;
  /** Identificador del error (digest) para que soporte lo encuentre en el log. */
  referencia?: string;
  variante?: "pagina" | "panel";
}) {
  const colorIcono = tono === "error" ? "var(--pgo-danger)" : "var(--pgo-primary)";
  const fondoIcono = tono === "error" ? "var(--pgo-danger-lt)" : "var(--pgo-primary-lt)";

  const contenido = (
    <div className={`${variante === "panel" ? "pgo-card" : "pgo-auth-card"} w-full max-w-md rounded-2xl p-6 text-center sm:p-8`}>
      <AsegurarTema />
      <span
        className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: fondoIcono, color: colorIcono }}
        aria-hidden="true"
      >
        <Icono className="h-6 w-6" />
      </span>
      <h1 className="text-xl font-bold text-balance" style={{ color: "var(--pgo-text-1)" }}>
        {titulo}
      </h1>
      <div className="mt-2 text-sm leading-relaxed" style={{ color: "var(--pgo-text-3)" }}>
        {descripcion}
      </div>
      <div className="mt-6 flex flex-col-reverse items-stretch justify-center gap-2 sm:flex-row sm:items-center">
        {acciones}
      </div>
      {referencia && (
        <p className="mt-5 text-xs" style={{ color: "var(--pgo-text-4)" }}>
          Código de referencia: <span className="font-mono select-all">{referencia}</span>
        </p>
      )}
    </div>
  );

  if (variante === "panel") {
    return <div className="flex justify-center py-10 sm:py-16">{contenido}</div>;
  }
  return (
    <main className="pgo-page-bg flex min-h-screen items-center justify-center px-4 py-10">
      {contenido}
    </main>
  );
}

/**
 * Clases de los botones de las páginas de estado (primario y secundario).
 * `h-11!`: .pgo-btn-primary fija 36 px y le gana a h-11 por orden en la
 * cascada; los dos botones deben medir lo mismo (44 px, objetivo táctil).
 */
export const ESTADO_BTN_PRIMARIO =
  "pgo-btn-primary h-11! justify-center rounded-xl px-5 text-sm font-semibold";
export const ESTADO_BTN_SECUNDARIO =
  "pgo-btn inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold";
export const ESTILO_BTN_SECUNDARIO: React.CSSProperties = {
  background: "var(--pgo-surface-2)",
  color: "var(--pgo-text-1)",
  border: "1px solid var(--pgo-border)",
};
