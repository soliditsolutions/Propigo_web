import { describe, expect, it } from "vitest";
import { diagnosticarCamara } from "../camara";

const error = (name: string) => Object.assign(new Error("x"), { name });

describe("diagnosticarCamara", () => {
  it("permiso denegado: explica cómo permitirla, menciona otras aplicaciones y deja reintentar", () => {
    for (const n of ["NotAllowedError", "PermissionDeniedError"]) {
      const d = diagnosticarCamara(error(n));
      expect(d.mensaje).toMatch(/bloqueó la cámara/);
      expect(d.mensaje).toMatch(/candado/);
      expect(d.mensaje).toMatch(/dentro de otra aplicación/);
      expect(d.reintentable).toBe(true);
    }
  });

  it("sin cámara: no ofrece reintentar", () => {
    for (const n of ["NotFoundError", "DevicesNotFoundError", "OverconstrainedError"]) {
      const d = diagnosticarCamara(error(n));
      expect(d.mensaje).toMatch(/No encontramos una cámara/);
      expect(d.reintentable).toBe(false);
    }
  });

  it("cámara ocupada: pide cerrar la otra aplicación y deja reintentar", () => {
    for (const n of ["NotReadableError", "TrackStartError", "AbortError"]) {
      const d = diagnosticarCamara(error(n));
      expect(d.mensaje).toMatch(/Otra aplicación está usando la cámara/);
      expect(d.reintentable).toBe(true);
    }
  });

  it("conexión no segura: pide https y no ofrece reintentar", () => {
    const d = diagnosticarCamara(error("SecurityError"));
    expect(d.mensaje).toMatch(/https/);
    expect(d.reintentable).toBe(false);
  });

  it("un error desconocido o que no es Error cae en el mensaje general", () => {
    for (const e of [error("OtroError"), "texto", null, undefined, {}, { name: 5 }]) {
      const d = diagnosticarCamara(e);
      expect(d.mensaje).toMatch(/No pudimos acceder a la cámara/);
      expect(d.reintentable).toBe(true);
    }
  });

  it("todos los mensajes ofrecen subir una foto", () => {
    for (const n of ["NotAllowedError", "NotFoundError", "NotReadableError", "SecurityError", "Otro"]) {
      expect(diagnosticarCamara(error(n)).mensaje).toMatch(/subir una foto/);
    }
  });
});
