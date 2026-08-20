"use client";

import { useState }        from "react";
import { useActionState }  from "react";
import Link                from "next/link";
import { Eye, EyeOff, KeyRound, AlertCircle } from "lucide-react";
import { aceptarInvitacionAction } from "./actions";
import { Spinner }                 from "@/components/ui/spinner";
import { PasswordStrengthMeter }   from "@/components/ui/password-strength-meter";

export function InvitacionForm({
  token, nombre, email,
}: {
  token: string; nombre?: string; email?: string;
}) {
  const [state, formAction, pending] = useActionState(aceptarInvitacionAction, null);
  const [showPwd, setShowPwd]        = useState(false);
  const [password, setPassword]      = useState("");

  const inputStyle: React.CSSProperties = {
    height:       "44px",
    width:        "100%",
    borderRadius: "12px",
    border:       "1px solid var(--hw-border-2)",
    background:   "var(--hw-glass-input)",
    color:        "var(--hw-text-1)",
    fontSize:     "14px",
    padding:      "0 44px 0 14px",
    outline:      "none",
    boxShadow:    "var(--hw-input-shadow)",
    transition:   "border-color 150ms ease, box-shadow 150ms ease",
    opacity:      pending ? 0.6 : 1,
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1.5">
        <label htmlFor="invitacion-pwd" className="block text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>
          Elige tu contraseña
        </label>
        <div className="relative">
          <input
            id="invitacion-pwd"
            name="password"
            type={showPwd ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder="••••••••••••••••"
            disabled={pending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--hw-primary)";
              e.currentTarget.style.boxShadow   = "var(--hw-input-shadow-focus)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--hw-border-2)";
              e.currentTarget.style.boxShadow   = "var(--hw-input-shadow)";
            }}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:opacity-70 transition-opacity"
            style={{ color: "var(--hw-text-4)" }}
          >
            {showPwd
              ? <EyeOff className="h-4 w-4" aria-hidden="true" />
              : <Eye    className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <PasswordStrengthMeter password={password} nombre={nombre} email={email} />
        <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
          Mínimo 8 caracteres, con letras, números y un carácter especial. Evita tu nombre o correo.
        </p>
      </div>

      {/* Consentimiento — Ley 21.719 Art. 4: NO premarcado */}
      <div className="flex items-start gap-3 pt-1">
        <input
          id="consent"
          name="consent"
          type="checkbox"
          value="1"
          required
          disabled={pending}
          className="mt-0.5 h-4 w-4 rounded shrink-0"
          style={{ accentColor: "var(--hw-primary)", cursor: "pointer" }}
        />
        <label htmlFor="consent" className="text-xs leading-relaxed cursor-pointer" style={{ color: "var(--hw-text-3)" }}>
          He leído y acepto los{" "}
          <Link href="/terminos-uso" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 font-medium" style={{ color: "var(--hw-primary)" }}>
            Términos de uso
          </Link>
          {" "}y la{" "}
          <Link href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80 font-medium" style={{ color: "var(--hw-primary)" }}>
            Política de privacidad
          </Link>
          {" "}conforme a la Ley 21.719.
        </label>
      </div>

      {state?.error && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          role="alert"
          style={{ background: "var(--hw-danger-lt)", color: "var(--hw-danger)", border: "1px solid var(--hw-danger-bd)" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="hw-btn-primary w-full justify-center"
        style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
      >
        {pending ? (
          <>
            <Spinner />
            Creando cuenta…
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Aceptar invitación
          </>
        )}
      </button>

      <p className="text-center text-sm" style={{ color: "var(--hw-text-3)" }}>
        <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "var(--hw-primary)" }}>
          ← Ya tengo una cuenta
        </Link>
      </p>
    </form>
  );
}
