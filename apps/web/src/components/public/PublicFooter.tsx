import Link from "next/link";
import { ShieldCheck, Building2, Wallet, Globe2, ArrowRight } from "lucide-react";
import { Logo } from "./Logo";
import { MARCA, ESLOGAN, RAZON_SOCIAL } from "@/lib/marca";

const PRODUCTO = [
  { href: "/marketplace", label: "Explorar propiedades", icon: Globe2 },
  { href: "/portal", label: "Consulta tu arriendo", icon: Wallet },
  { href: "/registro", label: "Publicar como corredor", icon: Building2 },
];

const CUENTA = [
  { href: "/login", label: "Iniciar sesión" },
  { href: "/registro", label: "Crear cuenta gratuita" },
  { href: "/recuperar-contrasena", label: "Recuperar contraseña" },
];

const LEGAL = [
  { href: "/terminos-uso", label: "Términos de uso" },
  { href: "/privacidad", label: "Política de privacidad" },
];

/**
 * Footer del sitio público — multi-columna, con navegación real del producto
 * (sin enlaces a redes sociales o contacto inventados: solo rutas que existen
 * hoy en la app). Se usa en marketplace, fichas de propiedad, home y legales.
 */
export function PublicFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={className}
      style={{
        // Difumina la entrada en vez de un borde de 1px de golpe: el corte
        // seco entre el contenido (sobre la aurora) y el footer se sentía
        // como un quiebre brusco de sección. El propio fondo del footer
        // hace la transición en sus primeros ~96px.
        background: "linear-gradient(to bottom, transparent 0%, var(--pf-surface-glass) 96px, var(--pf-surface-glass) 100%)",
        backdropFilter: "blur(12px) saturate(1.3)",
        WebkitBackdropFilter: "blur(12px) saturate(1.3)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Marca */}
          <div className="lg:col-span-1">
            <Logo size="md" />
            <p className="mt-2 text-sm font-semibold" style={{ color: "var(--pf-text-muted)" }}>{ESLOGAN}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: "var(--pf-text-body)" }}>
              Software de administración de arriendos para corredores de
              propiedades en Chile.
            </p>
            <div
              className="mt-4 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs"
              style={{ background: "var(--pf-brand-tint)", color: "var(--pf-brand)" }}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Datos tratados conforme a la Ley 21.719
            </div>
          </div>

          {/* Producto */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pf-text-light)" }}>
              Producto
            </h3>
            <ul className="mt-4 space-y-2.5">
              {PRODUCTO.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
                    style={{ color: "var(--pf-text-body)" }}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pf-text-light)" }} aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Cuenta */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pf-text-light)" }}>
              Cuenta
            </h3>
            <ul className="mt-4 space-y-2.5">
              {CUENTA.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm transition-opacity hover:opacity-70"
                    style={{ color: "var(--pf-text-body)" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + CTA */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pf-text-light)" }}>
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              {LEGAL.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm transition-opacity hover:opacity-70"
                    style={{ color: "var(--pf-text-body)" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/registro"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: "var(--pf-brand)" }}
            >
              Crear cuenta gratuita
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Barra inferior */}
        <div
          className="mt-10 flex flex-col items-center justify-between gap-3 pt-6 text-xs sm:flex-row"
          style={{ borderTop: "1px solid var(--pf-border)", color: "var(--pf-text-light)" }}
        >
          <span>© {new Date().getFullYear()} {MARCA}, un producto de {RAZON_SOCIAL}. Todos los derechos reservados.</span>
          <span>Hecho en Chile</span>
        </div>
      </div>
    </footer>
  );
}
