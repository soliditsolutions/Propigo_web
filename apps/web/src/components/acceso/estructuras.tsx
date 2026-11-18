"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Check, FileText, ShieldCheck, Wallet, Lock } from "lucide-react";
import { Logo } from "@/components/public/Logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CORREO, ESLOGAN, MARCA } from "@/lib/marca";
import { PanelAnimado } from "./campos";
import { EscenaProducto } from "./escena";
import { FormLogin, FormRecuperar, FormRegistro, type EstadoCard, type EstadoDemo } from "./forms";
import { T, saludoSegunHora, type Flujo } from "./textos";
import "./acceso.css";

export type PropsEstructura = {
  flujo: Flujo;
  onFlujo: (f: Flujo) => void;
  demo: EstadoDemo;
  paso: number;
  onPaso: (n: number) => void;
};

/* ── Piezas comunes ── */

function Fondo() {
  return (
    <>
      <div className="pgo-aurora-layer" aria-hidden="true" />
      <div className="pgo-acc-velo" aria-hidden="true" />
    </>
  );
}

function Barra() {
  return (
    <header className="pgo-acc-barra">
      <Link href="/" aria-label={`${MARCA}: ir al inicio`}>
        <Logo size="md" wordColor="var(--pgo-text-1)" />
      </Link>
      <ThemeToggle />
    </header>
  );
}

function Pie() {
  return (
    <footer className="pgo-acc-pie">
      <p style={{ margin: 0 }}>
        {MARCA} · {ESLOGAN}
      </p>
      <p style={{ margin: 0 }}>
        <Link href="/terminos-uso">Términos de uso</Link> · <Link href="/privacidad">Privacidad</Link> ·{" "}
        <a href={`mailto:${CORREO.soporte}`}>{CORREO.soporte}</a>
      </p>
    </footer>
  );
}

const ICONOS_CONFIANZA = [Lock, ShieldCheck, FileText];

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

/** Los tres flujos con sus formularios; cada estructura decide el marco. */
function Flujos({
  p, onEstado, tabs, progreso, modoRegistro, sinTitulo,
}: {
  p: PropsEstructura;
  onEstado: (e: EstadoCard) => void;
  /** En la estructura con pestañas el enlace a crear cuenta sobra: ya están las pestañas. */
  tabs?: boolean;
  progreso?: "dentro" | "movil" | "no";
  modoRegistro?: "pasos" | "pagina";
  sinTitulo?: boolean;
}) {
  const { flujo, onFlujo, demo, paso, onPaso } = p;
  const irLogin = () => onFlujo("login");
  if (flujo === "login") {
    return (
      <FormLogin
        key={`l-${demo}`} demo={demo} onEstado={onEstado} sinTitulo={sinTitulo}
        irRecuperar={() => onFlujo("recuperar")}
        irRegistro={tabs ? undefined : () => onFlujo("registro")}
      />
    );
  }
  if (flujo === "recuperar") {
    return <FormRecuperar key={`r-${demo}`} demo={demo} onEstado={onEstado} irLogin={irLogin} sinTitulo={sinTitulo} />;
  }
  return (
    <FormRegistro
      key={`g-${demo}`} modo={modoRegistro ?? "pasos"} paso={paso} onPaso={onPaso}
      demo={demo} onEstado={onEstado} irLogin={irLogin} progreso={progreso}
    />
  );
}

/** Dirección del deslizamiento al cambiar de flujo. */
const ORDEN: Record<Flujo, number> = { login: 0, recuperar: 1, registro: 2 };
function useDireccion(flujo: Flujo): "adelante" | "atras" {
  const [previo, setPrevio] = useState(flujo);
  const [dir, setDir] = useState<"adelante" | "atras">("adelante");
  // Ajuste durante el render (patrón de React para derivar estado de un cambio de props).
  if (flujo !== previo) {
    setPrevio(flujo);
    setDir(ORDEN[flujo] >= ORDEN[previo] ? "adelante" : "atras");
  }
  return dir;
}

/** Saludo según la hora local: en el servidor «Hola.», y en el navegador el que corresponde a la hora. */
const sinSuscripcion = () => () => {};
function useSaludo(): string {
  return useSyncExternalStore(sinSuscripcion, () => saludoSegunHora(new Date().getHours()), () => "Hola.");
}

/* ═════ A — Tarjeta con pestañas ═════ */

export function EstructuraTabs(p: PropsEstructura) {
  const [estado, setEstado] = useState<EstadoCard>("reposo");
  const dir = useDireccion(p.flujo);
  const enTabs = p.flujo !== "recuperar";

  function teclas(e: KeyboardEvent) {
    if (e.key === "ArrowRight") p.onFlujo("registro");
    if (e.key === "ArrowLeft") p.onFlujo("login");
  }

  return (
    <div className="pgo-acc">
      <Fondo />
      <div className="pgo-acc-pagina">
        <Barra />
        <main className="pgo-acc-centro">
          <div
            className="pgo-acc-card"
            data-estado={estado}
            style={{ "--acc-ancho": p.flujo === "registro" ? "500px" : "460px" } as CSSProperties}
          >
            <div className="pgo-acc-cuerpo">
              {enTabs ? (
                <div className="pgo-acc-tabs" role="tablist" aria-label="Acceso" data-activa={p.flujo === "registro" ? 1 : 0} onKeyDown={teclas}>
                  <span className="pgo-acc-tabs-ind" aria-hidden="true" />
                  <button role="tab" type="button" id="tab-login" aria-selected={p.flujo === "login"} tabIndex={p.flujo === "login" ? 0 : -1} className="pgo-acc-tab" onClick={() => p.onFlujo("login")}>Ingresar</button>
                  <button role="tab" type="button" id="tab-registro" aria-selected={p.flujo === "registro"} tabIndex={p.flujo === "registro" ? 0 : -1} className="pgo-acc-tab" onClick={() => p.onFlujo("registro")}>Crear cuenta</button>
                </div>
              ) : null}
              <PanelAnimado clave={p.flujo} direccion={dir}>
                <div role={enTabs ? "tabpanel" : undefined} aria-labelledby={enTabs ? `tab-${p.flujo}` : undefined}>
                  <Flujos p={p} onEstado={setEstado} tabs progreso="dentro" />
                </div>
              </PanelAnimado>
            </div>
          </div>
          <Confianza />
        </main>
        <Pie />
      </div>
    </div>
  );
}

/* ═════ B — Recorrido guiado ═════ */

const TITULOS_MARCA: Record<Flujo, { t: string; x: string }> = {
  login: { t: "Tu cartera de arriendos, al día.", x: "Detecta los pagos, aplica el reajuste del IPC y deja el respaldo listo para rendirle al propietario." },
  recuperar: { t: "A todos nos pasa.", x: "Te enviamos un enlace al correo y en un minuto vuelves a estar adentro." },
  registro: { t: "Crea tu cuenta en tres pasos.", x: "Sin tarjeta de crédito. Empiezas con una propiedad y el plan Gratuito." },
};

export function EstructuraGuiada(p: PropsEstructura) {
  const [estado, setEstado] = useState<EstadoCard>("reposo");
  const dir = useDireccion(p.flujo);
  const m = TITULOS_MARCA[p.flujo];

  return (
    <div className="pgo-acc">
      <Fondo />
      <div className="pgo-acc-dividida">
        <aside className="pgo-acc-marca">
          <Link href="/" aria-label={`${MARCA}: ir al inicio`} style={{ display: "inline-flex", width: "fit-content" }}>
            <Logo size="lg" wordColor="#fff" />
          </Link>

          <div key={p.flujo} className="pgo-acc-entra">
            <p className="pgo-acc-marca-titulo" aria-hidden="true">{m.t}</p>
            <p className="pgo-acc-marca-texto">{m.x}</p>
            {p.flujo === "registro" ? (
              <ol className="pgo-acc-ruta" aria-label="Pasos para crear tu cuenta">
                {T.registro.pasos.map((s, i) => {
                  const e = i < p.paso ? "hecho" : i === p.paso ? "actual" : "pendiente";
                  return (
                    <li key={s.titulo} data-estado={e} aria-current={e === "actual" ? "step" : undefined}>
                      <span className="pgo-acc-marcador">{e === "hecho" ? <Check aria-hidden="true" /> : i + 1}</span>
                      <div><strong>{s.titulo}</strong><span>{s.detalle}</span></div>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>

          <div className="pgo-acc-marca-pie">
            <Confianza />
          </div>
        </aside>

        <main className="pgo-acc-form-lado">
          <div className="pgo-acc-toggle"><ThemeToggle /></div>
          <Link href="/" className="pgo-acc-logo-movil" aria-label={`${MARCA}: ir al inicio`}>
            <Logo size="md" wordColor="var(--pgo-text-1)" />
          </Link>
          <div className="pgo-acc-card" data-estado={estado} style={{ "--acc-ancho": "460px" } as CSSProperties}>
            <PanelAnimado clave={p.flujo} direccion={dir}>
              <Flujos p={p} onEstado={setEstado} progreso="movil" />
            </PanelAnimado>
          </div>
          <Pie />
        </main>
      </div>
    </div>
  );
}

/* ═════ C — Cabecera narrativa ═════ */

const SALUDOS: Record<Flujo, { t: (h: string) => string; x: string }> = {
  login: { t: (h) => h, x: "Tus arriendos te esperan." },
  recuperar: { t: () => "Recupera tu acceso.", x: "Le pasa a todos. Te enviamos un enlace al correo." },
  registro: { t: () => "Empieza con tu primera propiedad.", x: "Gratis, sin tarjeta, y listo en unos minutos." },
};

export function EstructuraNarrativa(p: PropsEstructura) {
  const [estado, setEstado] = useState<EstadoCard>("reposo");
  const dir = useDireccion(p.flujo);
  const saludo = useSaludo();
  const s = SALUDOS[p.flujo];

  return (
    <div className="pgo-acc">
      <Fondo />
      <div className="pgo-acc-pagina" style={{ gridTemplateRows: "auto 1fr auto" }}>
        <Barra />
        <main className="pgo-acc-columna">
          <div key={p.flujo} className="pgo-acc-entra">
            <h1 className="pgo-acc-saludo">{s.t(saludo)}</h1>
            <p className="pgo-acc-saludo-sub">{s.x}</p>
          </div>
          <div className="pgo-acc-hoja" data-estado={estado}>
            <PanelAnimado clave={p.flujo} direccion={dir}>
              <Flujos p={p} onEstado={setEstado} modoRegistro="pagina" sinTitulo />
            </PanelAnimado>
          </div>
          <Confianza />
        </main>
        <Pie />
      </div>
    </div>
  );
}

/* ═════ D — Escena animada del producto ═════ */

export function EstructuraEscena(p: PropsEstructura) {
  const [estado, setEstado] = useState<EstadoCard>("reposo");
  const dir = useDireccion(p.flujo);

  return (
    <div className="pgo-acc">
      <Fondo />
      <div className="pgo-acc-escena-grid">
        <div className="pgo-acc-escena-form">
          <Barra />
          <div className="pgo-acc-card" data-estado={estado} style={{ "--acc-ancho": "440px" } as CSSProperties}>
            <PanelAnimado clave={p.flujo} direccion={dir}>
              <Flujos p={p} onEstado={setEstado} progreso="dentro" />
            </PanelAnimado>
          </div>
          <Confianza />
          <Pie />
        </div>

        <aside className="pgo-acc-escena" aria-label="Así se ve un mes de arriendo en Propigo">
          <div>
            <h2 className="pgo-acc-escena-titulo">Un mes de arriendo, de principio a fin.</h2>
            <p className="pgo-acc-escena-texto">
              Propigo detecta el pago, aplica el reajuste del IPC y deja el comprobante listo para rendirle al propietario.
            </p>
            <span className="pgo-acc-ejemplo"><Wallet className="h-3.5 w-3.5" aria-hidden="true" />Ejemplo con datos ficticios</span>
          </div>
          <EscenaProducto />
        </aside>
      </div>
    </div>
  );
}

export const ESTRUCTURAS: { id: string; nombre: string; Componente: (p: PropsEstructura) => ReactNode }[] = [
  { id: "tabs", nombre: "A · Pestañas", Componente: EstructuraTabs },
  { id: "guiada", nombre: "B · Guiado", Componente: EstructuraGuiada },
  { id: "narrativa", nombre: "C · Narrativa", Componente: EstructuraNarrativa },
  { id: "escena", nombre: "D · Escena", Componente: EstructuraEscena },
];
