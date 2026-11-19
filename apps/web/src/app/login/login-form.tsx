"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Lock, Mail } from "lucide-react";
import { loginAction } from "./actions";
import { accionDeFormulario } from "@/lib/fallo-accion";
import { useToast } from "@/components/ui/toast";
import { Aviso, Boton, Campo, CampoClave } from "@/components/acceso/campos";
import { T } from "@/components/acceso/textos";

// Un fallo de red o del servidor vuelve como { error } y no rompe la página.
const accionSegura = accionDeFormulario(loginAction);

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return "0 s";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min ${String(s).padStart(2, "0")} s`;
  if (m > 0) return `${m} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

/** Advertencia progresiva: aparece desde el 2.º intento fallido. */
function Advertencia({ attempts }: { attempts: number }) {
  const quedan = 5 - attempts;
  const lineas = [
    { etiqueta: "3.er intento fallido", efecto: "espera de 5 minutos", hecho: attempts >= 3 },
    { etiqueta: "4.º intento fallido", efecto: "espera de 1 hora", hecho: attempts >= 4 },
    { etiqueta: "5.º intento fallido", efecto: "cuenta bloqueada", hecho: attempts >= 5 },
  ];
  return (
    <Aviso
      variante="pausa"
      alerta
      titulo={`Te ${quedan === 1 ? "queda 1 intento" : `quedan ${quedan} intentos`} antes del bloqueo`}
    >
      <ul className="pgo-acc-escala">
        {lineas.map((l) => (
          <li key={l.etiqueta} data-hecho={l.hecho || undefined}>
            <strong>{l.etiqueta}</strong>: {l.efecto}
          </li>
        ))}
      </ul>
    </Aviso>
  );
}

/** Pausa temporal (3.er o 4.º intento) con cuenta regresiva. */
function Pausa({ lockedUntil, attempts, onExpire }: { lockedUntil: number; attempts: number; onExpire: () => void }) {
  const [secsLeft, setSecsLeft] = useState(() => Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)));

  useEffect(() => {
    if (secsLeft <= 0) { onExpire(); return; }
    const id = setInterval(() => {
      setSecsLeft((s) => {
        if (s <= 1) { clearInterval(id); onExpire(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedUntil]);

  const es5min = attempts === 3;
  return (
    <Aviso
      variante={es5min ? "pausa" : "error"}
      alerta
      titulo={es5min ? "Tu cuenta queda en pausa 5 minutos" : "Tu cuenta queda en pausa 1 hora"}
    >
      <p className="pgo-acc-aviso-p">{T.login.pausaTexto}</p>
      {secsLeft > 0 ? (
        // role="timer": la cuenta no se anuncia cada segundo (aria-live off implícito).
        <p className="pgo-acc-aviso-p">
          {T.login.pausaFalta} <span role="timer" className="pgo-acc-contador">{formatCountdown(secsLeft)}</span>
        </p>
      ) : null}
      <p className="pgo-acc-aviso-p">
        <Link href="/recuperar-contrasena" className="pgo-acc-enlace">{T.login.crearClave}</Link>
      </p>
      {es5min ? (
        <p className="pgo-acc-aviso-p pgo-acc-aviso-nota">Si el próximo intento falla, la pausa será de 1 hora.</p>
      ) : (
        <p className="pgo-acc-aviso-p pgo-acc-aviso-nota">
          Si el próximo intento falla, bloqueamos la cuenta y tendrás que crear una contraseña nueva.
        </p>
      )}
    </Aviso>
  );
}

/** Bloqueo permanente (5.º intento). */
function Bloqueo() {
  return (
    <Aviso variante="error" titulo={T.login.bloqueoTitulo}>
      <p className="pgo-acc-aviso-p">{T.login.bloqueoTexto}</p>
      <Link href="/recuperar-contrasena" className="pgo-acc-btn pgo-acc-btn--primario pgo-acc-btn--chico" style={{ marginTop: 10 }}>
        {T.login.crearClave}
      </Link>
    </Aviso>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function LoginForm({ resetSuccess = false }: { resetSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(accionSegura, null);
  const [lockExpired, setLockExpired] = useState(false);
  const { show: toast } = useToast();

  // Campos controlados: React 19 limpia los inputs no controlados al terminar
  // la acción, y el usuario perdía el correo en cada intento (M-03). La
  // contraseña se vacía solo si el servidor la rechazó; ante un fallo de red
  // se conserva para reintentar.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [estadoVisto, setEstadoVisto] = useState(state);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    if (state?.credencialRechazada) setPassword("");
  }

  // Un estado nuevo del servidor reinicia el fin de la pausa.
  useEffect(() => { queueMicrotask(() => setLockExpired(false)); }, [state?.lockedUntil]);

  // Los errores de autenticación no van como toast: cada caso ya tiene su
  // anuncio accesible en línea, y un toast duplicaría el role="alert" (WCAG 4.1.2).
  useEffect(() => {
    if (resetSuccess) toast(T.login.resetOk, "success");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailError  = state?.field === "email" ? state.error : null;
  const isLocked    = !!state?.lockedUntil && !lockExpired;
  const isBlocked   = !!state?.blocked;
  const showLockUI  = isLocked || isBlocked;
  const attempts    = state?.attempts ?? 0;
  const showWarning = !showLockUI && attempts >= 2;
  // El error genérico de contraseña solo cuando no hay panel de bloqueo.
  const pwdError = !state?.field && state?.error && !showLockUI ? state.error : null;
  const formDisabled = pending || showLockUI;

  return (
    <form action={formAction} className="pgo-acc-cuerpo" noValidate>
      <hgroup className="pgo-acc-cabecera">
        <h1 className="pgo-acc-titulo">{T.login.titulo}</h1>
        <p className="pgo-acc-sub">{T.login.sub}</p>
      </hgroup>

      <Campo
        id="email" etiqueta={T.login.correo} icono={Mail}
        name="email" type="email" autoComplete="email" inputMode="email" required
        placeholder={T.login.correoPlaceholder}
        value={email} onChange={(e) => setEmail(e.target.value)}
        disabled={formDisabled} error={emailError}
      />
      <CampoClave
        id="password" etiqueta={T.login.clave} icono={Lock}
        name="password" autoComplete="current-password" required
        placeholder={T.login.clavePlaceholder}
        value={password} onChange={(e) => setPassword(e.target.value)}
        disabled={formDisabled} error={pwdError}
        derecha={<Link href="/recuperar-contrasena" className="pgo-acc-enlace">{T.login.olvido}</Link>}
      />

      {showWarning ? <Advertencia attempts={attempts} /> : null}
      {isLocked && state?.lockedUntil ? (
        <Pausa lockedUntil={state.lockedUntil} attempts={attempts} onExpire={() => setLockExpired(true)} />
      ) : null}
      {isBlocked ? <Bloqueo /> : null}

      <Boton type="submit" bloque cargando={pending} disabled={showLockUI}>
        {pending ? T.login.ctaCargando : isBlocked ? T.login.ctaBloqueada : isLocked ? T.login.ctaPausa : (
          <><KeyRound className="h-4 w-4" aria-hidden="true" />{T.login.cta}</>
        )}
      </Boton>

      <p className="pgo-acc-centrado">
        {T.login.primeraVez} <Link href="/registro" className="pgo-acc-enlace">{T.login.crear}</Link>
      </p>
      <p className="pgo-acc-ayuda pgo-acc-legal">
        {T.login.legalAntes} <Link href="/terminos-uso">{T.registro.terminos}</Link> {T.registro.y}{" "}
        <Link href="/privacidad">{T.registro.privacidad}</Link> {T.registro.leyFin}
      </p>
    </form>
  );
}
