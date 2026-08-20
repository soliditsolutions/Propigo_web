"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Menu, X, LogOut } from "lucide-react";
import { Nav } from "@/components/panel/nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface Props {
  tenant:   { nombre: string; plan: string | null };
  user:     { nombre: string; email: string; rol: string };
  children: React.ReactNode;
}

/** Iniciales del nombre (hasta 2 letras). */
function initials(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

export function PanelShell({ tenant, user, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);

  // Cargar preferencia guardada
  useEffect(() => {
    if (localStorage.getItem("hw_sidebar_collapsed") === "1") queueMicrotask(() => setCollapsed(true));
  }, []);

  function toggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hw_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  }

  // Cerrar mobile sidebar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Bloquear scroll del body con sidebar abierto (mobile)
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    // fetch sigue el 303 del servidor; al resolver, Set-Cookie ya fue procesado
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch { /* red */ }
    window.location.href = "/login";
  }

  const userInitials = initials(user.nombre);

  const sidebarContent = (isMobile = false) => (
    <>
      {/* Logo + botón colapsar */}
      <div
        className="shrink-0"
        style={{ padding: !isMobile && collapsed ? "20px 8px 16px" : "20px 16px 16px" }}
      >
        {!isMobile && collapsed ? (
          /* ── Sidebar colapsado: icono H + botón expandir ── */
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/"
              aria-label="Housing — ir al inicio"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-base font-black transition-opacity hover:opacity-80"
              style={{
                background: "var(--hw-panel-nav-surface-2)",
                color: "var(--hw-panel-nav-text)",
                letterSpacing: "-0.02em",
              }}
            >
              H
            </Link>
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Expandir menú lateral"
              title="Expandir"
              className="hw-btn hw-tap-target relative flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{
                color: "var(--hw-panel-nav-muted)",
                background: "var(--hw-panel-nav-surface)",
              }}
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          /* ── Sidebar expandido: logo + botón colapsar en la misma fila ── */
          <>
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/"
                className="group flex items-baseline gap-2 min-w-0"
                aria-label="Housing — ir al inicio"
                onClick={() => setSidebarOpen(false)}
              >
                <span
                  className="text-xl font-bold tracking-tight"
                  style={{ color: "var(--hw-panel-nav-text)" }}
                >
                  Housing
                </span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--hw-panel-nav-faint)" }}
                >
                  SOLIDIT
                </span>
              </Link>
              {!isMobile && (
                <button
                  type="button"
                  onClick={toggleCollapse}
                  aria-label="Colapsar menú lateral"
                  title="Colapsar"
                  className="hw-btn hw-tap-target relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors"
                  style={{
                    color: "var(--hw-panel-nav-muted)",
                    background: "var(--hw-panel-nav-surface)",
                  }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--hw-panel-nav-muted)" }}>
              Panel del corredor
            </p>
          </>
        )}
      </div>

      <div
        aria-hidden="true"
        className="mx-2 shrink-0"
        style={{ borderTop: "1px solid var(--hw-panel-nav-border)" }}
      />

      {/* Nav — sin hw-scroll-dark: el scrollbar ya sigue el tema activo
          globalmente (html { scrollbar-color: var(--hw-border-2) ... }); ese
          override fijaba blanco siempre, pensado para un sidebar que ya no
          es fijo. */}
      <div
        className="flex-1 overflow-y-auto overflow-x-hidden"
        onClick={() => setSidebarOpen(false)}
      >
        <Nav collapsed={!isMobile && collapsed} isManager={user.rol === "manager"} />
      </div>

      {/* Footer tenant + user */}
      <div
        className="shrink-0 pb-4"
        style={{ padding: !isMobile && collapsed ? "0 8px 16px" : "0 20px 16px" }}
      >
        {!isMobile && collapsed ? (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold mx-auto cursor-default"
            style={{ background: "var(--hw-panel-nav-surface-2)", color: "var(--hw-panel-nav-text)" }}
            title={`${user.nombre} · ${tenant.nombre}`}
          >
            {userInitials}
          </div>
        ) : (
          <div
            className="rounded-xl p-3"
            style={{ background: "var(--hw-panel-nav-surface)", border: "1px solid var(--hw-panel-nav-border)" }}
          >
            <p className="text-xs font-semibold truncate" style={{ color: "var(--hw-panel-nav-text)" }}>
              {user.nombre}
            </p>
            <p className="mt-0.5 text-[10px] truncate" style={{ color: "var(--hw-panel-nav-muted)" }}>
              {tenant.nombre} · {tenant.plan ?? "demo"}
            </p>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="relative h-screen hw-page-bg overflow-hidden">
      {/* Fondo — en claro, mismo blob suave que login/registro/home; en
          oscuro, variante "beams" (franjas de luz, aproximación CSS-only del
          componente Beams de React Bits — ver .hw-beams-layer). Solo se
          asoma a través de las superficies de vidrio (sidebar via
          .hw-auth-aside, header via .hw-glass); <main> abajo lleva fondo
          opaco propio para no quedar detrás de tablas/formularios densos
          (ver nota "usar con moderación" en .hw-aurora-bg de globals.css). */}
      <div className="hw-beams-layer" aria-hidden="true" />

      <div className="relative z-10 flex h-screen">
      {/* FIX UI-C4 — Skip link: permite a usuarios de teclado/lector de pantalla
          saltar directamente al contenido principal sin recorrer toda la barra lateral.
          WCAG 2.4.1 — Bypass Blocks. Visible solo cuando recibe foco (sr-only). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[999] focus:rounded-xl focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:shadow-lg"
        style={{
          background: "var(--hw-surface)",
          color:      "var(--hw-primary)",
          border:     "2px solid var(--hw-primary)",
          outline:    "none",
        }}
      >
        Saltar al contenido principal
      </a>

      {/* Overlay backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
        />
      )}

      {/* Sidebar desktop — colapsable. hw-panel-aside: vidrio propio del
          panel (navy en oscuro, blanco/gris en claro vía --hw-panel-nav-bg),
          distinto de hw-auth-aside (fijo oscuro, solo para login/registro). */}
      <aside
        className="hw-panel-aside hidden md:flex flex-col shrink-0"
        style={{
          width: collapsed ? 64 : 240,
          boxShadow: "var(--hw-shadow-2)",
          transition: "width 280ms cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}
        aria-label="Navegación principal"
      >
        {sidebarContent(false)}
      </aside>

      {/* Sidebar mobile (drawer) */}
      <aside
        className="hw-panel-aside fixed inset-y-0 left-0 z-50 flex w-72 flex-col md:hidden"
        style={{
          boxShadow: "var(--hw-shadow-2)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 300ms cubic-bezier(0.16,1,0.3,1)",
        }}
        aria-label="Navegación principal"
        aria-hidden={!sidebarOpen}
      >
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
          className="hw-btn absolute right-1.5 top-2.5 rounded-lg p-3"
          style={{ color: "var(--hw-panel-nav-muted)" }}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {sidebarContent(true)}
      </aside>

      {/* Contenido principal */}
      <div className="flex flex-1 min-w-0 min-h-0 flex-col">
        {/* Header glassmorfismo sticky */}
        <header
          className="hw-glass flex h-14 shrink-0 items-center justify-between px-4 md:px-6 sticky top-0 z-20"
          style={{ borderBottom: "1px solid var(--hw-border)" }}
          role="banner"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir menú de navegación"
              aria-expanded={sidebarOpen}
              className="hw-btn hw-tap-target relative rounded-lg p-2 md:hidden"
              style={{ color: "var(--hw-text-1)" }}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="text-sm font-semibold truncate" style={{ color: "var(--hw-text-1)" }}>
              {tenant.nombre}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:block text-sm truncate max-w-[160px]" style={{ color: "var(--hw-text-3)" }}>
              {user.nombre}
            </span>

            {/* Avatar */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              aria-label={`Usuario: ${user.nombre}`}
              title={user.email}
              style={{
                background: "linear-gradient(135deg, var(--hw-primary) 0%, var(--hw-sidebar) 100%)",
                boxShadow: "0 2px 6px rgba(99,91,255,0.35)",
              }}
            >
              {userInitials}
            </div>

            <ThemeToggle />

            {/* Logout */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="hw-btn hw-tap-target relative rounded-lg p-1.5"
              style={{ color: "var(--hw-text-3)" }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Fondo opaco propio: el contenido del panel (tablas, formularios)
            es denso — la aurora no debe traslucir aquí, solo en sidebar/header. */}
        <main
          className="flex-1 min-h-0 overflow-auto p-4 md:p-6"
          style={{ background: "var(--hw-page)" }}
          id="main-content"
        >
          {children}
        </main>
      </div>
      </div>
    </div>
  );
}
