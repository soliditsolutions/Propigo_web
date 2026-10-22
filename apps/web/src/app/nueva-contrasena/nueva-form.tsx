"use client";

import { useState }        from "react";
import { useActionState }  from "react";
import Link                from "next/link";
import { Eye, EyeOff, KeyRound, AlertCircle } from "lucide-react";
import { nuevaContrasenaAction } from "./actions";
import { Spinner }               from "@/components/ui/spinner";
import { PasswordStrengthMeter } from "@/components/ui/password-strength-meter";

export function NuevaContrasenaForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(nuevaContrasenaAction, null);
  const [showPwd, setShowPwd]        = useState(false);
  const [password, setPassword]      = useState("");

  const inputStyle: React.CSSProperties = {
    height:       "44px",
    width:        "100%",
    borderRadius: "12px",
    border:       "1px solid var(--pgo-border-2)",
    background:   "var(--pgo-glass-input)",
    color:        "var(--pgo-text-1)",
    fontSize:     "14px",
    padding:      "0 44px 0 14px",
    outline:      "none",
    boxShadow:    "var(--pgo-input-shadow)",
    transition:   "border-color 150ms ease, box-shadow 150ms ease",
    opacity:      pending ? 0.6 : 1,
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {/* Token oculto — no exponer en campos visibles */}
      <input type="hidden" name="token" value={token} />

      {/* Nueva contraseña */}
      <div className="space-y-1.5">
        <label htmlFor="nueva-pwd" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
          Nueva contraseña
        </label>
        <div className="relative">
          <input
            id="nueva-pwd"
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
              e.currentTarget.style.borderColor = "var(--pgo-primary)";
              e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow-focus)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--pgo-border-2)";
              e.currentTarget.style.boxShadow   = "var(--pgo-input-shadow)";
            }}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 hover:opacity-70 transition-opacity"
            style={{ color: "var(--pgo-text-4)" }}
          >
            {showPwd
              ? <EyeOff className="h-4 w-4" aria-hidden="true" />
              : <Eye    className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
        <PasswordStrengthMeter password={password} />
        <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
          Mínimo 8 caracteres, con letras, números y un carácter especial. Evita tu nombre o correo.
        </p>
      </div>

      {/* Error */}
      {state?.error && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          role="alert"
          style={{ background: "var(--pgo-danger-lt)", color: "var(--pgo-danger)", border: "1px solid var(--pgo-danger-bd)" }}
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {state.error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        className="pgo-btn-primary w-full justify-center"
        style={{ height: "46px", fontSize: "15px", borderRadius: "12px" }}
      >
        {pending ? (
          <>
            <Spinner />
            Guardando…
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Establecer nueva contraseña
          </>
        )}
      </button>

      <p className="text-center text-sm" style={{ color: "var(--pgo-text-3)" }}>
        <Link href="/login" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "var(--pgo-primary)" }}>
          ← Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
