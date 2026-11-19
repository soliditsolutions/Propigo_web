"use client";

import { useEffect, useState, useTransition, Suspense, type ChangeEvent, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, KeyRound } from "lucide-react";
import { Aviso, Boton, Campo, formatoReloj } from "@/components/acceso/campos";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { T } from "@/components/acceso/textos";

const CODE_TTL_MS  = 10 * 60 * 1000; // 10 min — debe coincidir con el backend
const MAX_INTENTOS = 3;

type OtpMode = "NORMAL" | "EXPIRADO" | "AGOTADO";

function Encabezado() {
  return (
    <hgroup className="pgo-acc-cabecera">
      <h1 className="pgo-acc-titulo">{T.portal.verificarTitulo}</h1>
      <p className="pgo-acc-sub">{T.portal.verificarSub}</p>
    </hgroup>
  );
}

function VolverAlPortal() {
  return (
    <Link href="/portal" className="pgo-acc-enlace pgo-acc-enlace--suave" style={{ justifySelf: "center" }}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {T.portal.otroCodigo}
    </Link>
  );
}

function VerificarOtpForm() {
  const router  = useRouter();
  const params  = useSearchParams();
  const otpId   = params.get("id") ?? "";

  const [codigo, setCodigo]                       = useState("");
  const [inputError, setInputError]               = useState<string | null>(null);
  const [exito, setExito]                         = useState(false);
  const [isPending, start]                        = useTransition();
  const [mode, setMode]                           = useState<OtpMode>("NORMAL");
  const [intentosRestantes, setIntentosRestantes] = useState<number>(MAX_INTENTOS);
  const [startedAt]                               = useState<number>(() => Date.now());
  const [expirySecsLeft, setExpirySecsLeft]       = useState<number>(Math.floor(CODE_TTL_MS / 1000));

  // Cuenta regresiva: aproximada al momento en que la persona recibió el código.
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.floor((CODE_TTL_MS - (Date.now() - startedAt)) / 1000));
      setExpirySecsLeft(left);
      if (left <= 0) setMode((m) => (m === "NORMAL" ? "EXPIRADO" : m));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6));
    setInputError(null);
  }

  // Un solo canal para el error: el mensaje bajo el campo (role="alert"). Repetirlo
  // en un toast dejaba a la vista, a la vez, avisos de intentos ya superados.
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (codigo.length !== 6) { setInputError("Ingresa los 6 dígitos del código."); return; }
    if (!otpId)               { setInputError("Enlace inválido. Vuelve a iniciar el proceso."); return; }

    start(async () => {
      try {
        const res  = await fetch("/api/portal/verificar-otp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ otpId, codigo }),
        });
        const data = await res.json().catch(() => null);
        if (!data) {
          // Sin cuerpo JSON: falló el servidor, no la red ni el código.
          setInputError("No pudimos verificar el código por un problema de nuestro lado. Intenta de nuevo en unos minutos.");
          return;
        }
        if (data.ok && data.redirectTo) {
          setExito(true);
          router.push(data.redirectTo);
          return;
        }
        const errorCode = data.errorCode as string | undefined;
        setCodigo("");
        if (errorCode === "EXPIRADO") {
          setMode("EXPIRADO");
        } else if (errorCode === "AGOTADO") {
          setMode("AGOTADO");
        } else {
          if (typeof data.intentosRestantes === "number") setIntentosRestantes(data.intentosRestantes);
          setInputError(data.error ?? "Código incorrecto o expirado.");
        }
      } catch {
        setInputError("Error de conexión. Intenta nuevamente.");
      }
    });
  }

  if (exito) {
    return (
      <div className="pgo-acc-cuerpo pgo-acc-exito" role="status">
        <div className="pgo-acc-sello"><Check aria-hidden="true" /></div>
        <hgroup className="pgo-acc-cabecera">
          <h1 className="pgo-acc-titulo">{T.portal.exitoTitulo}</h1>
          <p className="pgo-acc-sub">{T.portal.exitoTexto}</p>
        </hgroup>
      </div>
    );
  }

  if (mode === "EXPIRADO" || mode === "AGOTADO") {
    const vencido = mode === "EXPIRADO";
    return (
      <div className="pgo-acc-cuerpo">
        <Encabezado />
        <Aviso variante="error" titulo={vencido ? T.portal.vencidoTitulo : T.portal.agotadoTitulo}>
          <p className="pgo-acc-aviso-p">{vencido ? T.portal.vencidoTexto : T.portal.agotadoTexto}</p>
        </Aviso>
        <Link href="/portal" className="pgo-acc-btn pgo-acc-btn--primario pgo-acc-btn--bloque">
          {T.portal.pedirNuevo}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="pgo-acc-cuerpo" noValidate>
      <Encabezado />
      <Campo
        id="portal-otp" etiqueta={T.portal.codigo} icono={KeyRound} codigo
        inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6}
        value={codigo} onChange={handleChange} disabled={isPending} error={inputError}
        ayuda={expirySecsLeft > 0 ? `${T.portal.venceEn} ${formatoReloj(expirySecsLeft)}.` : undefined}
      />
      {intentosRestantes < MAX_INTENTOS && !inputError ? (
        <Aviso variante="pausa" titulo={T.verificar.quedanTitulo(intentosRestantes)}>
          <p className="pgo-acc-aviso-p">{T.verificar.quedanTexto}</p>
        </Aviso>
      ) : null}
      <Boton type="submit" bloque cargando={isPending} disabled={codigo.length !== 6}>
        {isPending ? T.portal.verificando : T.portal.verificarCta}
      </Boton>
      {/* Texto neutro a propósito: no confirma si el RUT existe ni si se envió
          un código (el tope por persona es silencioso para no permitir
          averiguar qué RUT están registrados). */}
      <p className="pgo-acc-ayuda" style={{ margin: 0, textAlign: "center" }}>{T.portal.noLlego}</p>
      <VolverAlPortal />
    </form>
  );
}

export default function VerificarPortalPage() {
  return (
    <MarcoGuiado flujo="portal">
      <Suspense fallback={<div className="pgo-acc-cuerpo"><Encabezado /></div>}>
        <VerificarOtpForm />
      </Suspense>
    </MarcoGuiado>
  );
}
