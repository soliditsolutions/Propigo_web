/**
 * El HTML de los correos no debe poder ser escrito por quien envía un formulario.
 *
 * Estos casos existen porque el fallo era invisible en desarrollo: fuera de
 * producción las funciones de envío escriben a consola y **nunca construyen el
 * HTML**, así que nada revelaba que los valores se interpolaban crudos. Se
 * fuerza NODE_ENV=production y se intercepta Resend para inspeccionar el HTML
 * real que se habría enviado.
 *
 * Los formularios de contacto y denuncia del marketplace son PÚBLICOS: quien
 * los envía no está autenticado, y el correo sale desde nuestro dominio.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const enviados: { html: string; subject: string }[] = [];

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: (opts: { html: string; subject: string }) => {
        enviados.push(opts);
        return Promise.resolve({ id: "test" });
      },
    };
  },
}));

const PAYLOAD = '<img src=x onerror=alert(1)>';

describe("HTML de correos — escapado de datos de personas", () => {
  beforeEach(() => {
    enviados.length = 0;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("el cuerpo de una notificación no puede inyectar HTML", async () => {
    const { sendNotificacionEmail } = await import("../email");
    await sendNotificacionEmail(
      { asunto: PAYLOAD, cuerpo: PAYLOAD, tipo: "comentario_corredor" },
      { email: "a@b.cl", nombre: "Ana" },
    );

    expect(enviados).toHaveLength(1);
    // La etiqueta cruda no debe existir; sí su versión escapada.
    expect(enviados[0].html).not.toContain("<img src=x");
    expect(enviados[0].html).toContain("&lt;img src=x");
  });

  it("el mensaje libre del corredor al arrendatario va escapado", async () => {
    const { sendComentarioCorredorEmail } = await import("../email");
    await sendComentarioCorredorEmail({
      emailArrendatario:  "a@b.cl",
      nombreArrendatario: PAYLOAD,
      nombreCorredor:     "Corredor",
      direccionPropiedad: "Calle 1",
      texto:              PAYLOAD,
      tieneDocumentos:    false,
    });

    expect(enviados).toHaveLength(1);
    expect(enviados[0].html).not.toContain("<img src=x");
    expect(enviados[0].html).toContain("&lt;img src=x");
  });

  it("el formulario público de contacto no puede inyectar HTML", async () => {
    const { sendContactoCorredorEmail } = await import("../email");
    await sendContactoCorredorEmail({
      emailCorredor:  "c@b.cl",
      nombreCorredor: "Corredor",
      tituloPub:      PAYLOAD,
      nombre:         PAYLOAD,
      apellido:       PAYLOAD,
      telefono:       PAYLOAD,
      email:          "x@y.cl",
      titulo:         PAYLOAD,
      descripcion:    PAYLOAD,
      viaEmail:       true,
      viaTelefono:    false,
    });

    expect(enviados).toHaveLength(1);
    expect(enviados[0].html).not.toContain("<img src=x");
    expect(enviados[0].html).toContain("&lt;img src=x");
  });
});
