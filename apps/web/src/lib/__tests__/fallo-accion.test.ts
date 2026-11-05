/**
 * Tests: lib/fallo-accion — una server action que se rechaza (sin red,
 * servidor caído, sesión vencida) se traduce a un aviso y no rompe la página.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { describirFalloAccion, accionDeFormulario, SESION_EXPIRADA } from "@/lib/fallo-accion";

describe("describirFalloAccion", () => {
  it("reconoce la sesión vencida del panel y ofrece iniciar sesión", () => {
    const f = describirFalloAccion(new Error(SESION_EXPIRADA), true, "/panel/cobros");
    expect(f.tipo).toBe("sesion");
    expect(f.mensaje).toMatch(/sesión expiró/);
    expect(f.accion).toEqual({ texto: "Iniciar sesión", href: "/login" });
  });

  it("en el portal envía a ingresar con el RUT, no al login del corredor", () => {
    const f = describirFalloAccion(new Error(SESION_EXPIRADA), true, "/portal/contrato/abc");
    expect(f.tipo).toBe("sesion");
    expect(f.accion?.href).toBe("/portal");
  });

  it("la sesión vencida tiene prioridad aunque el equipo esté sin red", () => {
    expect(describirFalloAccion(new Error(SESION_EXPIRADA), false, "/panel").tipo).toBe("sesion");
  });

  it("sin red: avisa la conexión y que lo escrito sigue en el formulario", () => {
    const f = describirFalloAccion(new TypeError("Failed to fetch"), false, "/panel");
    expect(f.tipo).toBe("sin-conexion");
    expect(f.mensaje).toMatch(/sin conexión/);
    expect(f.mensaje).toMatch(/sigue aquí/);
    expect(f.accion).toBeUndefined();
  });

  it("con red pero sin respuesta (TypeError de fetch): servidor inalcanzable, sin culpar la conexión del usuario", () => {
    const f = describirFalloAccion(new TypeError("Failed to fetch"), true, "/panel");
    expect(f.tipo).toBe("servidor-inalcanzable");
    expect(f.mensaje).not.toMatch(/tu conexión/);
  });

  it("cualquier otro rechazo es un problema de nuestro lado", () => {
    for (const err of [new Error("An unexpected response was received from the server."), "texto", null, undefined, 42]) {
      expect(describirFalloAccion(err, true, "/panel").tipo).toBe("inesperado");
    }
  });

  it("no filtra el mensaje técnico del error al usuario", () => {
    const f = describirFalloAccion(new Error("relation \"usuario\" does not exist"), true, "/panel");
    expect(f.mensaje).not.toContain("relation");
  });
});

describe("accionDeFormulario", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubNavegador(onLine: boolean, pathname = "/login") {
    vi.stubGlobal("navigator", { onLine });
    vi.stubGlobal("window", { location: { pathname } });
  }

  it("devuelve el resultado de la acción cuando responde", async () => {
    type S = { error: string } | { ok: true } | null;
    const accion = vi.fn(async (): Promise<S> => ({ ok: true }));
    const segura = accionDeFormulario(accion);
    const fd = new FormData();
    await expect(segura(null, fd)).resolves.toEqual({ ok: true });
    expect(accion).toHaveBeenCalledWith(null, fd);
  });

  it("un error de negocio de la acción pasa tal cual", async () => {
    const segura = accionDeFormulario(async (): Promise<{ error: string } | null> => ({ error: "Correo o contraseña incorrectos." }));
    await expect(segura(null, new FormData())).resolves.toEqual({ error: "Correo o contraseña incorrectos." });
  });

  it("un rechazo por falta de red se convierte en { error } y no lanza", async () => {
    stubNavegador(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const segura = accionDeFormulario(async (): Promise<{ error: string } | null> => { throw new TypeError("Failed to fetch"); });
    const r = await segura(null, new FormData());
    expect(r).toEqual({ error: expect.stringMatching(/sin conexión/) });
  });

  it("un rechazo inesperado también vuelve como { error }", async () => {
    stubNavegador(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const segura = accionDeFormulario(async (): Promise<{ error: string; field?: string } | null> => { throw new Error("boom"); });
    await expect(segura(null, new FormData())).resolves.toEqual({ error: expect.stringMatching(/de nuestro lado/) });
  });
});
