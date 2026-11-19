// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { formatoReloj, Aviso, Campo } from "../campos";
import { T } from "../textos";
import { Mail } from "lucide-react";
import { luzDesdePuntero } from "../luz";
import { MarcoGuiado } from "../marco-guiado";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("formatoReloj", () => {
  it("da minutos y segundos con dos dígitos", () => {
    expect(formatoReloj(300)).toBe("05:00");
    expect(formatoReloj(61)).toBe("01:01");
    expect(formatoReloj(0)).toBe("00:00");
  });
});

describe("luzDesdePuntero", () => {
  const caja = { left: 100, top: 50, width: 200, height: 100 };

  it("el centro da 50 % y desplazamiento cero", () => {
    expect(luzDesdePuntero(200, 100, caja)).toEqual({ gx: 50, gy: 50, px: 0, py: 0 });
  });

  it("las esquinas dan los extremos y fuera de la caja se acota", () => {
    expect(luzDesdePuntero(100, 50, caja)).toEqual({ gx: 0, gy: 0, px: -1, py: -1 });
    expect(luzDesdePuntero(900, 900, caja)).toEqual({ gx: 100, gy: 100, px: 1, py: 1 });
  });

  it("una caja sin tamaño no divide por cero", () => {
    expect(luzDesdePuntero(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ gx: 50, gy: 50, px: 0, py: 0 });
  });
});

describe("textos de acceso", () => {
  it("las tarjetas flotantes no traen cifras: son funciones, no datos inventados", () => {
    expect(JSON.stringify(T.destellos.login)).not.toMatch(/\$|\d/);
  });

  it("el plan Gratuito sale de PLAN_GRATUITO, no de un texto aparte", () => {
    expect(T.planGratuito.detalle).toBe("1 propiedad · 1 usuario · sin tarjeta");
  });

  it("no usa exclamaciones ni emojis (voz confirmada)", () => {
    const todo = JSON.stringify(T);
    expect(todo).not.toMatch(/[¡!]/);
    expect(todo).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("Campo", () => {
  it("asocia la etiqueta, la ayuda y el error con el input", () => {
    render(<Campo id="c1" etiqueta="Correo" icono={Mail} ayuda="Ayuda" error="Falla" defaultValue="x" />);
    const input = screen.getByLabelText("Correo");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toContain("c1-error");
    expect(screen.getByRole("alert").textContent).toContain("Falla");
  });

  it("sin error muestra la ayuda y no marca el campo como inválido", () => {
    render(<Campo id="c2" etiqueta="Correo" icono={Mail} ayuda="Ayuda útil" />);
    expect(screen.getByLabelText("Correo").getAttribute("aria-invalid")).toBeNull();
    expect(screen.getByText("Ayuda útil")).toBeTruthy();
  });
});

describe("Aviso", () => {
  it("un error se anuncia como alerta y los demás como estado", () => {
    const { rerender } = render(<Aviso variante="error">Mal</Aviso>);
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(<Aviso variante="ok">Bien</Aviso>);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});

describe("estructura de los textos (regla general)", () => {
  /** Recorre T y junta los textos que se muestran como título o titular. */
  function titulos(obj: unknown, ruta = ""): [string, string][] {
    if (typeof obj === "string") return /titulo$/i.test(ruta) ? [[ruta, obj]] : [];
    if (Array.isArray(obj)) return obj.flatMap((v, i) => titulos(v, `${ruta}[${i}]`));
    if (obj && typeof obj === "object") {
      return Object.entries(obj).flatMap(([k, v]) => titulos(v, ruta ? `${ruta}.${k}` : k));
    }
    return [];
  }

  it("títulos y titulares sin punto final (RAE), los párrafos sí lo llevan", () => {
    const lista = titulos(T);
    expect(lista.length).toBeGreaterThan(10);
    for (const [ruta, texto] of lista) expect(`${ruta}: ${texto}`).not.toMatch(/\.$/);
    for (const m of Object.values(T.marca)) expect(m.texto).toMatch(/\.$/);
  });

  it("la marca no se escribe a mano: sale de lib/marca.ts", () => {
    const raiz = join(__dirname, "..", "..", "..");
    for (const archivo of [
      "components/acceso/textos.ts", "components/acceso/marco-guiado.tsx", "components/acceso/campos.tsx",
      "app/login/login-form.tsx", "app/login/page.tsx",
      "app/recuperar-contrasena/recuperar-form.tsx", "app/recuperar-contrasena/page.tsx",
      "app/registro/registro-form.tsx", "app/registro/page.tsx",
      "app/nueva-contrasena/nueva-form.tsx", "app/nueva-contrasena/page.tsx",
      "app/verificar-dispositivo/verificar-form.tsx", "app/verificar-dispositivo/page.tsx",
      "app/invitacion/invitacion-form.tsx", "app/invitacion/page.tsx",
      "app/portal/page.tsx", "app/portal/verificar/page.tsx",
    ]) {
      const fuente = readFileSync(join(raiz, archivo), "utf8");
      expect(`${archivo}: ${fuente.match(/Propigo/)?.[0] ?? ""}`).toBe(`${archivo}: `);
    }
  });

  it("el marco guiado pone el h1 del contenido dentro de main, con su subtítulo en hgroup y el pie fuera de main", () => {
    // jsdom no trae ResizeObserver (PanelAnimado lo usa para animar el alto).
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    const { container } = render(
      <MarcoGuiado flujo="login">
        <hgroup><h1>Título</h1><p>Subtítulo.</p></hgroup>
      </MarcoGuiado>,
    );
    const h1 = container.querySelectorAll("h1");
    expect(h1).toHaveLength(1);
    expect(h1[0].closest("main")).not.toBeNull();
    expect(h1[0].parentElement?.tagName).toBe("HGROUP");
    expect(container.querySelector("main footer")).toBeNull();
    expect(container.querySelector("footer")).not.toBeNull();
    // El titular de marca es visible y legible para lectores de pantalla (no aria-hidden).
    const titular = container.querySelector(".pgo-acc-marca-titulo");
    expect(titular?.getAttribute("aria-hidden")).toBeNull();
    expect(titular?.querySelector(".sr-only")?.textContent).toBe(T.marca.login.titulo);
  });
});
