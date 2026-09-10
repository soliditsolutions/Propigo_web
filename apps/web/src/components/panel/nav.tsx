"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, FileText, Wallet, Bell, UserCog, House, ReceiptText, BarChart3, Users, Landmark } from "lucide-react";

const items = [
  { href: "/panel",                label: "Resumen",        icon: LayoutDashboard },
  { href: "/panel/propiedades",    label: "Propiedades",    icon: Building2       },
  { href: "/panel/contratos",      label: "Contratos",      icon: FileText        },
  { href: "/panel/cobros",         label: "Cobros",         icon: Wallet          },
  { href: "/panel/vouchers",       label: "Vouchers",       icon: ReceiptText     },
  { href: "/panel/notificaciones", label: "Notificaciones", icon: Bell            },
];

// ADR-0013 (Fase D) — Estadísticas es business intelligence de cartera
// completa (turnover, retención, comparables de mercado); no se recorta por
// propiedad asignada, así que directamente se oculta para el Colaborador
// (igual criterio que "Equipo"). El proxy la rechaza si entra por URL directa.
const itemEstadisticas = { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 };

const itemsSecundarios = [
  { href: "/",             label: "Ir al inicio", icon: House   },
  { href: "/panel/perfil", label: "Mi perfil",    icon: UserCog },
];

// ADR-0013 (cuentas multi-usuario) — visible solo para el Manager, dueño de
// la cuenta; el proxy además rechaza la ruta directamente para cualquier
// Collaborator que intente navegar ahí a mano.
const itemEquipo = { href: "/panel/equipo", label: "Equipo", icon: Users };

// Datos de facturación de la corredora (giro, domicilio, cuenta bancaria) —
// aparecen en cada documento que emite. Solo el Manager; el proxy también gatea.
const itemCorredora = { href: "/panel/corredora", label: "Datos de la corredora", icon: Landmark };

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className="hw-btn hw-sidebar-link relative flex items-center rounded-xl text-sm font-medium"
      style={{
        gap:             collapsed ? 0 : 12,
        padding:         collapsed ? "10px 0" : "10px 12px",
        justifyContent:  collapsed ? "center" : "flex-start",
        // background/color/boxShadow SOLO se fijan inline cuando active=true.
        // Si no, se omiten (undefined) para que .hw-sidebar-link (color base) y
        // .hw-sidebar-link:hover (background+color) en CSS puedan aplicar — un
        // inline explícito le ganaría siempre a cualquier regla de CSS, sin
        // importar especificidad de selector.
        background:      active ? "var(--hw-panel-nav-active-bg)" : undefined,
        color:           active ? "var(--hw-panel-nav-text)" : undefined,
        boxShadow:       active ? "0 0 14px -6px var(--hw-panel-nav-glow), inset 0 1px 0 var(--hw-panel-nav-inset)" : undefined,
      }}
    >
      {active && !collapsed && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full"
          style={{ background: "var(--hw-primary)", boxShadow: "0 0 6px var(--hw-panel-nav-glow)" }}
        />
      )}
      <Icon
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
        style={{ opacity: active ? 1 : 0.65 }}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export function Nav({ collapsed = false, isManager = false }: { collapsed?: boolean; isManager?: boolean }) {
  const path = usePathname();
  const primarios = isManager
    ? [...items.slice(0, 4), itemEstadisticas, ...items.slice(4)]
    : items;
  const secundarios = isManager
    ? [itemsSecundarios[0], itemCorredora, itemEquipo, itemsSecundarios[1]]
    : itemsSecundarios;

  return (
    <nav
      className="mt-3 flex-1 flex flex-col"
      style={{ padding: collapsed ? "0 8px" : "0 12px" }}
      aria-label="Secciones del panel"
    >
      {/* FIX UI-C6: navegación principal primero — lectores de pantalla recorren
          el DOM en orden; los ítems principales deben preceder a los secundarios. */}
      <div className="flex-1 space-y-0.5">
        {primarios.map((it) => {
          const active =
            it.href === "/panel" ? path === it.href : path.startsWith(it.href);
          return (
            <NavLink
              key={it.href}
              href={it.href}
              label={it.label}
              icon={it.icon}
              active={active}
              collapsed={collapsed}
            />
          );
        })}
      </div>

      {/* Separador */}
      <div
        aria-hidden="true"
        className="mx-1 my-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      />

      {/* Navegación secundaria (Ir al inicio, Equipo si es manager, Mi perfil) — al final */}
      <div className="space-y-0.5">
        {secundarios.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <NavLink
              key={it.href}
              href={it.href}
              label={it.label}
              icon={it.icon}
              active={active}
              collapsed={collapsed}
            />
          );
        })}
      </div>
    </nav>
  );
}
