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

  it("el User-Agent no puede inyectar HTML en el correo de dispositivo", async () => {
    // parseBrowser() deriva de un header que el cliente controla por completo.
    // Es la superficie más expuesta del módulo, y el primer barrido la omitió.
    const { sendDeviceCodeEmail } = await import("../email");
    await sendDeviceCodeEmail("v@x.cl", "Victima", "123456", {
      ip: "1.2.3.4", browser: PAYLOAD,
    });

    expect(enviados).toHaveLength(1);
    expect(enviados[0].html).not.toContain("<img src=x");
    expect(enviados[0].html).toContain("&lt;img src=x");
  });

  it("una IP forjada por cabecera tampoco inyecta", async () => {
    const { sendDeviceCodeEmail } = await import("../email");
    await sendDeviceCodeEmail("v@x.cl", "Victima", "123456", {
      ip: PAYLOAD, browser: "Chrome",
    });

    expect(enviados[0].html).not.toContain("<img src=x");
  });

  it("el nombre de la corredora no inyecta en la invitación a un colaborador", async () => {
    const { sendCollaboratorInviteEmail } = await import("../email");
    // Firma: (email, nombre, rawToken, nombreEmpresa)
    await sendCollaboratorInviteEmail("c@b.cl", "Colab", "tok", PAYLOAD);

    expect(enviados[0].html).not.toContain("<img src=x");
    expect(enviados[0].html).toContain("&lt;img src=x");
  });

  it("el nombre del interesado (formulario público) no inyecta en el acuse de contacto", async () => {
    const { sendAcuseContactoEmail } = await import("../email");
    await sendAcuseContactoEmail({
      emailCliente: "x@y.cl", nombreCliente: PAYLOAD, tituloPub: "Depto", nombreCorredor: "Corredor",
    });

    expect(enviados[0].html).not.toContain("<img src=x");
    expect(enviados[0].html).toContain("&lt;img src=x");
  });

  it("la dirección de la propiedad no inyecta en el mensaje del corredor", async () => {
    const { sendComentarioCorredorEmail } = await import("../email");
    await sendComentarioCorredorEmail({
      emailArrendatario: "a@b.cl", nombreArrendatario: "Ana", nombreCorredor: "Corredor",
      direccionPropiedad: PAYLOAD, texto: "Hola", tieneDocumentos: false,
    });

    expect(enviados[0].html).not.toContain("<img src=x");
    expect(enviados[0].html).toContain("&lt;img src=x");
  });
});
