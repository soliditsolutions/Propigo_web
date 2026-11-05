// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { leerJson, mensajeDeFallo, mensajeSinRespuesta } from "../respuesta-api";

afterEach(() => vi.unstubAllGlobals());

describe("leerJson", () => {
  it("devuelve el objeto cuando la respuesta es JSON", async () => {
    expect(await leerJson(new Response(JSON.stringify({ ok: true })))).toEqual({ ok: true });
  });
  it("devuelve null con HTML de un 504 del proxy, cuerpo vacío o JSON que no es objeto", async () => {
    expect(await leerJson(new Response("<html>Gateway Timeout</html>", { status: 504 }))).toBeNull();
    expect(await leerJson(new Response(null, { status: 502 }))).toBeNull();
    expect(await leerJson(new Response("42"))).toBeNull();
    expect(await leerJson(new Response("null"))).toBeNull();
  });
});

describe("mensajeDeFallo", () => {
  const def = "No se pudo validar.";
  it("prefiere el motivo que da la ruta", () => {
    expect(mensajeDeFallo(422, { ok: false, error: "Falta el RUT." }, def)).toBe("Falta el RUT.");
    expect(mensajeDeFallo(500, { error: "Servicio de IA no disponible." }, def)).toBe("Servicio de IA no disponible.");
  });
  it("sesión expirada se dice como tal, aunque la ruta mande otro texto", () => {
    expect(mensajeDeFallo(401, { error: "No autorizado." }, def)).toMatch(/sesión expiró/);
  });
  it("sin JSON o 5xx: problema nuestro, no de la conexión del usuario", () => {
    expect(mensajeDeFallo(504, null, def)).toMatch(/problema de nuestro lado/);
    expect(mensajeDeFallo(500, {}, def)).toMatch(/problema de nuestro lado/);
    expect(mensajeDeFallo(404, null, def)).toMatch(/problema de nuestro lado/);
  });
  it("413 del proxy: archivo demasiado grande", () => {
    expect(mensajeDeFallo(413, null, def)).toMatch(/tamaño máximo/);
  });
  it("error vacío o no string: texto por defecto", () => {
    expect(mensajeDeFallo(400, { error: "  " }, def)).toBe(def);
    expect(mensajeDeFallo(400, { error: { x: 1 } }, def)).toBe(def);
  });
});

describe("mensajeSinRespuesta", () => {
  it("distingue estar sin red de un servidor inalcanzable", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(mensajeSinRespuesta()).toMatch(/Sin conexión/);
    vi.stubGlobal("navigator", { onLine: true });
    expect(mensajeSinRespuesta()).toMatch(/No pudimos comunicarnos/);
  });
});
