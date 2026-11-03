// @vitest-environment jsdom
/**
 * Tests: tooltip de las features de los planes (FeatureTip en PlanesStop).
 *
 * Safari iOS no enfoca un botón al tocarlo, así que el tooltip no puede
 * depender solo de :hover/:focus-within: se abre por toque (click) y se cierra
 * al tocar fuera o con Escape. Sin esto, en iPhone la explicación de cada
 * feature del plan era inaccesible.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { PlanesStop } from "../PlanesStop";

function primerTip() {
  render(<PlanesStop />);
  const boton = screen.getAllByRole("button", { name: /^Más información sobre:/ })[0];
  const tip = document.getElementById(boton.getAttribute("aria-describedby")!)!;
  return { boton, tip };
}

describe("FeatureTip", () => {
  it("está asociado a su texto y parte cerrado", () => {
    const { boton, tip } = primerTip();
    expect(tip.getAttribute("role")).toBe("tooltip");
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    expect(tip.className).toMatch(/\bopacity-0\b/);
  });

  it("se abre con un toque y se cierra con otro", () => {
    const { boton, tip } = primerTip();
    fireEvent.click(boton);
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    expect(tip.className).toMatch(/\bopacity-100\b/);
    fireEvent.click(boton);
    expect(boton.getAttribute("aria-expanded")).toBe("false");
  });

  it("se cierra al tocar fuera, pero no al tocar el propio tooltip", () => {
    const { boton, tip } = primerTip();
    fireEvent.click(boton);
    fireEvent.pointerDown(tip);
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.pointerDown(document.body);
    expect(boton.getAttribute("aria-expanded")).toBe("false");
  });

  it("se cierra con Escape", () => {
    const { boton } = primerTip();
    fireEvent.click(boton);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(boton.getAttribute("aria-expanded")).toBe("false");
  });
});
