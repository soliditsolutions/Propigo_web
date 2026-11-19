"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { nuevaContrasenaAction } from "./actions";
import { accionDeFormulario } from "@/lib/fallo-accion";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";
import { Aviso, Boton, CampoClave } from "@/components/acceso/campos";
import { T } from "@/components/acceso/textos";

// Un fallo de red o del servidor vuelve como { error } y no rompe la página.
const accionSegura = accionDeFormulario(nuevaContrasenaAction);

function Volver() {
  return (
    <Link href="/login" className="pgo-acc-enlace pgo-acc-enlace--suave" style={{ justifySelf: "center" }}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {T.recuperar.volver}
    </Link>
  );
}

/** El enlace venció, ya se usó o llegó sin token: se explica y se ofrece otro. */
export function EnlaceInvalido({ mensaje }: { mensaje: string }) {
  return (
    <div className="pgo-acc-cuerpo">
      <div className="pgo-acc-sello pgo-acc-sello--error"><ShieldAlert aria-hidden="true" /></div>
      <hgroup className="pgo-acc-cabecera">
        <h1 className="pgo-acc-titulo">{T.nueva.invalidaTitulo}</h1>
        <p className="pgo-acc-sub">{mensaje}</p>
      </hgroup>
      <Link href="/recuperar-contrasena" className="pgo-acc-btn pgo-acc-btn--primario pgo-acc-btn--bloque">
        {T.nueva.pedirOtro}
      </Link>
      <Volver />
    </div>
  );
}

export function NuevaContrasenaForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(accionSegura, null);
  // Controlado: React 19 limpia los inputs no controlados al terminar la acción (M-03).
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="pgo-acc-cuerpo" noValidate>
      <input type="hidden" name="token" value={token} />
      <hgroup className="pgo-acc-cabecera">
        <h1 className="pgo-acc-titulo">{T.nueva.titulo}</h1>
        <p className="pgo-acc-sub">{T.nueva.sub}</p>
      </hgroup>

      <div className="pgo-acc-campo">
        <CampoClave
          id="nueva-pwd" etiqueta={T.nueva.clave} icono={Lock}
          name="password" autoComplete="new-password" required placeholder={T.nueva.clavePlaceholder}
          ayuda={T.registro.claveAyuda}
          value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending}
        />
        <div aria-live="polite" aria-atomic="true">
          <PasswordStrengthMeter password={password} />
        </div>
      </div>

      {state?.error ? <Aviso variante="error">{state.error}</Aviso> : null}

      <Boton type="submit" bloque cargando={pending}>
        {pending ? T.nueva.ctaCargando : T.nueva.cta}
      </Boton>
      <Volver />
    </form>
  );
}
