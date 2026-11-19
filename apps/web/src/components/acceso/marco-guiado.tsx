"use client";

import Link from "next/link";
import { Fragment, useRef, type CSSProperties, type ReactNode } from "react";
import { Check, FileCheck2, FileText, KeyRound, Link2, Lock, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Logo } from "@/components/public/Logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CORREO, ESLOGAN, MARCA } from "@/lib/marca";
import { useLuzPuntero } from "./luz";
import { T, type Flujo } from "./textos";
import "./acceso.css";

/** "pronto": el registro está cerrado y la pantalla solo lo explica. */
export type FlujoMarco = Flujo | "pronto";

const ICONOS_CONFIANZA = [Lock, ShieldCheck, FileText];
const ICONOS_DESTELLO = [Wallet, TrendingUp, FileCheck2];

function Confianza() {
  return (
    <ul className="pgo-acc-confianza" aria-label="Lo que protege tu cuenta">
      {T.confianza.map((t, i) => {
        const Icono = ICONOS_CONFIANZA[i];
        return <li key={t}><Icono aria-hidden="true" />{t}</li>;
      })}
    </ul>
  );
}

const ICONOS_DESTELLO_FLUJO = { login: ICONOS_DESTELLO, recuperar: [Link2], nueva: [KeyRound], verificar: [ShieldCheck] };

function Destellos({ flujo }: { flujo: FlujoMarco }) {
  if (!(flujo in T.destellos)) return null;
  const f = flujo as keyof typeof T.destellos;
  const items = T.destellos[f];
  const iconos = ICONOS_DESTELLO_FLUJO[f];
  return (
    <ul className="pgo-acc-destellos" aria-label={T.destellosEtiqueta}>
      {items.map((d, i) => {
        const Icono = iconos[i];
        return (
          <li key={d.titulo} style={{ "--d": i } as CSSProperties}>
            <span className="pgo-acc-destello-icono"><Icono aria-hidden="true" /></span>
            <span><strong>{d.titulo}</strong><small>{d.detalle}</small></span>
          </li>
        );
      })}
    </ul>
  );
}

/** Los tres pasos del registro: hecho, actual o pendiente según `paso`. */
function Ruta({ paso }: { paso: number }) {
  return (
    <ol className="pgo-acc-ruta" aria-label="Pasos para crear tu cuenta">
      {T.registro.pasos.map((s, i) => {
        const e = i < paso ? "hecho" : i === paso ? "actual" : "pendiente";
        return (
          <li key={s.titulo} data-estado={e} aria-current={e === "actual" ? "step" : undefined}>
            <span className="pgo-acc-marcador">{e === "hecho" ? <Check aria-hidden="true" /> : i + 1}</span>
            <div><strong>{s.titulo}</strong><span>{s.detalle}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

function Pie() {
  return (
    <footer className="pgo-acc-pie">
      <p style={{ margin: 0 }}>{MARCA} · {ESLOGAN}</p>
      <p style={{ margin: 0 }}>
        <Link href="/terminos-uso">Términos de uso</Link> · <Link href="/privacidad">Privacidad</Link> ·{" "}
        <a href={`mailto:${CORREO.soporte}`}>{CORREO.soporte}</a>
      </p>
    </footer>
  );
}

/**
 * Marco de las pantallas de acceso (estructura «recorrido guiado», aprobada en
 * noviembre de 2026): panel de marca de vidrio oscuro a la izquierda y la
 * tarjeta del formulario a la derecha. El estado del hilo de luz (enviando,
 * error, listo) lo deduce el CSS del contenido de la tarjeta, sin estado aquí.
 */
export function MarcoGuiado({
  flujo, paso = 0, ancho = 460, children,
}: {
  flujo: FlujoMarco;
  /** Paso actual del registro (0 a 2), para la ruta del panel de marca. */
  paso?: number;
  ancho?: number;
  children: ReactNode;
}) {
  const m = T.marca[flujo];
  const marca = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  useLuzPuntero(marca);
  useLuzPuntero(card);

  return (
    <div className="pgo-acc">
      <div className="pgo-aurora-layer" aria-hidden="true" />
      <div className="pgo-acc-velo" aria-hidden="true" />
      <div className="pgo-acc-dividida">
        <aside className="pgo-auth-aside pgo-acc-marca" ref={marca} aria-label={`Sobre ${MARCA}`}>
          <div className="pgo-acc-orbes" aria-hidden="true"><span /><span /></div>
          <Link href="/" aria-label={`${MARCA}: ir al inicio`} style={{ display: "inline-flex", width: "fit-content" }}>
            <Logo size="lg" wordColor="#fff" />
          </Link>

          <div key={flujo} className="pgo-acc-entra">
            {/* Titular de marca, no encabezado: el único h1 es el del formulario. El texto
                completo va oculto para lectores de pantalla; las palabras sueltas, solo a la vista. */}
            <p className="pgo-acc-marca-titulo">
              <span className="sr-only">{m.titulo}</span>
              <span aria-hidden="true">
                {m.titulo.split(" ").map((w, i) => (
                  <Fragment key={i}>
                    {i > 0 ? " " : null}
                    <span className="pgo-acc-palabra" style={{ "--i": i } as CSSProperties}>{w}</span>
                  </Fragment>
                ))}
              </span>
            </p>
            <p className="pgo-acc-marca-texto">{m.texto}</p>
            <Destellos flujo={flujo} />
            {flujo === "registro" ? <Ruta paso={paso} /> : null}
          </div>

          <div className="pgo-acc-marca-pie">
            <Confianza />
          </div>
        </aside>

        {/* Regiones separadas: el pie (contentinfo) no va dentro de main */}
        <div className="pgo-acc-form-lado">
          <div className="pgo-acc-toggle"><ThemeToggle /></div>
          <Link href="/" className="pgo-acc-logo-movil" aria-label={`${MARCA}: ir al inicio`}>
            <Logo size="md" wordColor="var(--pgo-text-1)" />
          </Link>
          <main className="pgo-acc-form-main">
            <div
              ref={card}
              className="pgo-auth-card pgo-acc-card pgo-acc-card--viva"
              style={{ "--acc-ancho": `${ancho}px` } as CSSProperties}
            >
              <div className="pgo-acc-entra">{children}</div>
            </div>
          </main>
          <Pie />
        </div>
      </div>
    </div>
  );
}
