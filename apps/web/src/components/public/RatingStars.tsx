import { Star } from "lucide-react";

/** Fila de estrellas 1-5 + promedio numérico + total de reseñas. Reutilizada
 * en las tarjetas de corredor/propiedad del home y en CorredorPanel. */
export function RatingStars({
  promedio,
  total,
  size = "sm",
  label,
}: {
  promedio: number;
  total: number;
  size?: "sm" | "xs";
  /** Prefijo que aclara QUÉ se está evaluando (ej. "Corredor"). Sin esto,
   * unas estrellas dentro de una tarjeta de propiedad se leen como si
   * calificaran a la propiedad — y hoy la plataforma solo tiene rating de
   * corredores. Ver el comentario de getTopPropiedades en app/page.tsx. */
  label?: string;
}) {
  const starSize = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-1">
      {label && (
        <span className="text-xs" style={{ color: "var(--pf-text-muted)" }}>
          {label}:
        </span>
      )}
      <div className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={starSize}
            style={{
              color: n <= Math.round(promedio) ? "var(--pgo-warning)" : "var(--pf-border-input)",
              fill:  n <= Math.round(promedio) ? "var(--pgo-warning)" : "transparent",
            }}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-xs font-semibold" style={{ color: "var(--pf-navy)" }}>
        {/* es-CL: el separador decimal es coma, no punto. `toFixed(1)` daba
            "5.0", que en Chile se lee como formato extranjero. */}
        {promedio.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </span>
      <span className="text-xs" style={{ color: "var(--pf-text-light)" }}>
        ({total})
      </span>
    </div>
  );
}
