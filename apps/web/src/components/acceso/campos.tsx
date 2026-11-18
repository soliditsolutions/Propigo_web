"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CircleCheck, Eye, EyeOff, Check, Info, Clock, type LucideIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

/* ── Campo de texto con etiqueta, ícono, ayuda, error y marca de validez ── */

type CampoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  ayuda?: string;
  error?: string | null;
  /** Se muestra una marca verde cuando el valor ya es válido. */
  valido?: boolean;
  /** Contenido a la derecha de la etiqueta (por ejemplo «¿Olvidaste tu contraseña?»). */
  derecha?: ReactNode;
  /** Botón u otro control dentro del campo, a la derecha. */
  lado?: ReactNode;
  numeros?: boolean;
};

export function Campo({ id, etiqueta, icono: Icono, ayuda, error, valido, derecha, lado, numeros, ...input }: CampoProps) {
  const ayudaId = ayuda ? `${id}-ayuda` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="pgo-acc-campo">
      <div className="pgo-acc-etiqueta-fila">
        <label htmlFor={id} className="pgo-acc-etiqueta">{etiqueta}</label>
        {derecha}
      </div>
      <div className="pgo-acc-envoltura">
        <Icono className="pgo-acc-icono" aria-hidden="true" />
        <input
          id={id}
          className={`pgo-acc-input${numeros ? " pgo-acc-input--numeros" : ""}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={[ayudaId, errorId].filter(Boolean).join(" ") || undefined}
          {...input}
        />
        {lado ?? (valido && !error ? <CircleCheck className="pgo-acc-lado pgo-acc-valido" aria-hidden="true" /> : null)}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="pgo-acc-error-texto">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : ayuda ? (
        <p id={ayudaId} className="pgo-acc-ayuda">{ayuda}</p>
      ) : null}
    </div>
  );
}

/** Campo de contraseña con botón para mostrarla u ocultarla. */
export function CampoClave(props: Omit<CampoProps, "icono" | "type" | "lado"> & { icono: LucideIcon }) {
  const [visible, setVisible] = useState(false);
  return (
    <Campo
      {...props}
      type={visible ? "text" : "password"}
      lado={
        <button
          type="button"
          className="pgo-acc-lado"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Eye className="h-[18px] w-[18px]" aria-hidden="true" />}
        </button>
      }
    />
  );
}

/* ── Botón ── */

type BotonProps = {
  variante?: "primario" | "secundario" | "ok";
  bloque?: boolean;
  chico?: boolean;
  cargando?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

export function Boton({ variante = "primario", bloque, chico, cargando, type = "button", disabled, onClick, children }: BotonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={[
        "pgo-acc-btn",
        `pgo-acc-btn--${variante}`,
        bloque ? "pgo-acc-btn--bloque" : "",
        chico ? "pgo-acc-btn--chico" : "",
      ].filter(Boolean).join(" ")}
    >
      {cargando ? <Spinner className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

/* ── Aviso ── */

const ICONO_AVISO = { error: AlertCircle, ok: Check, info: Info, pausa: Clock } as const;

export function Aviso({ variante, titulo, children }: { variante: keyof typeof ICONO_AVISO; titulo?: string; children: ReactNode }) {
  const Icono = ICONO_AVISO[variante];
  return (
    <div className={`pgo-acc-aviso pgo-acc-aviso--${variante}`} role={variante === "error" ? "alert" : "status"}>
      <Icono aria-hidden="true" />
      <div>
        {titulo ? <strong>{titulo}</strong> : null}
        {children}
      </div>
    </div>
  );
}

/* ── Cuenta regresiva ── */

export function useCuentaRegresiva(segundos: number, activa: boolean): number {
  const [faltan, setFaltan] = useState(segundos);
  useEffect(() => {
    if (!activa) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const f = Math.max(0, segundos - Math.floor((Date.now() - t0) / 1000));
      setFaltan(f);
      if (f === 0) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [segundos, activa]);
  return activa ? faltan : segundos;
}

export function formatoReloj(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Panel que cambia de alto con su contenido ── */

/**
 * Anima la altura del contenedor cuando cambia el contenido (cambio de pestaña,
 * de paso, aparición de un aviso). El contenido nuevo entra con un deslizamiento
 * corto desde el lado de la dirección. Con movimiento reducido no anima.
 */
export function PanelAnimado({ clave, direccion = "adelante", children }: { clave: string; direccion?: "adelante" | "atras"; children: ReactNode }) {
  const interior = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState<number | null>(null);

  useEffect(() => {
    const el = interior.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAlto(el.offsetHeight));
    ro.observe(el);
    setAlto(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="pgo-acc-panel" style={alto === null ? undefined : { height: alto }}>
      <div ref={interior}>
        <div key={clave} className={`pgo-acc-entra${direccion === "atras" ? " pgo-acc-entra--atras" : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
