"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck, CheckCircle2, ArrowLeft,
  Clock, AlertTriangle, XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/public/Logo";

const CODE_TTL_MS  = 10 * 60 * 1000; // 10 min — debe coincidir con el backend
const MAX_INTENTOS = 3;

type OtpMode = "NORMAL" | "EXPIRADO" | "AGOTADO";

function formatTime(totalSec: number): string {
  if (totalSec <= 0) return "0s";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ExpiryClock({ secsLeft }: { secsLeft: number }) {
  const urgent = secsLeft <= 60;
  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      style={{ color: urgent ? "var(--pgo-danger)" : "var(--pf-text-muted)" }}
    >
      <Clock className="h-3 w-3 shrink-0" aria-hidden />
      <span>Código válido por: <strong>{formatTime(secsLeft)}</strong></span>
    </div>
  );
}

function IntentosRestantesBadge({ restantes }: { restantes: number }) {
  if (restantes >= MAX_INTENTOS) return null;
  return (
    <div
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
      style={{
        background: restantes === 1 ? "var(--pgo-danger-lt)" : "var(--pgo-warning-lt)",
        color:      restantes === 1 ? "var(--pgo-danger)"    : "var(--pgo-warning-dk)",
        border:     `1px solid ${restantes === 1 ? "var(--pgo-danger-bd)" : "var(--pgo-warning-bd)"}`,
      }}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
      <span>
        {restantes === 1
          ? "Último intento disponible."
          : `${restantes} intentos restantes.`}
      </span>
    </div>
  );
}

function PanelFinal({
  tipo,
}: { tipo: "EXPIRADO" | "AGOTADO" }) {
  const esExpirado = tipo === "EXPIRADO";
  return (
    <div
      className="space-y-4"
      role="alert"
    >
      <div
        className="flex flex-col items-center gap-2 rounded-xl p-4 text-center"
        style={{
          background: esExpirado ? "var(--pgo-warning-lt)" : "var(--pgo-danger-lt)",
          border:     `1px solid ${esExpirado ? "var(--pgo-warning-bd)" : "var(--pgo-danger-bd)"}`,
        }}
      >
        {esExpirado
          ? <Clock className="h-6 w-6" style={{ color: "var(--pgo-warning)" }} aria-hidden />
          : <XCircle className="h-6 w-6" style={{ color: "var(--pgo-danger)" }} aria-hidden />}
        <p className="text-sm font-semibold" style={{ color: esExpirado ? "var(--pgo-warning-dk)" : "var(--pgo-danger-dk)" }}>
          {esExpirado ? "Código expirado" : `Intentos agotados (${MAX_INTENTOS}/${MAX_INTENTOS})`}
        </p>
        <p className="text-xs" style={{ color: esExpirado ? "var(--pgo-warning-dk)" : "var(--pgo-danger-dk)" }}>
          {esExpirado
            ? "El código ya no es válido. Vuelve al portal para solicitar uno nuevo."
            : "Has superado el máximo de intentos. Vuelve al portal para solicitar un nuevo código."}
        </p>
      </div>

      <a
        href="/portal"
        className="pf-btn-primary flex w-full items-center justify-center gap-2"
        style={{ height: "46px", fontSize: "15px", borderRadius: "12px", textDecoration: "none" }}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Solicitar nuevo código
      </a>
    </div>
  );
}

// ── Formulario principal ──────────────────────────────────────────────────────

function VerificarOtpForm() {
  const router  = useRouter();
  const params  = useSearchParams();
  const otpId   = params.get("id") ?? "";
  const { show: toast } = useToast();

  const [codigo, setCodigo]                         = useState("");
  const [inputError, setInputError]                 = useState<string | null>(null);
  const [exito, setExito]                           = useState(false);
  const [isPending, start]                          = useTransition();
  const [mode, setMode]                             = useState<OtpMode>("NORMAL");
  const [intentosRestantes, setIntentosRestantes]   = useState<number>(MAX_INTENTOS);
  const [startedAt]                                 = useState<number>(() => Date.now());
  const [expirySecsLeft, setExpirySecsLeft]         = useState<number>(Math.floor(CODE_TTL_MS / 1000));

  // Countdown de expiración — aproximado al momento en que el usuario recibió el código.
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const left    = Math.max(0, Math.floor((CODE_TTL_MS - elapsed) / 1000));
      setExpirySecsLeft(left);
      if (left <= 0) {
        setMode((m) => m === "NORMAL" ? "EXPIRADO" : m);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
    setCodigo(v);
    setInputError(null);
  }

  // El toast es complementario (llamada de atención inmediata), no la única
  // fuente del mensaje: un mensaje persistente bajo el campo (role="alert")
  // asegura que el error siga visible/anunciado aunque el toast ya se haya
  // autodescartado, y que no dependa solo del cambio de color del borde.
  function showError(msg: string) {
    setInputError(msg);
    toast(msg, "error");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (codigo.length !== 6) { showError("Ingresa los 6 dígitos del código."); return; }
    if (!otpId)               { showError("Enlace inválido. Vuelve a iniciar el proceso."); return; }

    start(async () => {
      try {
        const res  = await fetch("/api/portal/verificar-otp", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ otpId, codigo }),
        });
        const data = await res.json();

        if (data.ok && data.redirectTo) {
          setExito(true);
          router.push(data.redirectTo);
          return;
        }

        const errorCode = data.errorCode as string | undefined;
        if (errorCode === "EXPIRADO") {
          setMode("EXPIRADO");
          setCodigo("");
        } else if (errorCode === "AGOTADO") {
          setMode("AGOTADO");
          setCodigo("");
        } else {
          if (typeof data.intentosRestantes === "number") {
            setIntentosRestantes(data.intentosRestantes);
          }
          showError(data.error ?? "Código incorrecto o expirado.");
          setCodigo("");
        }
      } catch {
        showError("Error de conexión. Intenta nuevamente.");
      }
    });
  }

  if (exito) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "rgba(34,197,94,0.12)" }}
        >
          <CheckCircle2 className="h-6 w-6" style={{ color: "var(--pgo-success)" }} />
        </div>
        <p className="font-semibold" style={{ color: "var(--pf-navy)" }}>Acceso verificado</p>
        <p className="text-sm" style={{ color: "var(--pf-text-muted)" }}>Redirigiendo a tu portal…</p>
      </div>
    );
  }

  if (mode === "EXPIRADO" || mode === "AGOTADO") {
    return <PanelFinal tipo={mode} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="portal-otp" className="block text-sm font-semibold" style={{ color: "var(--pf-navy)" }}>
          Código de 6 dígitos
        </label>
        <input
          id="portal-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          value={codigo}
          onChange={handleChange}
          disabled={isPending}
          aria-invalid={inputError ? true : undefined}
          aria-describedby={inputError ? "portal-otp-error" : undefined}
          style={{
            height:        "56px",
            width:         "100%",
            borderRadius:  "12px",
            border:        `1px solid ${inputError ? "var(--pgo-danger)" : "var(--pf-border-input)"}`,
            background:    "var(--pf-surface)",
            color:         "var(--pf-navy)",
            fontSize:      "28px",
            fontWeight:    700,
            textAlign:     "center",
            letterSpacing: "0.25em",
            padding:       "0 14px",
            outline:       "none",
            boxShadow:     "0 1px 3px rgba(10,37,64,0.06)",
            transition:    "border-color 150ms ease",
            opacity:       isPending ? 0.6 : 1,
          }}
          onFocus={(e) => {
            if (!inputError) {
              e.currentTarget.style.borderColor = "var(--pf-brand)";
              e.currentTarget.style.boxShadow   = "0 0 0 3px color-mix(in srgb, var(--pf-brand) 15%, transparent)";
            }
          }}
          onBlur={(e) => {
            if (!inputError) {
              e.currentTarget.style.borderColor = "var(--pf-border-input)";
              e.currentTarget.style.boxShadow   = "0 1px 3px rgba(10,37,64,0.06)";
            }
          }}
        />
        {inputError && (
          <p id="portal-otp-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
            {inputError}
          </p>
        )}

        {/* Fila de estado: intentos + countdown */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <IntentosRestantesBadge restantes={intentosRestantes} />
          {expirySecsLeft > 0 && (
            <ExpiryClock secsLeft={expirySecsLeft} />
          )}
          {intentosRestantes >= MAX_INTENTOS && expirySecsLeft <= 0 && (
            <p className="text-xs" style={{ color: "var(--pf-text-muted)" }}>
              Válido 10 min · Máx. {MAX_INTENTOS} intentos
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || codigo.length !== 6}
        className="pf-btn-primary w-full"
        style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
      >
        {isPending ? (
          <>
            <Spinner />
            Verificando…
          </>
        ) : (
          "Verificar código"
        )}
      </button>

      <div className="flex justify-center">
        <a
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--pgo-text-3)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Volver y solicitar nuevo código
        </a>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function VerificarPortalPage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(160deg, var(--pf-hero-1) 0%, var(--pf-hero-2) 45%, var(--pf-surface) 100%)" }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/marketplace" className="inline-flex">
            <Logo size="lg" />
          </Link>
          <p className="mt-1 text-sm" style={{ color: "var(--pf-text-muted)" }}>Portal de autoconsulta</p>
        </div>

        <div
          className="pf-card rounded-2xl p-7"
          style={{ boxShadow: "0 20px 60px rgba(10, 37, 64, 0.10)" }}
        >
          <h1 className="mb-1 text-xl font-bold" style={{ color: "var(--pf-navy)" }}>
            Verifica tu identidad
          </h1>
          <p className="mb-6 text-sm" style={{ color: "var(--pf-text-body)" }}>
            Ingresa el código de 6 dígitos que enviamos a tu correo registrado.
          </p>

          <Suspense fallback={<div className="h-40 animate-pulse rounded-xl" style={{ background: "var(--pf-brand-tint)" }} />}>
            <VerificarOtpForm />
          </Suspense>
        </div>

        <div className="mt-6 space-y-2 text-center">
          <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "var(--pf-text-muted)" }}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pf-success-check)" }} aria-hidden />
            Acceso seguro · Código de un solo uso · Ley 21.719
          </div>
          <Link href="/marketplace" className="block text-xs hover:underline" style={{ color: "var(--pf-text-muted)" }}>
            ← Volver al marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
