"use client";

import { useActionState, useState, startTransition, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { aceptarInvitacionAction } from "./actions";
import { accionDeFormulario } from "@/lib/fallo-accion";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { Aviso, Boton, CampoClave } from "@/components/acceso/campos";
import { T } from "@/components/acceso/textos";

// Un fallo de red o del servidor vuelve como { error } y no rompe la página.
const accionSegura = accionDeFormulario(aceptarInvitacionAction);

function YaTengoCuenta() {
  return (
    <Link href="/login" className="pgo-acc-enlace pgo-acc-enlace--suave" style={{ justifySelf: "center" }}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {T.invitacion.yaTengo}
    </Link>
  );
}

/** La invitación venció, ya se usó o llegó sin token: se explica en la tarjeta. */
export function InvitacionInvalida({ mensaje }: { mensaje: string }) {
  return (
    <div className="pgo-acc-cuerpo">
      <div className="pgo-acc-sello pgo-acc-sello--error"><ShieldAlert aria-hidden="true" /></div>
      <hgroup className="pgo-acc-cabecera">
        <h1 className="pgo-acc-titulo">{T.invitacion.invalidaTitulo}</h1>
        <p className="pgo-acc-sub">{mensaje}</p>
      </hgroup>
      <Link href="/login" className="pgo-acc-btn pgo-acc-btn--primario pgo-acc-btn--bloque">
        {T.invitacion.irLogin}
      </Link>
    </div>
  );
}

export function InvitacionForm({
  token, nombre, email, empresa,
}: {
  token: string; nombre: string; email: string; empresa: string;
}) {
  const [state, formAction, pending] = useActionState(accionSegura, null);
  const [password, setPassword] = useState("");
  // Controlado y enviado sin `<form action>`: tras una acción, React 19 hace
  // form.reset() nativo y no restaura un checkbox controlado, así que un error
  // de red desmarcaría el consentimiento que el usuario ya dio.
  const [consent, setConsent] = useState(false);

  function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => formAction(datos));
  }

  return (
    <form onSubmit={enviar} className="pgo-acc-cuerpo" noValidate>
      <input type="hidden" name="token" value={token} />
      <hgroup className="pgo-acc-cabecera">
        <h1 className="pgo-acc-titulo">{T.invitacion.titulo}</h1>
        <p className="pgo-acc-sub">{T.invitacion.sub(empresa, email)}</p>
      </hgroup>

      <div className="pgo-acc-campo">
        <CampoClave
          id="invitacion-pwd" etiqueta={T.invitacion.clave} icono={Lock}
          name="password" autoComplete="new-password" required placeholder={T.invitacion.clavePlaceholder}
          ayuda={T.registro.claveAyuda}
          value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
        />
        <div aria-live="polite" aria-atomic="true">
          <PasswordStrengthMeter password={password} nombre={nombre} email={email} />
        </div>
      </div>

      {/* Consentimiento — Ley 21.719 Art. 4: nunca premarcado */}
      <label className="pgo-acc-check" htmlFor="consent">
        <input
          id="consent" name="consent" type="checkbox" value="1" required
          disabled={pending} checked={consent} onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {T.registro.consentTerminos}{" "}
          <Link href="/terminos-uso" target="_blank" rel="noopener noreferrer">{T.registro.terminos}</Link>
          {" "}{T.registro.y}{" "}
          <Link href="/privacidad" target="_blank" rel="noopener noreferrer">{T.registro.privacidad}</Link>
          {" "}{T.registro.leyFin}
        </span>
      </label>

      {state?.error ? <Aviso variante="error">{state.error}</Aviso> : null}

      <Boton type="submit" bloque cargando={pending}>
        {pending ? T.invitacion.ctaCargando : T.invitacion.cta}
      </Boton>
      <YaTengoCuenta />
    </form>
  );
}
