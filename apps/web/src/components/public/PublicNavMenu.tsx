"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NAV_LINKS, PublicNavLink } from "./PublicNavLinks";

/** Acciones de cuenta (corredor). Orden: Iniciar sesión, Registrarse, tema. */
function AuthActions({
  isLoggedIn,
  mobile = false,
  onNavigate,
}: {
  isLoggedIn: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const ctaClass = mobile ? "pf-navcta w-full justify-center" : "pf-navcta";
  const ghostClass = mobile ? "pf-navghost block text-center" : "pf-navghost";

  if (isLoggedIn) {
    return (
      <>
        <Link href="/panel" onClick={onNavigate} className={ctaClass}>
          Ir al panel
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <form method="POST" action="/api/auth/logout" className={mobile ? "w-full" : ""}>
          <button type="submit" className={mobile ? "pf-navghost block w-full" : "pf-navghost"}>
            Cerrar sesión
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <Link href="/login" onClick={onNavigate} className={ghostClass}>
        Iniciar sesión
      </Link>
      <Link href="/registro" onClick={onNavigate} className={ctaClass}>
        Registrarse
      </Link>
    </>
  );
}

/**
 * Acciones del lado derecho del navbar. Desktop (≥lg): Iniciar sesión →
 * Registrarse → cambiar tema, en ese orden. Mobile/tablet (<lg): tema +
 * hamburguesa que despliega un panel con los enlaces de PublicNavLinks
 * (ocultos en la píldora central por debajo de `lg`) y las acciones de
 * cuenta. El corte es `lg` (1024px), no `md` (768px) — a 768px (tablet
 * portrait) el navbar de escritorio no tiene ancho real para
 * "Iniciar sesión + Registrarse" (ver el mismo razonamiento en
 * ScrollWalkthrough.tsx, que comparte el problema con el escenario
 * cinematográfico).
 */
export function PublicNavMenu({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="pf-navbar-actions flex items-center gap-2">
      {/* ── Desktop (≥lg): Iniciar sesión, Registrarse, tema ────────────── */}
      <div className="hidden items-center gap-2 lg:flex">
        <AuthActions isLoggedIn={isLoggedIn} />
        <ThemeToggle />
      </div>

      {/* ── Mobile/tablet (<lg): tema + hamburguesa ──────────────────────── */}
      <div className="flex items-center gap-2 lg:hidden">
        <ThemeToggle />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pf-navicon-btn"
          aria-expanded={open}
          aria-controls="pf-mobile-menu"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {/* ── Mobile/tablet: panel desplegable ─────────────────────────────── */}
      {open && (
        <div
          id="pf-mobile-menu"
          className="absolute inset-x-0 top-full lg:hidden"
          style={{
            background: "var(--pf-surface-glass)",
            backdropFilter: "blur(16px) saturate(1.6)",
            WebkitBackdropFilter: "blur(16px) saturate(1.6)",
            borderBottom: "1px solid var(--pf-border)",
            boxShadow: "0 16px 32px -20px rgba(0,0,0,0.55)",
          }}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-5">
            {NAV_LINKS.map((l) => (
              <PublicNavLink key={l.href} href={l.href} onClick={close} className="pf-navpill-link block">
                {l.label}
              </PublicNavLink>
            ))}

            <span className="my-3 h-px w-full" style={{ background: "var(--pf-border)" }} aria-hidden="true" />

            <AuthActions isLoggedIn={isLoggedIn} mobile onNavigate={close} />
          </div>
        </div>
      )}
    </div>
  );
}
