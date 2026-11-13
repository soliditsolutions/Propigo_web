import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Lock, FileText, Users } from "lucide-react";
import { RegistroForm } from "./registro-form";
import { PhotoBanner } from "@/components/public/PhotoBanner";
import bannerFamily from "@/images/banners/bannerFamily.png";
import { Logo } from "@/components/public/Logo";
import { CORREO, titulo } from "@/lib/marca";
import { registroAbierto } from "@/lib/registro-abierto";
import { PLAN_GRATUITO } from "@/lib/plans";

// Se decide en cada petición: sin esto Next prerenderiza la página en el build y
// REGISTRO_ABIERTO del servidor en marcha nunca se leería.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: titulo("Crear cuenta"),
};

/*
 * Cada punto nombra algo que el producto hace y que se puede comprobar. Los
 * textos anteriores eran folleto: "en un solo lugar", "automatizadas" sin decir
 * qué, y una afirmación directamente falsa —"cifrado de extremo a extremo"—
 * que este sistema no tiene ni puede tener, porque el servidor renderiza los
 * datos. Publicitar una protección inexistente no es solo mal copy: es
 * publicidad engañosa (Ley 19.496).
 */
const benefits = [
  { icon: Users,       text: "Tus propiedades, contratos y arrendatarios en un solo inventario" },
  { icon: FileText,    text: "El reajuste del IPC se aplica solo, en el aniversario de cada contrato" },
  { icon: Lock,        text: "Cada corredora ve únicamente sus datos, separados en la base" },
  { icon: ShieldCheck, text: "Consentimiento y trato de datos conforme a la Ley 21.719" },
];

export default function RegistroPage() {
  if (!registroAbierto()) {
    return (
      <main className="pgo-page-bg flex min-h-screen items-center justify-center px-4 py-10">
        <div className="pgo-auth-card w-full max-w-md space-y-4 rounded-2xl p-6 text-center sm:p-8">
          <Link href="/" className="inline-flex"><Logo size="md" wordColor="var(--pgo-text-1)" /></Link>
          <h1 className="text-xl font-bold" style={{ color: "var(--pgo-text-1)" }}>Aún no abrimos el registro</h1>
          <p className="text-sm" style={{ color: "var(--pgo-text-3)" }}>
            Estamos preparando el lanzamiento. Si eres corredora y quieres que te avisemos cuando esté listo,
            escríbenos a{" "}
            <a href={`mailto:${CORREO.soporte}`} className="underline">{CORREO.soporte}</a>.
          </p>
          <p className="text-sm" style={{ color: "var(--pgo-text-3)" }}>
            ¿Ya tienes cuenta? <Link href="/login" className="font-semibold underline">Inicia sesión</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--pgo-page)" }}>

      {/* Fondo aurora boreal a pantalla completa (decorativo) */}
      <div className="pgo-aurora-layer" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen">

      {/* ── Panel izquierdo — branding ── */}
      <aside
        className="pgo-auth-aside hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] shrink-0 p-10 relative overflow-hidden"
        aria-hidden="true"
      >
        <PhotoBanner src={bannerFamily} objectPosition="80% 40%" preload />

        <div className="relative z-10">
          <Link href="/" className="inline-flex transition-opacity hover:opacity-80">
            <Logo size="lg" wordColor="var(--pgo-sidebar-text)" />
          </Link>
          <p className="mt-1 text-sm" style={{ color: "var(--pgo-sidebar-muted)" }}>Panel del corredor</p>

          <div className="mt-10 mb-8" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

          <h1 className="text-3xl font-bold leading-snug tracking-tight" style={{ color: "var(--pgo-sidebar-text)" }}>
            Empieza gratis,{" "}
            <span className="pgo-sidebar-headline-accent">sin tarjeta.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--pgo-sidebar-muted)" }}>
            No pedimos tarjeta para empezar. Puedes cambiar de plan o cerrar la cuenta cuando quieras.
          </p>

          <ul className="mt-8 space-y-4">
            {benefits.map((b) => (
              <li key={b.text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.10)" }}>
                  <b.icon className="h-3.5 w-3.5" style={{ color: "var(--pgo-primary-bd)" }} />
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10">
          <div className="mb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pgo-success)" }} />
            Plan Gratuito · Sin tarjeta de crédito · Cancela cuando quieras
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
              Crea tu cuenta
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>
              Comienza gratis — plan Gratuito, sin tarjeta de crédito.
            </p>
            <ul className="mt-3 space-y-1 text-xs" style={{ color: "var(--pgo-text-3)" }}>
              {PLAN_GRATUITO.features.map((f) => (
                <li key={f.text} className="flex items-start gap-2">
                  <span aria-hidden="true" style={{ color: "var(--pgo-success)" }}>✓</span>
                  {f.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="pgo-auth-card p-6">
            <RegistroForm />
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
