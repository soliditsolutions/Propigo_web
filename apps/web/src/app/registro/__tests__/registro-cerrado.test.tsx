// @vitest-environment jsdom
/**
 * V0: con el registro cerrado, la página no muestra el formulario ni promete un
 * plan gratuito, y la acción rechaza el POST aunque alguien la llame directo.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get: () => { throw new Error("no debe tocar la base"); } }) }));
vi.mock("../registro-form", () => ({ RegistroForm: () => <form data-testid="formulario" /> }));

const { default: RegistroPage } = await import("../page");
const { registroAction } = await import("../actions");

describe("registro cerrado", () => {
  beforeEach(() => vi.stubEnv("REGISTRO_ABIERTO", "false"));
  afterEach(() => vi.unstubAllEnvs());

  it("la página explica que aún no está abierto y no muestra el formulario", () => {
    render(<RegistroPage />);
    expect(screen.getByRole("heading", { name: /aún no abrimos el registro/i })).toBeTruthy();
    expect(screen.queryByTestId("formulario")).toBeNull();
    expect(screen.queryByText(/plan Gratuito/i)).toBeNull();
    expect(screen.getByRole("link", { name: /soporte@propigo\.cl/ })).toBeTruthy();
  });

  it("la acción rechaza el envío sin tocar la base", async () => {
    const fd = new FormData();
    fd.set("email", "x@example.cl");
    const r = await registroAction(null, fd);
    expect(r).toEqual({ error: expect.stringMatching(/todavía no está abierto/i) });
  });
});

describe("registro abierto", () => {
  beforeEach(() => vi.stubEnv("REGISTRO_ABIERTO", "true"));
  afterEach(() => vi.unstubAllEnvs());

  it("la página muestra el formulario", () => {
    render(<RegistroPage />);
    expect(screen.getByTestId("formulario")).toBeTruthy();
  });
});
