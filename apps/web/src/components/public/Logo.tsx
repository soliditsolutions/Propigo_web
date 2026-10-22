import { ISOTIPO, WORDMARK } from "./logo-trazos";

/**
 * Logo Propigo: isotipo (casa con forma de "P") + wordmark "propi" + "go",
 * ambos a trazos vectoriales (no dependen de ninguna fuente cargada).
 * "go" e isotipo van siempre en los azules de marca; el color de "propi" se
 * adapta al fondo (`wordColor`). Los degradados se definen una sola vez en
 * <MarcaDefs/> (layout raíz): si vivieran dentro de cada logo, un logo oculto
 * (p. ej. la versión mobile en desktop) dejaría sin degradado a los demás.
 */
interface LogoProps {
  size?:      "xs" | "sm" | "md" | "lg" | "xl";
  wordColor?: string;
  /** Solo el isotipo (sidebar colapsado, avatares). */
  iconOnly?:  boolean;
  className?: string;
}

const SIZE = {
  xs: { icon: 20, word: 13, gap: 6  },
  sm: { icon: 26, word: 17, gap: 7  },
  md: { icon: 30, word: 20, gap: 8  },
  lg: { icon: 38, word: 25, gap: 10 },
  xl: { icon: 52, word: 34, gap: 12 },
} as const;

export function MarcaDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="propigo-iso" x1="10" y1="6" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--brand-500)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-400)" }} />
        </linearGradient>
        <linearGradient id="propigo-pliegue" x1="8" y1="6" x2="22" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--brand-700)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-500)" }} />
        </linearGradient>
        <mask id="propigo-silueta" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <path d={ISOTIPO.exterior} fill="#fff" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
        </mask>
        <linearGradient id="propigo-go" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--brand-500)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-400)" }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Isotipo({ size = 24, className }: { size?: number; className?: string }) {
  const v = ISOTIPO.ventana;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <path d={ISOTIPO.exterior} fill="url(#propigo-iso)" stroke="url(#propigo-iso)" strokeWidth="5" strokeLinejoin="round" />
      <path d={ISOTIPO.pliegue} fill="url(#propigo-pliegue)" opacity=".85" mask="url(#propigo-silueta)" />
      <path d={ISOTIPO.interior} fill="#fff" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <rect x={v.x} y={v.y} width={v.w} height={v.h} rx={v.r} style={{ fill: "var(--brand-500)" }} />
    </svg>
  );
}

function Wordmark({ height, color }: { height: number; color: string }) {
  const width = (WORDMARK.ancho / WORDMARK.alto) * height;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${WORDMARK.ancho} ${WORDMARK.alto}`}
      role="img"
      aria-label="Propigo"
      focusable="false"
    >
      <g transform={WORDMARK.transform} strokeLinejoin="round" strokeWidth={WORDMARK.engrose}>
        <path d={WORDMARK.propi} style={{ fill: color, stroke: color }} />
        <path d={WORDMARK.go} fill="url(#propigo-go)" stroke="url(#propigo-go)" />
      </g>
    </svg>
  );
}

export function Logo({
  size = "sm",
  wordColor = "var(--pf-navy)",
  iconOnly = false,
  className = "",
}: LogoProps) {
  const sz = SIZE[size];
  if (iconOnly) return <Isotipo size={sz.icon} className={className} />;
  // El wordmark incluye ascendentes y descendentes: su alto total es ~1.6× el
  // cuerpo de la letra, así se alinea ópticamente con el isotipo.
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: sz.gap }}>
      <Isotipo size={sz.icon} className="shrink-0" />
      <Wordmark height={Math.round(sz.word * 1.6)} color={wordColor} />
    </span>
  );
}
