"use client";

import { useActionState }  from "react";
import Link                from "next/link";
import { Mail, Send, AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";
import { recuperarAction } from "./actions";
import { Spinner } from "@/components/ui/spinner";

export function RecuperarForm() {
  const [state, formAction, pending] = useActionState(recuperarAction, null);

  const inputStyle: React.CSSProperties = {
    height:       "44px",
    width:        "100%",
    borderRadius: "12px",
    border:       "1px solid var(--pgo-border-2)",
    background:   "var(--pgo-glass-input)",
    color:        "var(--pgo-text-1)",
    fontSize:     "14px",
    padding:      "0 14px 0 40px",
    outline:      "none",
    boxShadow:    "var(--pgo-input-shadow)",
    transition:   "border-color 150ms ease, box-shadow 150ms ease",
    opacity:      pending ? 0.6 : 1,
  };

  // Estado de éxito: mostrar aviso genérico (anti-enumeración)
  if (state && "sent" in state) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3 px-2 py-4 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--pgo-success-lt)" }}
          >
            <CheckCircle2 className="h-6 w-6" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold" style={{ color: "var(--pgo-text-1)" }}>
              Revisa tu correo
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--pgo-text-3)" }}>
              Si el correo ingresado coincide con una cuenta activa, recibirás un enlace de recuperación en los próximos minutos.
            </p>
            <p className="mt-3 text-xs" style={{ color: "var(--pgo-text-4)" }}>
              El enlace es válido por 15 minutos y se puede usar una sola vez.
            </p>
          </div>
        </div>
        <div className="flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full text-sm font-medium transition-opacity hover:opacity-75"
            style={{
              color:      "var(--pgo-text-1)",
              background: "var(--pgo-surface)",
              border:     "1px solid var(--pgo-border-2)",
              boxShadow:  "0 1px 4px rgba(15,31,53,0.08)",
              padding:    "7px 16px 7px 10px",
            }}
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--pgo-primary)" }} aria-hidden />
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="rec-email" className="block text-sm font-semibold" style={{ color: "var(--pgo-text-2)" }}>
          Correo electrónico
        </label>
        <div className="relative">
          <Mail
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--pgo-text-4)" }}
            aria-hidden="true"
          />
          <input
            id="rec-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="correo@empresa.cl"
            disabled={pending}
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
        </div>
      </div>

      {/* Error */}
      {state && "error" in state && (
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
            Enviando enlace…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Enviar enlace de recuperación
          </>
        )}
      </button>

      <div className="flex justify-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full text-sm font-medium transition-opacity hover:opacity-75"
          style={{
            color:      "var(--pgo-text-1)",
            background: "var(--pgo-surface)",
            border:     "1px solid var(--pgo-border-2)",
            boxShadow:  "0 1px 4px rgba(15,31,53,0.08)",
            padding:    "7px 16px 7px 10px",
          }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "var(--pgo-primary)" }} aria-hidden />
          Volver a iniciar sesión
        </Link>
      </div>
    </form>
  );
}
