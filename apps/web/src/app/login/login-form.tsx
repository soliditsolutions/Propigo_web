"use client";

import { useActionState, useEffect, useState } from "react";
import { Eye, EyeOff, LogIn, AlertTriangle, Lock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { loginAction } from "./actions";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return "0s";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Banner de advertencia progresiva — aparece desde el 2° intento fallido */
function WarningBanner({ attempts }: { attempts: number }) {
  // Texto que cambia según cuántos intentos quedan antes del bloqueo permanente
  const lines = [
    { label: "3° intento fallido", consequence: "espera de 5 minutos", done: attempts >= 3 },
    { label: "4° intento fallido", consequence: "espera de 1 hora",     done: attempts >= 4 },
    { label: "5° intento fallido", consequence: "cuenta bloqueada",      done: attempts >= 5 },
  ];

  return (
    <div
      role="alert"
      className="rounded-xl px-4 py-3 text-sm"
      style={{
        background: "var(--pgo-warning-lt)",
        border:     "1px solid var(--pgo-warning-bd)",
        color:      "var(--pgo-warning-dk)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--pgo-warning)" }} aria-hidden="true" />
        <div className="space-y-1.5 w-full">
          <p className="font-semibold" style={{ color: "var(--pgo-warning-dk)" }}>
            Atención — quedan {5 - attempts} intento{5 - attempts !== 1 ? "s" : ""} antes del bloqueo
          </p>
          <ul className="space-y-0.5">
            {lines.map(({ label, consequence, done }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-xs"
                style={{ opacity: done ? 0.45 : 1, textDecoration: done ? "line-through" : "none" }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                  style={{ background: "var(--pgo-warning)" }}
                  aria-hidden="true"
                />
                <span>
                  <strong>{label}</strong> → {consequence}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Panel de bloqueo temporal con countdown y enlace a recuperar contraseña */
function LockPanel({
  lockedUntil,
  attempts,
  onExpire,
}: {
  lockedUntil: number;
  attempts:    number;
  onExpire:    () => void;
}) {
  const [secsLeft, setSecsLeft] = useState(() =>
    Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)),
  );

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

  const is5min  = attempts === 3;
  const isWarned = attempts === 4; // próximo = bloqueo permanente

  return (
    <div
      role="alert"
      className="rounded-xl px-4 py-4 text-sm space-y-3"
      style={{
        background: is5min ? "var(--pgo-warning-lt)"  : "var(--pgo-danger-lt)",
        border:     is5min ? "1px solid var(--pgo-warning-bd)" : "1px solid var(--pgo-danger-bd)",
      }}
    >
      {/* Cabecera */}
      <div className="flex items-start gap-2.5">
        <Lock
          className="h-4 w-4 mt-0.5 shrink-0"
          style={{ color: is5min ? "var(--pgo-warning)" : "var(--pgo-danger)" }}
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold" style={{ color: is5min ? "var(--pgo-warning-dk)" : "var(--pgo-danger-dk)" }}>
            {is5min ? "Cuenta bloqueada por 5 minutos" : "Cuenta bloqueada por 1 hora"}
          </p>
          <p className="mt-0.5" style={{ color: is5min ? "var(--pgo-warning-dk)" : "var(--pgo-danger-dk)" }}>
            Demasiados intentos fallidos. Espera o cambia tu contraseña.
          </p>
        </div>
      </div>

      {/* Countdown */}
      {secsLeft > 0 && (
        <div
          className="flex items-center justify-center gap-2 rounded-lg py-2 font-mono text-lg font-bold tracking-widest"
          style={{
            background: is5min ? "var(--pgo-warning-lt)" : "var(--pgo-danger-lt)",
            color:      is5min ? "var(--pgo-warning)" : "var(--pgo-danger)",
          }}
          aria-live="polite"
          aria-label={`Tiempo restante: ${formatCountdown(secsLeft)}`}
        >
          <Lock className="h-4 w-4" aria-hidden="true" />
          {formatCountdown(secsLeft)}
        </div>
      )}

      {/* Enlace cambio de contraseña */}
      <p className="text-xs text-center" style={{ color: is5min ? "var(--pgo-warning-dk)" : "var(--pgo-danger-dk)" }}>
        ¿No quieres esperar?{" "}
        <Link
          href="/recuperar-contrasena"
          className="font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
          style={{ color: is5min ? "var(--pgo-warning)" : "var(--pgo-danger)" }}
        >
          Cambia tu contraseña ahora
        </Link>
      </p>

      {/* Aviso escalación (solo en bloqueo de 5min: siguiente es 1hr) */}
      {is5min && (
        <p className="text-xs text-center opacity-75" style={{ color: "var(--pgo-warning-dk)" }}>
          El siguiente intento fallido bloqueará tu cuenta por 1 hora.
        </p>
      )}

      {/* Aviso crítico (en bloqueo de 1hr: siguiente es permanente) */}
      {isWarned && (
        <p
          className="text-xs text-center font-semibold"
          style={{ color: "var(--pgo-danger-dk)" }}
        >
          ⚠️ El siguiente intento fallido bloqueará permanentemente tu cuenta.
        </p>
      )}
    </div>
  );
}

/** Panel de bloqueo permanente */
function BlockedPanel() {
  return (
    <div
      role="alert"
      className="rounded-xl px-4 py-4 text-sm space-y-3"
      style={{
        background: "var(--pgo-danger-lt)",
        border:     "1px solid var(--pgo-danger-bd)",
      }}
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--pgo-danger-dk)" }} aria-hidden="true" />
        <div>
          <p className="font-bold" style={{ color: "var(--pgo-danger-dk)" }}>
            Cuenta bloqueada por seguridad
          </p>
          <p className="mt-1 leading-relaxed" style={{ color: "var(--pgo-danger-dk)" }}>
            Detectamos demasiados intentos fallidos y bloqueamos tu cuenta para proteger
            tu información.
          </p>
        </div>
      </div>
      <Link
        href="/recuperar-contrasena"
        className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ background: "var(--pgo-danger)", color: "#fff" }}
      >
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        Solicitar cambio de contraseña
      </Link>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LoginForm({ resetSuccess = false }: { resetSuccess?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, null);
  const [showPwd, setShowPwd]        = useState(false);
  const [lockExpired, setLockExpired] = useState(false);
  const { show: toast } = useToast();

  // Resetear cuando llega un nuevo estado del servidor
  useEffect(() => { queueMicrotask(() => setLockExpired(false)); }, [state?.lockedUntil]);

  // Nota: los errores de autenticación NO se muestran como toast — cada caso
  // ya tiene su propio anuncio accesible inline (emailError/pwdError con
  // role="alert" + aria-describedby, o el WarningBanner/LockoutPanel). Un
  // toast adicional duplicaría el mismo mensaje con dos elementos
  // role="alert" simultáneos, rompiendo la asociación 1:1 que exige WCAG 4.1.2.

  // Mostrar éxito de reset de contraseña como toast
  useEffect(() => {
    if (resetSuccess) toast("Contraseña actualizada. Ya puedes iniciar sesión.", "success");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailError    = state?.field === "email" ? state.error : null;
  const isLocked      = !!state?.lockedUntil && !lockExpired;
  const isBlocked     = !!state?.blocked;
  const showLockUI    = isLocked || isBlocked;
  const attempts      = state?.attempts ?? 0;
  const showWarning   = !showLockUI && attempts >= 2;

  // Solo mostramos el error genérico de contraseña cuando NO hay panel de bloqueo
  const pwdError = !state?.field && state?.error && !showLockUI ? state.error : null;

  const formDisabled = pending || showLockUI;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Email */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-semibold"
          style={{ color: "var(--pgo-text-2)" }}
        >
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="correo@empresa.cl"
          disabled={formDisabled}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          style={{
            height:      "44px",
            width:       "100%",
            borderRadius:"12px",
            border:      `1px solid ${emailError ? "var(--pgo-danger)" : "var(--pgo-border-2)"}`,
            background:  "var(--pgo-glass-input)",
            color:       "var(--pgo-text-1)",
            fontSize:    "14px",
            padding:     "0 14px",
            outline:     "none",
            boxShadow:   "var(--pgo-input-shadow)",
            transition:  "border-color 150ms ease, box-shadow 150ms ease",
            opacity:     formDisabled ? 0.5 : 1,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--pgo-primary)";
            e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow-focus)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = emailError ? "var(--pgo-danger)" : "var(--pgo-border-2)";
            e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow)";
          }}
        />
        {emailError && (
          <p id="email-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
            {emailError}
          </p>
        )}
      </div>

      {/* Contraseña */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-semibold"
            style={{ color: "var(--pgo-text-2)" }}
          >
            Contraseña
          </label>
          <Link
            href="/recuperar-contrasena"
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--pgo-primary)" }}
          >
            ¿Olvidaste la contraseña?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPwd ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            disabled={formDisabled}
            aria-invalid={pwdError ? true : undefined}
            aria-describedby={pwdError ? "pwd-error" : undefined}
            style={{
              height:      "44px",
              width:       "100%",
              borderRadius:"12px",
              border:      `1px solid ${pwdError ? "var(--pgo-danger)" : "var(--pgo-border-2)"}`,
              background:  "var(--pgo-surface)",
              color:       "var(--pgo-text-1)",
              fontSize:    "14px",
              padding:     "0 44px 0 14px",
              outline:     "none",
              boxShadow:   "var(--pgo-input-shadow)",
              transition:  "border-color 150ms ease, box-shadow 150ms ease",
              opacity:     formDisabled ? 0.5 : 1,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--pgo-primary)";
              e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow-focus)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = pwdError ? "var(--pgo-danger)" : "var(--pgo-border-2)";
              e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow)";
            }}
          />
          <button
            type="button"
            onClick={() => setShowPwd(!showPwd)}
            aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="pgo-tap-target absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:opacity-70 transition-opacity"
            style={{ color: "var(--pgo-text-4)" }}
          >
            {showPwd
              ? <EyeOff className="h-4 w-4" aria-hidden="true" />
              : <Eye    className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        {pwdError && (
          <p id="pwd-error" role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>
            {pwdError}
          </p>
        )}
      </div>

      {/* ── Paneles de estado de seguridad ─────────────────────────────── */}

      {/* Advertencia progresiva (2° intento en adelante, sin bloqueo activo) */}
      {showWarning && <WarningBanner attempts={attempts} />}

      {/* Bloqueo temporal (3° o 4° intento) */}
      {isLocked && state?.lockedUntil && (
        <LockPanel
          lockedUntil={state.lockedUntil}
          attempts={attempts}
          onExpire={() => setLockExpired(true)}
        />
      )}

      {/* Bloqueo permanente (5° intento) */}
      {isBlocked && <BlockedPanel />}

      {/* Submit */}
      <button
        type="submit"
        disabled={formDisabled}
        className="pgo-btn-primary w-full justify-center"
        style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <Spinner />
            Verificando…
          </>
        ) : isBlocked ? (
          <>
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            Cuenta bloqueada
          </>
        ) : isLocked ? (
          <>
            <Lock className="h-4 w-4" aria-hidden="true" />
            Cuenta bloqueada temporalmente
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Iniciar sesión
          </>
        )}
      </button>
    </form>
  );
}
