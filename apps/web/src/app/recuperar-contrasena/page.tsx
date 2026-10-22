import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, KeyRound } from "lucide-react";
import { RecuperarForm } from "./recuperar-form";
import { Logo } from "@/components/public/Logo";
import { titulo } from "@/lib/marca";

export const metadata: Metadata = {
  title: titulo("Recuperar contraseña"),
};

export default function RecuperarContrasenaPage() {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--pgo-page)" }}>

      {/* Fondo aurora boreal a pantalla completa (decorativo) */}
      <div className="pgo-aurora-layer" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen">

      {/* ── Panel izquierdo — branding ── */}
      <aside
        className="pgo-auth-aside hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] shrink-0 p-10"
        aria-hidden="true"
      >
        <div>
          <Link href="/" className="inline-flex transition-opacity hover:opacity-80">
            <Logo size="lg" wordColor="var(--pgo-sidebar-text)" />
          </Link>
          <p className="mt-1 text-sm" style={{ color: "var(--pgo-sidebar-muted)" }}>Panel del corredor</p>

          <div className="mt-10 mb-8" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-6" style={{ background: "rgba(255,255,255,0.10)" }}>
            <KeyRound className="h-7 w-7" style={{ color: "var(--pgo-primary-bd)" }} />
          </div>

          <h1 className="text-3xl font-bold leading-snug tracking-tight" style={{ color: "var(--pgo-sidebar-text)" }}>
            Recupera el acceso{" "}
            <span style={{ color: "var(--pgo-primary-bd)" }}>a tu cuenta.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--pgo-sidebar-muted)" }}>
            Te enviaremos un enlace de un solo uso, válido por 15 minutos, para que definas una nueva contraseña.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Enlace generado con entropía criptográfica de 256 bits",
              "El enlace expira en 15 minutos y solo se puede usar una vez",
              "No se bloquea tu cuenta al solicitar la recuperación",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.10)" }}>
                  <span style={{ color: "var(--pgo-success)", fontSize: "10px" }}>✓</span>
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}>
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pgo-success)" }} />
            Ley 21.719 · Protección de datos personales · Chile
          </div>
        </div>
      </aside>

      {/* ── Panel derecho — formulario ── */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <Link href="/" className="mb-8 inline-flex lg:hidden transition-opacity hover:opacity-70">
            <Logo size="md" wordColor="var(--pgo-text-1)" />
          </Link>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--pgo-text-1)" }}>
              Recuperar contraseña
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>
              Ingresa tu correo y te enviaremos un enlace de recuperación.
            </p>
          </div>

          <div className="pgo-auth-card p-6">
            <RecuperarForm />
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
