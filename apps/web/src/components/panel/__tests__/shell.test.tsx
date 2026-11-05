// @vitest-environment jsdom
/**
 * Tests: PanelShell — skip link (UI-C4, WCAG 2.4.1 Bypass Blocks)
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import React from "react";
import { PanelShell } from "../shell";

// jsdom expone localStorage en window, pero no siempre como global bare.
// vi.stubGlobal lo hace accesible directamente desde el código del componente.
beforeAll(() => {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear:      () => { Object.keys(store).forEach((k) => delete store[k]); },
  });
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => <a href={href} {...rest}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/panel",
}));

vi.mock("@/components/panel/nav", () => ({
  Nav: () => <nav aria-label="Secciones del panel" data-testid="nav" />,
}));

const PROPS = {
  tenant:   { nombre: "Corredora Test", plan: "Gold" },
  user:     { nombre: "Juan García", email: "juan@test.cl", rol: "admin" },
  children: <div>Contenido de prueba</div>,
};

describe("PanelShell — skip link (UI-C4)", () => {
  it("renderiza el skip link con texto correcto", () => {
    render(<PanelShell {...PROPS} />);
    expect(screen.getByText("Saltar al contenido principal")).toBeInTheDocument();
  });

  it("skip link apunta a #main-content", () => {
    render(<PanelShell {...PROPS} />);
    const link = screen.getByText("Saltar al contenido principal");
    expect(link).toHaveAttribute("href", "#main-content");
  });

  it("skip link es el primer <a> en el DOM (antes de navegación)", () => {
    const { container } = render(<PanelShell {...PROPS} />);
    const anchors = container.querySelectorAll("a");
    expect(anchors[0]).toHaveAttribute("href", "#main-content");
  });

  it("el elemento <main> tiene id='main-content'", () => {
    render(<PanelShell {...PROPS} />);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
  });

  it("skip link y main-content forman un par válido de bypass block", () => {
    render(<PanelShell {...PROPS} />);
    const link = screen.getByText("Saltar al contenido principal");
    const main = screen.getByRole("main");
    const targetId = link.getAttribute("href")?.replace("#", "");
    expect(main.id).toBe(targetId);
  });

  it("el pie del menú nombra el plan que recibe, con la palabra «plan» (M-22)", () => {
    render(<PanelShell {...PROPS} />);
    // Lo pintan el menú de escritorio y el cajón móvil.
    expect(screen.getAllByText("Corredora Test · plan Gold").length).toBeGreaterThan(0);
    expect(screen.queryByText(/· demo/)).toBeNull();
  });
});
