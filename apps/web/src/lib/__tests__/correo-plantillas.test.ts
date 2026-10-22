import { describe, it, expect } from "vitest";
import {
  htmlRecuperacion, htmlNotificacion, htmlPortalOtp, htmlContactoCorredor, htmlAcuseContacto,
  htmlDenuncia, htmlComentarioCorredor, htmlCodigoDispositivo, htmlInvitacion, htmlCambioContacto,
} from "../email";
import { COLOR, MARCA, ESLOGAN } from "../marca";

const APP = "https://propigo.cl";
const contacto = {
  emailCorredor: "c@b.cl", nombreCorredor: "Corredora", tituloPub: "Depto", nombre: "Ana", apellido: "Pérez",
  telefono: "+56 9 1111 2222", email: "ana@x.cl", titulo: "Visita", descripcion: "Hola", viaEmail: true, viaTelefono: false,
};

const todas: [string, string][] = [
  ["recuperación", htmlRecuperacion("https://propigo.cl/nueva-contrasena?token=t", APP)],
  ["notificación", htmlNotificacion({ asunto: "Recordatorio", cuerpo: "Vence pronto" }, "https://propigo.cl/no-molestar?t=1", APP)],
  ["portal", htmlPortalOtp("Ana", "123456", "Calle 1", "arrendatario", APP)],
  ["contacto", htmlContactoCorredor(contacto, APP)],
  ["acuse", htmlAcuseContacto({ emailCliente: "a@x.cl", nombreCliente: "Ana", tituloPub: "Depto", nombreCorredor: "Corredora" }, APP)],
  ["denuncia", htmlDenuncia({ tipo: "estafa", objetivo: "propiedad", descripcion: "x", esAnonima: true }, new Date("2026-10-22T12:00:00Z"), APP)],
  ["comentario", htmlComentarioCorredor({ emailArrendatario: "a@x.cl", nombreArrendatario: "Ana", nombreCorredor: "Corredora", direccionPropiedad: "Calle 1", texto: "Hola", tieneDocumentos: true, urlBaja: "https://propigo.cl/no-molestar?t=1" }, APP)],
  ["dispositivo", htmlCodigoDispositivo("Ana", "123456", { ip: "1.2.3.4", browser: "Chrome" }, APP)],
  ["invitación", htmlInvitacion("Ana", "Corredora", "https://propigo.cl/invitacion?token=t", APP)],
  ["cambio de contacto", htmlCambioContacto("Ana", "123456", "email", "nuevo@x.cl", APP)],
];

describe("plantillas de correo — marca", () => {
  it.each(todas)("%s: logo PNG con URL absoluta, azul de marca, eslogan y sin la marca anterior", (_n, html) => {
    expect(html).toContain(`src="${APP}/brand/propigo-logo-email.png"`);
    expect(html).toContain(`alt="${MARCA}"`);
    expect(html).toContain(COLOR.azul);
    expect(html).toContain(ESLOGAN);
    expect(html).not.toMatch(/housing/i);
    expect(html).not.toContain("#2563EB");
  });
});

describe("plantillas de correo — aviso de baja (art. 28 B Ley 19.496)", () => {
  it("las comunicaciones de aviso ofrecen darse de baja", () => {
    for (const nombre of ["notificación", "comentario"]) {
      const html = todas.find(([n]) => n === nombre)![1];
      expect(html, nombre).toContain("Darte de baja");
    }
  });

  it("los correos de seguridad nunca llevan baja", () => {
    for (const nombre of ["recuperación", "portal", "dispositivo", "cambio de contacto", "invitación"]) {
      const html = todas.find(([n]) => n === nombre)![1];
      expect(html, nombre).not.toContain("Darte de baja");
    }
  });
});

describe("plantillas de correo — enlaces", () => {
  it("el enlace del botón se escapa al ir en un atributo", () => {
    const html = htmlRecuperacion('https://propigo.cl/x?a="><script>', APP);
    expect(html).not.toContain('"><script>');
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });
});
