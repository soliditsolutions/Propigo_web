"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield, RotateCcw, ArrowRight, Loader2, LogOut, Terminal,
  Clock, AlertTriangle, XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

const IS_DEV          = process.env.NODE_ENV === "development";
const RESEND_COOLDOWN = 30;              // segundos por defecto entre reenvíos
const CODE_TTL_MS     = 10 * 60 * 1000; // 10 min — debe coincidir con el backend
const MAX_INTENTOS    = 3;

type OtpMode = "NORMAL" | "EXPIRADO" | "AGOTADO";

function formatTime(totalSec: number): string {
  if (totalSec <= 0) return "0s";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ExpiryClock({ secsLeft }: { secsLeft: number }) {
  const urgent = secsLeft <= 60;
  return (
    <div
      className="flex items-center justify-center gap-1.5 text-xs mt-1"
      style={{ color: urgent ? "var(--hw-danger)" : "var(--hw-text-3)" }}
    >
      <Clock className="h-3 w-3" aria-hidden />
      <span>Código válido por: <strong>{formatTime(secsLeft)}</strong></span>
    </div>
  );
}

function IntentosRestantesBadge({ restantes }: { restantes: number }) {
  if (restantes >= MAX_INTENTOS) return null;
  const color = restantes === 1 ? "var(--hw-danger)" : "var(--hw-warning)";
  return (
    <div
      className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs mt-1.5"
      style={{ background: restantes === 1 ? "var(--hw-danger-lt)" : "var(--hw-warning-lt)", color }}
      role="status"
      aria-live="polite"
    >
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
      <span>
        {restantes === 1
          ? "Último intento. Si falla, deberás solicitar un nuevo código."
          : `${restantes} intentos restantes antes de bloquear el código.`}
      </span>
    </div>
  );
}

function ReenviarButton({
  cooldown,
  enviando,
  onClick,
  label = "Reenviar código",
}: {
  cooldown: number;
  enviando: boolean;
  onClick:  () => void;
  label?:   string;
}) {
  const disabled = enviando || cooldown > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 text-sm transition-opacity disabled:opacity-40"
      style={{ color: "var(--hw-primary)" }}
    >
      {enviando ? (
        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando…</>
      ) : cooldown > 0 ? (
        <><Clock className="h-3.5 w-3.5" />{`Espera ${formatTime(cooldown)}`}</>
      ) : (
        <><RotateCcw className="h-3.5 w-3.5" />{label}</>
      )}
    </button>
  );
}

function CodigoExpiradoPanel({
  cooldown, enviando, onSolicitar,
}: { cooldown: number; enviando: boolean; onSolicitar: () => void }) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      role="alert"
      style={{ background: "var(--hw-warning-lt)", border: "1px solid var(--hw-warning-bd)" }}
    >
      <Clock className="mx-auto mb-2 h-6 w-6" style={{ color: "var(--hw-warning)" }} aria-hidden />
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--hw-warning-dk)" }}>
        Tu código expiró
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--hw-warning-dk)" }}>
        Los códigos son válidos por 10 minutos. Solicita uno nuevo para continuar.
      </p>
      <ReenviarButton
        cooldown={cooldown}
        enviando={enviando}
        onClick={onSolicitar}
        label="Solicitar nuevo código"
      />
    </div>
  );
}

function IntentosAgotadosPanel({
  cooldown, enviando, onSolicitar,
}: { cooldown: number; enviando: boolean; onSolicitar: () => void }) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      role="alert"
      style={{ background: "var(--hw-danger-lt)", border: "1px solid var(--hw-danger-bd)" }}
    >
      <XCircle className="mx-auto mb-2 h-6 w-6" style={{ color: "var(--hw-danger)" }} aria-hidden />
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--hw-danger-dk)" }}>
        Intentos agotados ({MAX_INTENTOS}/{MAX_INTENTOS})
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--hw-danger-dk)" }}>
        Has superado el máximo de {MAX_INTENTOS} intentos para este código.
        Solicita uno nuevo para continuar.
      </p>
      <ReenviarButton
        cooldown={cooldown}
        enviando={enviando}
        onClick={onSolicitar}
        label="Solicitar nuevo código"
      />
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function VerificarForm({
  email,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reservado para un saludo personalizado, no implementado aún
  nombre: _nombre,
}: {
  email: string;
  nombre: string;
}) {
  const router = useRouter();
  const { show: toast } = useToast();

  const [codigo, setCodigo]         = useState("");
  const [hasError, setHasError]     = useState(false);
  const [cargando, setCargando]     = useState(false);
  const [enviando, setEnviando]     = useState(false);
  const [cooldown, setCooldown]     = useState(0);
  const [enviado, setEnviado]       = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [mode, setMode]                           = useState<OtpMode>("NORMAL");
  const [intentosRestantes, setIntentosRestantes] = useState<number>(MAX_INTENTOS);
  const [codeExpiresAt, setCodeExpiresAt]         = useState<number | null>(null);
  const [expirySecsLeft, setExpirySecsLeft]       = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Enviar código automáticamente al montar. Guardia contra doble invocación
  // (p.ej. React Strict Mode en desarrollo remonta el componente una vez):
  // sin esto, dos POST a /enviar casi simultáneos pueden crear dos códigos
  // válidos a la vez para el mismo usuario — el usuario recibe por email
  // el más reciente, pero /confirmar puede terminar comparando contra el
  // otro si ambas filas quedan con el mismo timestamp de creación.
  const enviadoAlMontar = useRef(false);
  useEffect(() => {
    if (enviadoAlMontar.current) return;
    enviadoAlMontar.current = true;
    enviarCodigo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown de cooldown del botón "Reenviar"
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Countdown de expiración del código
  useEffect(() => {
    if (!codeExpiresAt) return;
    const tick = () => {
      const left = Math.floor((codeExpiresAt - Date.now()) / 1000);
      if (left <= 0) {
        setExpirySecsLeft(0);
        // Solo marcar EXPIRADO si seguimos en NORMAL (no sobreescribir AGOTADO)
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
    setHasError(false);
    try {
      const res  = await fetch("/api/auth/dispositivo/enviar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const sec = typeof data.cooldownSec === "number" ? data.cooldownSec : RESEND_COOLDOWN;
        setCooldown(sec);
        toast(data.error ?? "No pudimos enviar el código. Inténtalo de nuevo.", "warning");
        return;
      }
      setEnviado(true);
      setCooldown(RESEND_COOLDOWN);
      setMode("NORMAL");
      setIntentosRestantes(MAX_INTENTOS);
      setCodeExpiresAt(Date.now() + CODE_TTL_MS);
      setCodigo("");
      setHasError(false);
      inputRef.current?.focus();
    } catch {
      toast("Error de red. Verifica tu conexión.", "error");
    } finally {
      setEnviando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(codigo)) {
      setHasError(true);
      toast("Ingresa los 6 dígitos del código.", "error");
      return;
    }
    setCargando(true);
    setHasError(false);
    try {
      const res  = await fetch("/api/auth/dispositivo/confirmar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ codigo }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
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
          setHasError(true);
          toast(data.error ?? "Código incorrecto.", "error");
          setCodigo("");
          inputRef.current?.focus();
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

  async function handleLogout() {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* red */ }
    window.location.href = "/login";
  }

  const maskedEmail = email.replace(/(.{2}).+(@.+)/, "$1***$2");

  return (
    <div className="hw-auth-card w-full max-w-md p-8">
      {/* Icono */}
      <div className="mb-6 flex justify-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, var(--hw-primary-lt) 0%, var(--hw-primary-bd) 100%)" }}
        >
          <Shield className="h-8 w-8" style={{ color: "var(--hw-primary)" }} />
        </div>
      </div>

      {/* Título */}
      <h1 className="mb-2 text-center text-xl font-semibold" style={{ color: "var(--hw-text-1)" }}>
        Nuevo dispositivo detectado
      </h1>
      <p className="mb-6 text-center text-sm" style={{ color: "var(--hw-text-3)" }}>
        {enviado ? (
          <>
            Enviamos un código de 6 dígitos a{" "}
            <span className="font-medium" style={{ color: "var(--hw-text-1)" }}>{maskedEmail}</span>.
            Válido por 10 minutos.
          </>
        ) : enviando ? (
          "Enviando código a tu email…"
        ) : (
          "Verifica tu identidad para continuar."
        )}
      </p>

      {/* ── Panel EXPIRADO ── */}
      {mode === "EXPIRADO" && (
        <div className="mb-4">
          <CodigoExpiradoPanel
            cooldown={cooldown}
            enviando={enviando}
            onSolicitar={enviarCodigo}
          />
        </div>
      )}

      {/* ── Panel AGOTADO ── */}
      {mode === "AGOTADO" && (
        <div className="mb-4">
          <IntentosAgotadosPanel
            cooldown={cooldown}
            enviando={enviando}
            onSolicitar={enviarCodigo}
          />
        </div>
      )}

      {/* ── Formulario (solo en NORMAL) ── */}
      {mode === "NORMAL" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="codigo"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--hw-text-2)" }}
            >
              Código de verificación
            </label>
            <input
              ref={inputRef}
              id="codigo"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6));
                if (hasError) setHasError(false);
              }}
              placeholder="000000"
              disabled={cargando}
              autoComplete="one-time-code"
              className="w-full rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-[0.4em] outline-none transition-all"
              style={{
                background:    "var(--hw-surface-2)",
                border:        hasError ? "1.5px solid var(--hw-danger)" : "1.5px solid var(--hw-border-2)",
                color:         "var(--hw-text-1)",
                letterSpacing: "0.4em",
              }}
              onFocus={(e) => (e.currentTarget.style.border = "1.5px solid var(--hw-primary)")}
              onBlur={(e)  => (e.currentTarget.style.border = hasError
                ? "1.5px solid var(--hw-danger)"
                : "1.5px solid var(--hw-border-2)")}
            />

            <IntentosRestantesBadge restantes={intentosRestantes} />

            {enviado && expirySecsLeft !== null && expirySecsLeft > 0 && (
              <ExpiryClock secsLeft={expirySecsLeft} />
            )}

          </div>

          <button
            type="submit"
            disabled={cargando || codigo.length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--hw-primary)" }}
          >
            {cargando ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Verificando…</>
            ) : (
              <>Verificar dispositivo<ArrowRight className="h-4 w-4" /></>
            )}
          </button>
        </form>
      )}

      {/* Reenviar (solo en NORMAL) */}
      {mode === "NORMAL" && (
        <div className="mt-4 flex items-center justify-center">
          <ReenviarButton
            cooldown={cooldown}
            enviando={enviando}
            onClick={enviarCodigo}
          />
        </div>
      )}

      {/* Hint DEV */}
      {IS_DEV && (
        <div
          className="mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-xs"
          style={{ background: "var(--hw-success-lt)", border: "1px solid var(--hw-success-bd)", color: "var(--hw-success-dk)" }}
        >
          <Terminal className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>
            <strong>Modo desarrollo:</strong> el código de 6 dígitos aparece en la{" "}
            <strong>consola del servidor</strong> (terminal donde corre{" "}
            <code className="rounded bg-[var(--hw-success-lt)] px-1 font-mono">npm run dev</code>), no en tu email.
          </span>
        </div>
      )}

      {/* Cerrar sesión */}
      <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--hw-border)" }}>
        <p className="mb-3 text-center text-xs" style={{ color: "var(--hw-text-4)" }}>
          ¿No eres tú o quieres cambiar de cuenta?
        </p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            borderColor: loggingOut ? "var(--hw-border-2)" : "var(--hw-danger-bd)",
            background:  loggingOut ? "var(--hw-surface-2)"  : "var(--hw-danger-lt)",
            color:       loggingOut ? "var(--hw-text-4)"  : "var(--hw-danger)",
          }}
        >
          {loggingOut
            ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /><span>Cerrando sesión…</span></>
            : <><LogOut className="h-4 w-4" aria-hidden /><span>Cerrar sesión</span></>}
        </button>
      </div>
    </div>
  );
}
