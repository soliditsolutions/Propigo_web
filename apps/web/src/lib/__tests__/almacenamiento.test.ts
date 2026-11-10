import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ALMACENAMIENTO } from "../almacenamiento";
import { COOKIE_PANEL, COOKIE_PORTAL, COOKIE_DEVICE } from "../sesion-cookies";

const SRC = join(__dirname, "..", "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return n === "__tests__" ? [] : archivos(ruta);
    return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [ruta] : [];
  });
}

describe("catálogo de cookies y almacenamiento (/privacidad §7)", () => {
  it("declara todo nombre pgo_* que el código usa como literal", () => {
    const declarados = new Set(ALMACENAMIENTO.map((e) => e.nombre));
    const usados = new Set<string>();
    for (const f of archivos(SRC)) {
      // Solo literales de cadena: los comentarios pueden citar nombres sin usarlos.
      for (const m of readFileSync(f, "utf8").matchAll(/["'`](?:__Host-)?(pgo_[a-z0-9_]+)["'`]/g)) {
        usados.add(m[1]);
      }
    }
    const sinDeclarar = [...usados].filter((n) => !declarados.has(n));
    expect(sinDeclarar).toEqual([]);
  });

  it("no declara nombres que el código ya no usa", () => {
    const texto = archivos(SRC)
      .filter((f) => !f.endsWith("almacenamiento.ts"))
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");
    const huerfanos = ALMACENAMIENTO.filter((e) => !texto.includes(e.nombre)).map((e) => e.nombre);
    expect(huerfanos).toEqual([]);
  });

  it("el nombre visible de cada cookie coincide con el que se emite en producción", () => {
    const enProd = new Set([COOKIE_PANEL, COOKIE_PORTAL, COOKIE_DEVICE].map((n) => n.replace(/^__Host-/, "")));
    const cookies = ALMACENAMIENTO.filter((e) => e.tipo === "cookie");
    expect(new Set(cookies.map((c) => c.nombre))).toEqual(enProd);
    for (const c of cookies) expect(c.nombreVisible).toBe(`__Host-${c.nombre}`);
  });

  it("toda cookie es esencial: no hay cookies que exijan consentimiento", () => {
    for (const c of ALMACENAMIENTO.filter((e) => e.tipo === "cookie")) expect(c.esencial).toBe(true);
  });

  it("no usa herramientas de analítica ni publicidad de terceros", () => {
    const prohibidos = /googletagmanager|google-analytics|gtag\(|fbq\(|connect\.facebook|hotjar|clarity\.ms|segment\.com|mixpanel/i;
    const encontrados = archivos(SRC)
      .filter((f) => prohibidos.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(SRC, ""));
    expect(encontrados).toEqual([]);
  });
});
