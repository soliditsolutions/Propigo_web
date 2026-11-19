"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Aviso, Boton, Campo, formatoReloj } from "@/components/acceso/campos";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { T } from "@/components/acceso/textos";

const IS_DEV = process.env.NODE_ENV === "development";
/** Debe coincidir con /api/auth/dispositivo/enviar (1 envío por minuto). */
export const ESPERA_REENVIO_S = 60;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 min — debe coincidir con el backend
const MAX_INTENTOS = 3;

type OtpMode = "NORMAL" | "EXPIRADO" | "AGOTADO";

/** Oculta el correo dejando las dos primeras letras y el dominio. */
export function enmascararCorreo(email: string): string {
  return email.replace(/(.{2}).+(@.+)/, "$1***$2");
}

function BotonReenviar({ cooldown, enviando, onClick, etiqueta, variante = "secundario" }: {
  cooldown: number; enviando: boolean; onClick: () => void; etiqueta: string; variante?: "primario" | "secundario";
}) {
  return (
    <Boton variante={variante} chico={variante === "secundario"} bloque={variante === "primario"}
      cargando={enviando} disabled={cooldown > 0} onClick={onClick}>
      {enviando ? T.verificar.enviando : cooldown > 0 ? (
        <>{T.verificar.reenviarEn} <span className="pgo-acc-contador">{formatoReloj(cooldown)}</span></>
      ) : etiqueta}
    </Boton>
  );
}

export default function VerificarForm({ email }: { email: string }) {
  const router = useRouter();
  const { show: toast } = useToast();

  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [enviado, setEnviado] = useState(false);
  const [saliendo, setSaliendo] = useState(false);

  const [mode, setMode] = useState<OtpMode>("NORMAL");
  const [intentosRestantes, setIntentosRestantes] = useState(MAX_INTENTOS);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [expirySecsLeft, setExpirySecsLeft] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Enviar el código al montar. Guardia contra doble invocación (React Strict Mode
  // remonta una vez en desarrollo): dos POST casi simultáneos a /enviar podían
  // dejar dos códigos válidos y /confirmar comparar contra el que no llegó.
  const enviadoAlMontar = useRef(false);
  useEffect(() => {
    if (enviadoAlMontar.current) return;
    enviadoAlMontar.current = true;
    enviarCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuenta regresiva del reenvío
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Cuenta regresiva del vencimiento del código
  useEffect(() => {
    if (!codeExpiresAt) return;
    const tick = () => {
      const left = Math.floor((codeExpiresAt - Date.now()) / 1000);
      if (left <= 0) {
        setExpirySecsLeft(0);
        // Solo pasa a EXPIRADO desde NORMAL (no pisa AGOTADO)
        setMode((m) => (m === "NORMAL" ? "EXPIRADO" : m));
      } else {
        setExpirySecsLeft(left);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [codeExpiresAt]);

  async function enviarCodigo() {
    if (enviando || cooldown > 0) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dispositivo/enviar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 429 = esperar (advertencia, con la cuenta regresiva del servidor);
        // cualquier otro fallo es un error y se puede reintentar enseguida.
        if (res.status === 429) {
          setCooldown(typeof data.cooldownSec === "number" ? data.cooldownSec : ESPERA_REENVIO_S);
          toast(data.error ?? "Espera un momento antes de pedir otro código.", "warning");
        } else {
          toast(data.error ?? "No pudimos enviar el código. Inténtalo de nuevo.", "error");
        }
        return;
      }
      setEnviado(true);
      setCooldown(ESPERA_REENVIO_S);
      setMode("NORMAL");
      setIntentosRestantes(MAX_INTENTOS);
      setCodeExpiresAt(Date.now() + CODE_TTL_MS);
      setCodigo("");
      inputRef.current?.focus();
    } catch {
      toast("Error de red. Verifica tu conexión.", "error");
    } finally {
      setEnviando(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(codigo)) {
      setError(T.verificar.incompleto);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dispositivo/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorCode = data.errorCode as string | undefined;
        setCodigo("");
        if (errorCode === "EXPIRADO") {
          setMode("EXPIRADO");
        } else if (errorCode === "AGOTADO") {
          setMode("AGOTADO");
        } else if (errorCode === "INCORRECTO") {
          if (typeof data.intentosRestantes === "number") setIntentosRestantes(data.intentosRestantes);
          setError(T.verificar.incorrecto);
          inputRef.current?.focus();
        } else {
          setError(data.error ?? "No pudimos verificar el código. Inténtalo de nuevo.");
        }
        return;
      }

      router.push("/panel");
    } catch {
      toast("Error de red. Verifica tu conexión.", "error");
    } finally {
      setCargando(false);
    }
  }

  async function salir() {
    setSaliendo(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* red */ }
    // router.replace y no una recarga completa: /login se pide de nuevo al servidor.
    router.replace("/login");
  }

  const sub = enviado ? (
    <>{T.verificar.subAntes} <strong>{enmascararCorreo(email)}</strong>.</>
  ) : enviando ? T.verificar.subEnviando : T.verificar.subEspera;

  return (
    <MarcoGuiado flujo="verificar">
      <div className="pgo-acc-cuerpo">
        <div className="pgo-acc-sello pgo-acc-sello--info"><ShieldCheck aria-hidden="true" /></div>
        <hgroup className="pgo-acc-cabecera">
          <h1 className="pgo-acc-titulo">{T.verificar.titulo}</h1>
          <p className="pgo-acc-sub" aria-live="polite">{sub}</p>
        </hgroup>

        {mode === "NORMAL" ? (
          <form onSubmit={handleSubmit} className="pgo-acc-cuerpo" noValidate>
            <Campo
              ref={inputRef}
              id="codigo" etiqueta={T.verificar.codigo} icono={KeyRound} codigo
              inputMode="numeric" pattern="\d{6}" maxLength={6} autoComplete="one-time-code" placeholder="000000"
              value={codigo} disabled={cargando} error={error}
              ayuda={enviado && expirySecsLeft ? `${T.verificar.venceEn} ${formatoReloj(expirySecsLeft)}.` : undefined}
              onChange={(e) => {
                setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6));
                if (error) setError(null);
              }}
            />
            {intentosRestantes < MAX_INTENTOS ? (
              <Aviso variante="pausa" titulo={T.verificar.quedanTitulo(intentosRestantes)}>
                <p className="pgo-acc-aviso-p">{T.verificar.quedanTexto}</p>
              </Aviso>
            ) : null}
            <Boton type="submit" bloque cargando={cargando} disabled={codigo.length < 6}>
              {cargando ? T.verificar.ctaCargando : T.verificar.cta}
            </Boton>
            <div style={{ justifySelf: "center" }}>
              <BotonReenviar cooldown={cooldown} enviando={enviando} onClick={enviarCodigo} etiqueta={T.verificar.reenviar} />
            </div>
          </form>
        ) : (
          <>
            <Aviso
              variante="error"
              titulo={mode === "EXPIRADO" ? T.verificar.vencidoTitulo : T.verificar.agotadoTitulo}
            >
              <p className="pgo-acc-aviso-p">{mode === "EXPIRADO" ? T.verificar.vencidoTexto : T.verificar.agotadoTexto}</p>
            </Aviso>
            <BotonReenviar cooldown={cooldown} enviando={enviando} onClick={enviarCodigo}
              etiqueta={T.verificar.pedirNuevo} variante="primario" />
          </>
        )}

        {IS_DEV ? (
          <Aviso variante="info" titulo={T.verificar.devTitulo}>
            <p className="pgo-acc-aviso-p">{T.verificar.devTexto}</p>
          </Aviso>
        ) : null}

        <div className="pgo-acc-salida">
          <p>{T.verificar.otraCuenta}</p>
          <button type="button" className="pgo-acc-enlace pgo-acc-enlace--suave" onClick={salir} disabled={saliendo}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {saliendo ? T.verificar.saliendo : T.verificar.salir}
          </button>
        </div>
      </div>
    </MarcoGuiado>
  );
}
