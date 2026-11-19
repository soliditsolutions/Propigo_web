"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MailCheck } from "lucide-react";
import { recuperarAction } from "./actions";
import { accionDeFormulario } from "@/lib/fallo-accion";
import { Aviso, Boton, Campo, formatoReloj, useCuentaRegresiva } from "@/components/acceso/campos";
import { T } from "@/components/acceso/textos";

// Un fallo de red o del servidor vuelve como { error } y no rompe la página.
const accionSegura = accionDeFormulario(recuperarAction);

/** Espera antes de ofrecer otro enlace: evita reenvíos seguidos por impaciencia. */
const ESPERA_REENVIO_S = 45;

function Volver() {
  return (
    <Link href="/login" className="pgo-acc-enlace pgo-acc-enlace--suave" style={{ justifySelf: "center" }}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {T.recuperar.volver}
    </Link>
  );
}

/** Aviso genérico tras enviar (anti-enumeración) y opción de pedir otro enlace. */
function Enviado({ email, formAction, pending }: { email: string; formAction: (fd: FormData) => void; pending: boolean }) {
  const faltan = useCuentaRegresiva(ESPERA_REENVIO_S, true);
  return (
    <div className="pgo-acc-cuerpo pgo-acc-exito">
      <div className="pgo-acc-sello pgo-acc-sello--info"><MailCheck aria-hidden="true" /></div>
      {/* El contenido cambia sin navegar: se anuncia como estado */}
      <div role="status">
        <hgroup className="pgo-acc-cabecera">
          <h1 className="pgo-acc-titulo">{T.recuperar.enviadoTitulo}</h1>
          <p className="pgo-acc-sub">{T.recuperar.enviadoTexto}</p>
        </hgroup>
      </div>
      <form action={formAction} className="pgo-acc-reenvio">
        <input type="hidden" name="email" value={email} />
        <p className="pgo-acc-ayuda" style={{ margin: 0 }}>{T.recuperar.noLlego}</p>
        <Boton type="submit" variante="secundario" chico cargando={pending} disabled={faltan > 0}>
          {faltan > 0 ? (
            <>{T.recuperar.reenviarEn} <span className="pgo-acc-contador">{formatoReloj(faltan)}</span></>
          ) : T.recuperar.reenviar}
        </Boton>
      </form>
      <Volver />
    </div>
  );
}

export function RecuperarForm() {
  const [state, formAction, pending] = useActionState(accionSegura, null);
  // Controlado: React 19 limpia los inputs no controlados al terminar la acción (M-03).
  const [email, setEmail] = useState("");
  // Cada respuesta nueva reinicia la espera del reenvío (clave del panel).
  const [estadoVisto, setEstadoVisto] = useState(state);
  const [envios, setEnvios] = useState(0);
  if (state !== estadoVisto) {
    setEstadoVisto(state);
    setEnvios((n) => n + 1);
  }

  if (state && "sent" in state) {
    return <Enviado key={envios} email={email} formAction={formAction} pending={pending} />;
  }

  return (
    <form action={formAction} className="pgo-acc-cuerpo" noValidate>
      <hgroup className="pgo-acc-cabecera">
        <h1 className="pgo-acc-titulo">{T.recuperar.titulo}</h1>
        <p className="pgo-acc-sub">{T.recuperar.sub}</p>
      </hgroup>

      <Campo
        id="rec-email" etiqueta={T.login.correo} icono={Mail}
        name="email" type="email" autoComplete="email" inputMode="email" required
        placeholder={T.login.correoPlaceholder}
        value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending}
      />

      {state && "error" in state ? <Aviso variante="error">{state.error}</Aviso> : null}

      <Boton type="submit" bloque cargando={pending}>
        {pending ? T.recuperar.ctaCargando : T.recuperar.cta}
      </Boton>
      <Volver />
    </form>
  );
}
