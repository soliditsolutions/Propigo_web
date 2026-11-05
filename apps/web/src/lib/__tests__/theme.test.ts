// @vitest-environment jsdom
/**
 * Tests: lib/theme — las páginas de error reaplican el tema cuando Next vuelve
 * a renderizar el documento en el cliente y se pierde data-theme.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { asegurarTema, temaPreferido, PGO_THEME_STORAGE_KEY } from "@/lib/theme";

function sistemaClaro(claro: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("light") ? claro : !claro }));
}

// jsdom sin URL tiene origen opaco y no expone localStorage: uno en memoria.
function almacenamiento(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", almacenamiento());
  document.documentElement.removeAttribute("data-theme");
});

describe("temaPreferido", () => {
  it("usa el tema guardado por el usuario aunque el sistema diga otra cosa", () => {
    sistemaClaro(true);
    localStorage.setItem(PGO_THEME_STORAGE_KEY, "aurora-dark");
    expect(temaPreferido()).toBe("aurora-dark");
  });

  it("sin preferencia guardada sigue al sistema", () => {
    sistemaClaro(true);
    expect(temaPreferido()).toBe("aurora-light");
    sistemaClaro(false);
    expect(temaPreferido()).toBe("aurora-dark");
  });

  it("ignora un valor guardado inválido", () => {
    sistemaClaro(true);
    localStorage.setItem(PGO_THEME_STORAGE_KEY, "<script>");
    expect(temaPreferido()).toBe("aurora-light");
  });

  it("con el almacenamiento bloqueado sigue al sistema sin lanzar", () => {
    sistemaClaro(false);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("SecurityError"); } });
    expect(temaPreferido()).toBe("aurora-dark");
  });
});

describe("asegurarTema", () => {
  it("pone el tema si falta", () => {
    sistemaClaro(true);
    asegurarTema();
    expect(document.documentElement.getAttribute("data-theme")).toBe("aurora-light");
  });

  it("no pisa un tema ya aplicado", () => {
    sistemaClaro(true);
    document.documentElement.setAttribute("data-theme", "aurora-dark");
    asegurarTema();
    expect(document.documentElement.getAttribute("data-theme")).toBe("aurora-dark");
  });
});
