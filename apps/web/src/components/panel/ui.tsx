import type { ReactNode } from "react";

/* ── Card ──────────────────────────────────────────────────── */
export function Card({
  children,
  className = "",
  hoverable = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  as?: "div" | "article" | "section";
}) {
  return (
    <Tag
      className={`hw-card ${hoverable ? "hw-card-hover" : ""} ${className}`}
    >
      {children}
    </Tag>
  );
}

/* ── StatCard ───────────────────────────────────────────────── */
export type BadgeTone = "slate" | "green" | "red" | "amber" | "blue";

const accentBar: Record<BadgeTone, string> = {
  red:   "var(--hw-danger)",
  blue:  "var(--hw-primary)",
  green: "var(--hw-success)",
  amber: "var(--hw-warning)",
  slate: "var(--hw-border-2)",
};
const accentText: Record<BadgeTone, string> = {
  red:   "var(--hw-danger)",
  blue:  "var(--hw-primary)",
  green: "var(--hw-success)",
  amber: "var(--hw-warning)",
  slate: "var(--hw-text-1)",
};
const accentBg: Record<BadgeTone, string> = {
  red:   "var(--hw-danger-lt)",
  blue:  "var(--hw-primary-lt)",
  green: "var(--hw-success-lt)",
  amber: "var(--hw-warning-lt)",
  slate: "var(--hw-surface-2)",
};

export function StatCard({
  label,
  value,
  sub,
  tone = "slate",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: BadgeTone;
  icon?: ReactNode;
}) {
  return (
    <div
      className="hw-card hw-card-glow hw-sheen relative overflow-hidden p-5 flex gap-4 items-start"
      style={{ "--hw-card-glow": accentBar[tone] } as React.CSSProperties}
    >
      {/* Barra accent lateral */}
      <div
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[14px]"
        style={{ background: accentBar[tone], boxShadow: `0 0 10px ${accentBar[tone]}` }}
      />

      {/* Ícono */}
      {icon && (
        <div
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: accentBg[tone],
            color: accentText[tone],
            boxShadow: tone === "slate" ? undefined : `0 0 12px color-mix(in srgb, ${accentText[tone]} 30%, transparent)`,
          }}
        >
          {icon}
        </div>
      )}

      {/* Contenido */}
      <div className="pl-1 min-w-0">
        <p
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--hw-text-3)" }}
        >
          {label}
        </p>
        <p
          className="mt-1.5 text-2xl font-bold leading-none hw-num"
          style={{ color: accentText[tone] }}
        >
          {value}
        </p>
        {sub && (
          <p
            className="mt-1.5 text-xs leading-snug"
            style={{ color: "var(--hw-text-4)" }}
          >
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Badge ──────────────────────────────────────────────────── */
const badgeStyle: Record<BadgeTone, { bg: string; color: string; ring: string }> = {
  slate: { bg: "var(--hw-surface-2)", color: "var(--hw-text-2)", ring: "var(--hw-border-2)" },
  green: { bg: "var(--hw-success-lt)", color: "var(--hw-success)", ring: "var(--hw-success-bd)" },
  red:   { bg: "var(--hw-danger-lt)",  color: "var(--hw-danger)",  ring: "var(--hw-danger-bd)"  },
  amber: { bg: "var(--hw-warning-lt)", color: "var(--hw-warning)", ring: "var(--hw-warning-bd)" },
  blue:  { bg: "var(--hw-primary-lt)", color: "var(--hw-primary)", ring: "var(--hw-primary-bd)" },
};

export function Badge({
  tone = "slate",
  pulse = false,
  children,
}: {
  tone?: BadgeTone;
  /** Punto animado — reservado para estados urgentes/activos (ver estadoPulse). */
  pulse?: boolean;
  children: ReactNode;
}) {
  const s = badgeStyle[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{
        background: s.bg,
        color: s.color,
        outline: `1px solid ${s.ring}`,
        outlineOffset: "-1px",
        boxShadow: tone === "slate" ? undefined : `0 0 10px color-mix(in srgb, ${s.color} 35%, transparent)`,
      }}
    >
      {pulse && (
        <span
          aria-hidden="true"
          className="hw-badge-dot h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }}
        />
      )}
      {children}
    </span>
  );
}

/* ── estadoTone ─────────────────────────────────────────────── */
export function estadoTone(estado: string): BadgeTone {
  const map: Record<string, BadgeTone> = {
    pagado:              "green",
    liquidado:           "green",
    vigente:             "green",
    disponible:          "green",
    atrasado:            "red",
    pendiente:           "amber",
    reservada:           "amber",
    en_revision:         "amber",
    arrendada:           "blue",
    terminado:           "slate",
    terminado_anticipado:"slate",
    borrador:            "slate",
    publicada:           "green",
    bajada:              "slate",
  };
  return map[estado] ?? "slate";
}

/* ── estadoPulse — punto animado solo en estados urgentes/activos ────── */
export function estadoPulse(estado: string): boolean {
  return estado === "disponible" || estado === "atrasado";
}

/* ── estadoLabel — texto legible para Badge (Badge solo aplica CSS
   `capitalize`, que no reemplaza guiones bajos: "terminado_anticipado"
   se vería "Terminado_anticipado" sin este mapeo). ────── */
const ESTADO_LABEL: Record<string, string> = {
  terminado_anticipado: "Término anticipado",
  en_revision:          "En revisión",
};
export function estadoLabel(estado: string): string {
  return ESTADO_LABEL[estado] ?? estado.charAt(0).toUpperCase() + estado.slice(1);
}

/* ── PageTitle ──────────────────────────────────────────────── */
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--hw-text-1)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--hw-text-3)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── SectionTitle ───────────────────────────────────────────── */
export function SectionTitle({
  title,
  count,
  countTone = "slate",
  description,
  as: Tag = "h2",
}: {
  title: string;
  count?: number;
  countTone?: BadgeTone;
  description?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Tag
      className="mb-3 flex items-center gap-2 font-semibold"
      style={{ color: "var(--hw-text-1)" }}
    >
      {count !== undefined && (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: accentBg[countTone],
            color: accentText[countTone],
          }}
        >
          {count}
        </span>
      )}
      {title}
      {description && (
        <span
          className="text-xs font-normal"
          style={{ color: "var(--hw-text-4)" }}
        >
          {description}
        </span>
      )}
    </Tag>
  );
}

/* ── Tabs (custom — Phase B upgrades to Radix) ──────────────── */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number; tone?: BadgeTone }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      className="flex gap-1 rounded-xl p-1"
      role="tablist"
      aria-label="Seleccionar paso"
      style={{ background: "var(--hw-border)" }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.key)}
            className="hw-btn relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
            style={{
              background: isActive ? "var(--hw-surface)" : "transparent",
              // --hw-text-1 flipea con el tema y contrasta el surface (dark y light);
              // --hw-sidebar es un token de FONDO oscuro → texto invisible en dark.
              color: isActive ? "var(--hw-text-1)" : "var(--hw-text-3)",
              boxShadow: isActive ? "var(--hw-shadow-1)" : "none",
            }}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                aria-label={`${t.count} elementos`}
                className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold"
                style={{
                  background: isActive ? accentBg[t.tone ?? "slate"] : "rgba(100,116,139,0.15)",
                  color: isActive ? accentText[t.tone ?? "slate"] : "var(--hw-text-3)",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Table helpers ──────────────────────────────────────────── */
export function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-${align}`}
      style={{ color: "var(--hw-text-4)" }}
    >
      {children}
    </th>
  );
}

export function TableWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="hw-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table">
          {children}
        </table>
      </div>
    </div>
  );
}

/* ── CupoBadge ─────────────────────────────────────────────── */

/**
 * Indicador "usado / máximo" de un cupo del plan (Fase B0 del rowMap).
 *
 * El enforcement vive en el servidor (lib/plan-limits.ts); esto es lo que
 * hace que el límite sea *previsible* en vez de una pared sorpresa: quien
 * va a cargar propiedades o a mandar contratos a la IA ve cuánto le queda
 * antes de quedarse sin cupo, no después.
 *
 * Por eso hay un estado intermedio ámbar además del rojo: avisar al 80 %
 * deja margen para decidir (subir de plan, liberar cupo) mientras todavía
 * se puede; avisar solo al llegar al tope ya no sirve de aviso.
 */
export function CupoBadge({
  usado,
  max,
  unidad,
  planLabel,
}: {
  usado: number;
  max: number;
  unidad: string;
  /** Si se pasa, se muestra "· plan Gold" — útil donde el upsell tiene sentido. */
  planLabel?: string;
}) {
  const lleno = usado >= max;
  // max puede ser 0 en un plan sin la capacidad; dividir daría Infinity/NaN
  // y pintaría el badge en ámbar sin motivo.
  const cerca = !lleno && max > 0 && usado / max >= 0.8;

  const tono = lleno
    ? { bg: "var(--hw-danger-lt)",  fg: "var(--hw-danger)",  bd: "var(--hw-danger-bd)" }
    : cerca
      ? { bg: "var(--hw-warning-lt)", fg: "var(--hw-warning)", bd: "var(--hw-warning-bd)" }
      : { bg: "var(--hw-surface-2)",  fg: "var(--hw-text-3)",  bd: "var(--hw-border-2)" };

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: tono.bg, color: tono.fg, border: `1px solid ${tono.bd}` }}
    >
      <span className="tabular-nums">{usado} / {max}</span> {unidad}
      {planLabel ? ` · plan ${planLabel}` : ""}
    </span>
  );
}
