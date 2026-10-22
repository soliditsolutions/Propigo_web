import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ShieldCheck, FileText, Wallet } from "lucide-react";
import { LoginForm } from "./login-form";
import { PhotoBanner } from "@/components/public/PhotoBanner";
import loginHero from "@/images/backgrounds/001_Login.png";
import { Logo } from "@/components/public/Logo";
import { titulo } from "@/lib/marca";

export const metadata: Metadata = {
  title: titulo("Iniciar sesión"),
};

const features = [
  { icon: Building2,   text: "Tus propiedades y contratos en un solo inventario"        },
  { icon: Wallet,      text: "El calendario de pagos de cada contrato, mes a mes"       },
  { icon: FileText,    text: "Comprobantes y liquidaciones que no se pueden alterar"    },
  { icon: ShieldCheck, text: "Trato de datos conforme a la Ley 21.719"                  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;
  const resetSuccess = reset === "1";

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--pgo-page)" }}>

      {/* Fondo aurora boreal a pantalla completa (decorativo) */}
      <div className="pgo-aurora-layer" aria-hidden="true" />

      <div className="relative z-10 flex min-h-screen">

      {/* ── Panel izquierdo — branding (oculto en mobile) ── */}
      <aside
        className="pgo-auth-aside hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] shrink-0 p-10 relative overflow-hidden"
        aria-hidden="true"
      >
        {/* Foto como FONDO de toda la card izquierda (no un recuadro insertado).
            Imagen limpia generada a medida (ejecutiva entregando llaves a
            cliente) para el prompt de login. Tinte parejo (mismo criterio
            que el fondo original .pgo-auth-aside: navy semitransparente)
            para que TODO el texto encima siga siendo legible en cualquier
            punto de la foto. */}
        <PhotoBanner
          src={loginHero}
          objectPosition="center 42%"
          overlay="linear-gradient(165deg, color-mix(in srgb, var(--pgo-sidebar) 58%, transparent) 0%, color-mix(in srgb, var(--pgo-sidebar) 72%, transparent) 55%, color-mix(in srgb, var(--pgo-sidebar) 88%, transparent) 100%)"
          preload
        />
        {/* Parche puntual — el recorte del contenedor no alcanza a excluir el
            watermark del generador (esquina inferior derecha de la foto);
            se cubre con el mismo navy de la aside. */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: "radial-gradient(circle at 82% 78%, var(--pgo-sidebar) 0%, transparent 22%)" }}
        />

        {/* Logo — tabIndex={-1} porque el aside es aria-hidden (WCAG 1.3.1):
            elementos focusables dentro de aria-hidden deben ser no-alcanzables por teclado. */}
        <div className="relative z-10">
          <Link href="/" tabIndex={-1} className="inline-flex transition-opacity hover:opacity-80">
            <Logo size="lg" wordColor="var(--pgo-sidebar-text)" />
          </Link>
          <p className="mt-1 text-sm" style={{ color: "var(--pgo-sidebar-muted)" }}>
            Panel del corredor
          </p>

          {/* Separador */}
          <div className="mt-10 mb-8" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

          {/* Hero copy — FIX UI-C3: el h1 visible está en la sección del form
              (fuera del aside aria-hidden), así que aquí usamos p con estilos
              equivalentes para no duplicar el heading en el árbol de accesibilidad. */}
          <p
            className="text-3xl font-bold leading-snug tracking-tight"
            style={{ color: "var(--pgo-sidebar-text)" }}
          >
            La gestión de arriendos,{" "}
            <span className="pgo-sidebar-headline-accent">
              automática y sin errores.
            </span>
          </p>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--pgo-sidebar-muted)" }}>
            Detecta los pagos, aplica el reajuste del IPC y deja el respaldo
            listo para rendirle al propietario.
          </p>

          {/* Features */}
          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.text} className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: "rgba(255,255,255,0.10)" }}
                >
                  <f.icon className="h-3.5 w-3.5" style={{ color: "var(--pgo-primary-bd)" }} />
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>
                  {f.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer branding */}
        <div className="relative z-10">
          <div className="mb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            style={{
              background: "rgba(255,255,255,0.06)",
              color:      "rgba(255,255,255,0.40)",
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pgo-success)" }} />
            Ley 21.719 · Protección de datos personales · Chile
          </div>
        </div>
      </aside>

      {/* ── Panel derecho — formulario ── */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">

          {/* Logo mobile (visible solo en mobile) */}
          <Link href="/" className="mb-8 inline-flex lg:hidden transition-opacity hover:opacity-70">
            <Logo size="md" wordColor="var(--pgo-text-1)" />
          </Link>

          {/* Header del form — FIX UI-C3: h1 visible; el aside tiene aria-hidden
              por lo que su <p> no compite en el árbol de accesibilidad. */}
          <div className="mb-8">
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "var(--pgo-text-1)" }}
            >
              Bienvenido de vuelta
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>
              Ingresa tus credenciales para acceder al panel.
            </p>
          </div>

          {/* Tarjeta del formulario — vidrio esmerilado sobre la aurora */}
          <div className="pgo-auth-card p-6">
            <LoginForm resetSuccess={resetSuccess} />

            {/* Demo hint — solo fuera de producción. Mostrar credenciales
                válidas en el login público de producción es una exposición
                de seguridad innecesaria, no un feature. */}
            {process.env.NODE_ENV !== "production" && (
              <div
                className="mt-5 rounded-xl px-4 py-3 text-xs leading-relaxed"
                style={{
                  background: "var(--pgo-primary-lt)",
                  color:      "var(--pgo-primary-dk)",
                  border:     "1px solid var(--pgo-primary-bd)",
                }}
              >
                <strong>Demo:</strong> maria@corredorademo.cl / <code>Demo1234!</code>
              </div>
            )}
          </div>

          {/* Link a registro */}
          <p className="mt-5 text-center text-sm" style={{ color: "var(--pgo-text-3)" }}>
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "var(--pgo-primary)" }}>
              Crear cuenta gratuita
            </Link>
          </p>

          {/* Footer Ley 21.719 */}
          <p className="mt-4 text-center text-xs leading-relaxed" style={{ color: "var(--pgo-text-4)" }}>
            Al iniciar sesión aceptas nuestros{" "}
            <Link href="/terminos-uso" className="underline hover:opacity-80" style={{ color: "var(--pgo-text-3)" }}>
              Términos de uso
            </Link>{" "}
            y{" "}
            <Link href="/privacidad" className="underline hover:opacity-80" style={{ color: "var(--pgo-text-3)" }}>
              Política de privacidad
            </Link>
            {" "}conforme a la Ley 21.719.
          </p>
        </div>
      </main>
      </div>
    </div>
  );
}
