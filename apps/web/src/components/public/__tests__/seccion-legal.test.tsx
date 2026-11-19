// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { SeccionLegal } from "../SeccionLegal";

afterEach(() => { window.history.replaceState(null, "", "/"); });

describe("SeccionLegal", () => {
  it("en móvil parte plegada: el cuerpo lleva max-lg:hidden y el botón aria-expanded=false", () => {
    render(<SeccionLegal id="datos" titulo="2. Datos que tratamos"><p>Texto legal.</p></SeccionLegal>);
    const boton = screen.getByRole("button", { name: "2. Datos que tratamos" });
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    const cuerpo = document.getElementById(boton.getAttribute("aria-controls")!)!;
    expect(cuerpo.className).toContain("max-lg:hidden");
    // El texto sigue en el HTML (buscadores, escritorio).
    expect(cuerpo.textContent).toBe("Texto legal.");
  });

  it("el botón la abre y la cierra", () => {
    render(<SeccionLegal id="datos" titulo="Datos"><p>Texto.</p></SeccionLegal>);
    const boton = screen.getByRole("button", { name: "Datos" });
    fireEvent.click(boton);
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(boton.getAttribute("aria-controls")!)!.className).not.toContain("max-lg:hidden");
    fireEvent.click(boton);
    expect(boton.getAttribute("aria-expanded")).toBe("false");
  });

  it("se abre sola si la URL apunta a ella, al llegar o al cambiar el ancla", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    window.history.replaceState(null, "", "/privacidad#derechos");
    render(
      <>
        <SeccionLegal id="derechos" titulo="Derechos"><p>A.</p></SeccionLegal>
        <SeccionLegal id="cookies" titulo="Cookies"><p>B.</p></SeccionLegal>
      </>,
    );
    expect(screen.getByRole("button", { name: "Derechos" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: "Cookies" }).getAttribute("aria-expanded")).toBe("false");

    act(() => {
      window.history.replaceState(null, "", "/privacidad#cookies");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("button", { name: "Cookies" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("el título es un h2 (con botón en móvil y texto en escritorio)", () => {
    render(<SeccionLegal id="x" titulo="Contacto"><p>.</p></SeccionLegal>);
    const h2 = document.querySelector("section#x > h2")!;
    expect(h2.querySelector("button")).not.toBeNull();
    expect([...h2.querySelectorAll(":scope > span")].map((s) => s.textContent)).toEqual(["Contacto"]);
  });
});
