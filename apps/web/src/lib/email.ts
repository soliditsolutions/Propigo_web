/**
 * Capa de envío de email de la plataforma.
 * Dev: simula con console.log.
 * Prod: requiere RESEND_API_KEY — lanza error si no está configurado.
 *
 * Cada correo tiene su función `html*` (pura, testeable y previsualizable) y
 * su función `send*` (decide simular o enviar). El diseño común vive en
 * correo-plantillas.ts.
 *
 * SEGURIDAD: el dominio base SIEMPRE viene de NEXT_PUBLIC_APP_URL (variable de entorno),
 * NUNCA del header Host del request — mitiga Host Header Injection attacks.
 */
import { MARCA, CORREO, COLOR, remitente } from "./marca";
import {
  esc, plantilla, boton, cajaCodigo, caja, p, pChico, titulo, pieConBaja, fila, tabla, etiquetaSeccion,
} from "./correo-plantillas";

// Fallback SOLO para dev sin la variable configurada: 3000 es el puerto por
// defecto de `npm run dev` (documentado en README/guía local). En producción
// esta variable es obligatoria — ver runStartupChecks().
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Retorna true cuando Resend está configurado (útil para UI). */
export function tieneEmailReal(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

async function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");
  const { Resend } = await import("resend");
  return new Resend(apiKey);
}

function simular(titulo: string, campos: Record<string, string>): void {
  console.log("\n──────────────────────────────────────────────────────");
  console.log(`📧  EMAIL SIMULADO — ${titulo}`);
  for (const [k, v] of Object.entries(campos)) console.log(`    ${k.padEnd(11)}: ${v}`);
  console.log("──────────────────────────────────────────────────────\n");
}

const enlaceDeRespaldo = (link: string) =>
  pChico(`Si el botón no funciona, copia este enlace en tu navegador:<br><span style="color:${COLOR.azul};word-break:break-all">${esc(link)}</span>`);

// ── Recuperación de contraseña ──────────────────────────────────────────────

export function htmlRecuperacion(link: string, appUrl = APP_URL): string {
  return plantilla({
    appUrl,
    preencabezado: "Restablece tu contraseña — el enlace vence en 15 minutos.",
    contenido:
      titulo("Recupera tu contraseña") +
      p("Recibimos una solicitud para restablecer la contraseña de tu cuenta.") +
      boton(link, "Restablecer contraseña") +
      pChico("El enlace expira en <strong>15 minutos</strong> y solo puede usarse una vez. Si no solicitaste esto, ignora este correo: tu contraseña no cambiará.") +
      enlaceDeRespaldo(link),
  });
}

export async function sendPasswordResetEmail(email: string, rawToken: string): Promise<void> {
  const link = `${APP_URL}/nueva-contrasena?token=${encodeURIComponent(rawToken)}`;
  if (process.env.NODE_ENV !== "production") {
    simular("Recuperación de contraseña", { Para: email, Enlace: link, Válido: "15 minutos" });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.noReply), to: email,
    subject: `Restablece tu contraseña de ${MARCA}`,
    html: htmlRecuperacion(link),
  });
}

// ── Notificación (recordatorio, voucher, liquidación, etc.) ─────────────────

export function htmlNotificacion(notif: { asunto: string; cuerpo: string | null }, urlBaja?: string, appUrl = APP_URL): string {
  return plantilla({
    appUrl,
    preencabezado: notif.asunto,
    contenido: titulo(esc(notif.asunto)) + p(esc(notif.cuerpo ?? ""), "white-space:pre-wrap"),
    pie: pieConBaja(urlBaja),
  });
}

/** Envía email de notificación (recordatorio, voucher, liquidación, etc.) */
export async function sendNotificacionEmail(
  notif: { asunto: string; cuerpo: string | null; tipo: string },
  persona: { email: string; nombre: string },
  urlBaja?: string,
): Promise<void> {
  const { email, nombre } = persona;
  if (process.env.NODE_ENV !== "production") {
    simular("Notificación", { Para: `${email} (${nombre})`, Asunto: notif.asunto, Tipo: notif.tipo, Baja: urlBaja ?? "(sin enlace)" });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.notificaciones), to: email,
    subject: notif.asunto,
    html: htmlNotificacion(notif, urlBaja),
  });
}

// ── Código del portal de autoconsulta ───────────────────────────────────────

export function htmlPortalOtp(nombre: string, codigo: string, direccion: string, rol: "arrendatario" | "propietario", appUrl = APP_URL): string {
  const rolLabel = rol === "arrendatario" ? "Arrendatario" : "Propietario";
  return plantilla({
    appUrl,
    preencabezado: `${codigo} es tu código de acceso al portal.`,
    contenido:
      titulo(`Hola, ${esc(nombre)}`) +
      p("Solicitaste acceso al portal de autoconsulta para la propiedad:") +
      p(`<strong style="color:${COLOR.marino}">${esc(direccion)}</strong>`) +
      cajaCodigo(`Tu código de acceso (${rolLabel})`, codigo, "Válido por 10 minutos · Máximo 5 intentos") +
      pChico("Si no solicitaste este código, ignora este correo. Tus datos están seguros."),
  });
}

/** Envía el código OTP para el portal de autoconsulta. */
export async function sendPortalOtpEmail(
  email: string, nombre: string, codigo: string, direccion: string, rol: "arrendatario" | "propietario",
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    simular("Portal OTP", { Para: `${email} (${nombre})`, Código: codigo, Propiedad: direccion, Rol: rol === "arrendatario" ? "Arrendatario" : "Propietario", Válido: "10 minutos" });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.noReply), to: email,
    subject: `${codigo}: tu código de acceso al portal`,
    html: htmlPortalOtp(nombre, codigo, direccion, rol),
  });
}

// ── Consulta del marketplace al corredor ────────────────────────────────────

type DatosContacto = {
  emailCorredor: string; nombreCorredor: string; tituloPub: string;
  nombre: string; apellido: string; telefono: string; email: string;
  titulo: string; descripcion: string; viaEmail: boolean; viaTelefono: boolean;
};

const canalesDe = (o: { viaEmail: boolean; viaTelefono: boolean }) =>
  [o.viaEmail && "Email", o.viaTelefono && "Teléfono"].filter(Boolean).join(" / ") || "Sin preferencia";

export function htmlContactoCorredor(o: DatosContacto, appUrl = APP_URL): string {
  return plantilla({
    appUrl,
    preencabezado: `Nueva consulta sobre ${o.tituloPub}`,
    contenido:
      titulo("Nueva consulta de contacto") +
      p(`Recibiste una consulta sobre la propiedad <strong>${esc(o.tituloPub)}</strong>.`) +
      tabla(
        fila("Nombre", `<strong>${esc(o.nombre)} ${esc(o.apellido)}</strong>`, true) +
        fila("Email", `<a href="mailto:${esc(o.email)}" style="color:${COLOR.azul}">${esc(o.email)}</a>`) +
        fila("Teléfono", esc(o.telefono), true) +
        fila("Contactar por", esc(canalesDe(o))) +
        fila("Asunto", `<strong>${esc(o.titulo)}</strong>`, true),
      ) +
      caja(etiquetaSeccion("Mensaje") + p(esc(o.descripcion), "margin:0;white-space:pre-wrap"), "marca") +
      pChico("Puedes responder directamente a este correo para contactar al interesado."),
  });
}

/** Notifica al corredor sobre una nueva consulta de contacto desde el marketplace. */
export async function sendContactoCorredorEmail(opts: DatosContacto): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    simular("Consulta de contacto al corredor", {
      Para: `${opts.emailCorredor} (${opts.nombreCorredor})`, Propiedad: opts.tituloPub,
      De: `${opts.nombre} ${opts.apellido} <${opts.email}>`, Teléfono: opts.telefono,
      Asunto: opts.titulo, Canales: canalesDe(opts),
    });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.notificaciones), to: opts.emailCorredor, replyTo: opts.email,
    subject: `Nueva consulta: ${opts.titulo}`,
    html: htmlContactoCorredor(opts),
  });
}

// ── Acuse de recibo al interesado ───────────────────────────────────────────

type DatosAcuse = { emailCliente: string; nombreCliente: string; tituloPub: string; nombreCorredor: string };

export function htmlAcuseContacto(o: DatosAcuse, appUrl = APP_URL): string {
  return plantilla({
    appUrl,
    preencabezado: "Tu consulta llegó al corredor.",
    contenido:
      titulo("Recibimos tu consulta") +
      p(`Hola, ${esc(o.nombreCliente)}. Tu consulta sobre la propiedad <strong>${esc(o.tituloPub)}</strong> fue enviada correctamente al corredor <strong>${esc(o.nombreCorredor)}</strong>.`) +
      caja(p("El corredor se pondrá en contacto contigo próximamente usando los canales que indicaste.", "margin:0;color:#166534;font-size:14px"), "exito") +
      pChico("Después de ser atendido, podrás valorar la atención del corredor usando el enlace que recibirás."),
  });
}

/** Acuse de recibo al interesado después de enviar formulario de contacto. */
export async function sendAcuseContactoEmail(opts: DatosAcuse): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    simular("Acuse de recibo al cliente", { Para: `${opts.emailCliente} (${opts.nombreCliente})`, Propiedad: opts.tituloPub, Corredor: opts.nombreCorredor });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.notificaciones), to: opts.emailCliente,
    subject: "Recibimos tu consulta",
    html: htmlAcuseContacto(opts),
  });
}

// ── Denuncia al equipo de la plataforma ─────────────────────────────────────

type DatosDenuncia = {
  tipo: string; objetivo: string; descripcion: string; evidencia?: string; esAnonima: boolean;
  nombreDenunciante?: string; apellidoDenunciante?: string; emailDenunciante?: string;
  nombreCorredor?: string; tituloPub?: string; ip?: string;
};

const TIPO_DENUNCIA: Record<string, string> = {
  fraude_inmobiliario: "Fraude inmobiliario",
  estafa: "Estafa",
  informacion_falsa: "Información falsa",
  acoso: "Acoso",
  discriminacion: "Discriminación",
  incumplimiento: "Incumplimiento de contrato",
  otro: "Otro",
};

const denuncianteDe = (o: DatosDenuncia) =>
  o.esAnonima ? "Anónimo" : `${o.nombreDenunciante ?? ""} ${o.apellidoDenunciante ?? ""}`.trim() || "Sin nombre";

export function htmlDenuncia(o: DatosDenuncia, recibida: Date, appUrl = APP_URL): string {
  const fecha = recibida.toLocaleString("es-CL", { timeZone: "America/Santiago" });
  const denunciante = denuncianteDe(o);
  return plantilla({
    appUrl,
    preencabezado: `Nueva denuncia: ${TIPO_DENUNCIA[o.tipo] ?? o.tipo}`,
    contenido:
      caja(
        p(`<strong style="color:#991B1B">Nueva denuncia recibida</strong>`, "margin:0;font-size:16px") +
        p(esc(fecha), "margin:4px 0 0;color:#B91C1C;font-size:13px"),
        "peligro",
      ) +
      tabla(
        fila("Tipo de denuncia", esc(TIPO_DENUNCIA[o.tipo] ?? o.tipo), true) +
        fila("Objetivo", o.objetivo === "propiedad" ? "Propiedad" : "Corredor") +
        (o.tituloPub ? fila("Propiedad", esc(o.tituloPub), true) : "") +
        (o.nombreCorredor ? fila("Corredor", esc(o.nombreCorredor)) : "") +
        fila("Denunciante", `${esc(denunciante)}${!o.esAnonima && o.emailDenunciante ? ` &lt;${esc(o.emailDenunciante)}&gt;` : ""}`, true) +
        fila("IP origen", esc(o.ip ?? "no disponible")),
      ) +
      caja(etiquetaSeccion("Descripción") + p(esc(o.descripcion), "margin:0;white-space:pre-wrap")) +
      (o.evidencia ? caja(etiquetaSeccion("Evidencia aportada") + p(esc(o.evidencia), "margin:0;color:#78350F"), "alerta") : "") +
      pChico(`Esta denuncia fue recibida a través del formulario público de ${esc(MARCA)}. Evalúa su pertinencia antes de actuar.`),
  });
}

/** Envía denuncia al equipo de la plataforma (CORREO.denuncias). */
export async function sendDenunciaAdminEmail(opts: DatosDenuncia): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    simular("Denuncia al administrador", { Tipo: opts.tipo, Objetivo: opts.objetivo, Denunciante: denuncianteDe(opts), Descripción: `${opts.descripcion.substring(0, 60)}...` });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.notificaciones), to: CORREO.denuncias,
    subject: `[Denuncia] ${TIPO_DENUNCIA[opts.tipo] ?? opts.tipo}: ${opts.objetivo === "propiedad" ? "propiedad" : "corredor"}`,
    html: htmlDenuncia(opts, new Date()),
  });
}

// ── Mensaje del corredor al arrendatario ────────────────────────────────────

type DatosComentario = {
  /** Enlace de baja; ver pieConBaja(). */
  urlBaja?: string;
  emailArrendatario: string; nombreArrendatario: string; nombreCorredor: string;
  direccionPropiedad: string; texto: string; tieneDocumentos: boolean;
};

export function htmlComentarioCorredor(o: DatosComentario, appUrl = APP_URL): string {
  return plantilla({
    appUrl,
    preencabezado: `${o.nombreCorredor} te dejó un mensaje.`,
    contenido:
      titulo(`Hola, ${esc(o.nombreArrendatario)}`) +
      p(`Tu corredor <strong>${esc(o.nombreCorredor)}</strong> te dejó un mensaje sobre la propiedad <strong>${esc(o.direccionPropiedad)}</strong>.`) +
      caja(p(esc(o.texto), "margin:0;white-space:pre-wrap"), "marca") +
      (o.tieneDocumentos ? p("Este mensaje incluye documentos adjuntos. Ingresa a tu portal para descargarlos.", "font-size:14px") : "") +
      boton(`${appUrl.replace(/\/$/, "")}/portal`, "Ir a mi portal"),
    pie: pieConBaja(o.urlBaja),
  });
}

/** Notifica al arrendatario que el corredor dejó un comentario en su portal. */
export async function sendComentarioCorredorEmail(opts: DatosComentario): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    simular("Comentario del corredor", {
      Para: `${opts.emailArrendatario} (${opts.nombreArrendatario})`, Corredor: opts.nombreCorredor,
      Propiedad: opts.direccionPropiedad, Documentos: opts.tieneDocumentos ? "sí" : "no", Mensaje: `${opts.texto.substring(0, 80)}...`,
    });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.notificaciones), to: opts.emailArrendatario,
    subject: "Tu corredor te dejó un mensaje",
    html: htmlComentarioCorredor(opts),
  });
}

// ── Verificación de dispositivo ─────────────────────────────────────────────

export function htmlCodigoDispositivo(nombre: string, codigo: string, meta: { ip: string; browser: string }, appUrl = APP_URL): string {
  return plantilla({
    appUrl,
    preencabezado: `${codigo} es tu código para verificar el nuevo dispositivo.`,
    contenido:
      titulo(`Hola, ${esc(nombre)}`) +
      p("Detectamos un inicio de sesión desde un dispositivo nuevo. Ingresa este código para confirmarlo:") +
      cajaCodigo("Tu código de verificación", codigo, "Válido por 10 minutos · Máximo 3 intentos") +
      tabla(fila("IP de origen", esc(meta.ip), true) + fila("Navegador", esc(meta.browser))) +
      pChico("Si no reconoces este intento, ignora este correo y cambia tu contraseña."),
  });
}

export async function sendDeviceCodeEmail(
  email: string, nombre: string, codigo: string, meta: { ip: string; browser: string },
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    simular("Verificación de dispositivo", { Para: `${email} (${nombre})`, Código: codigo, IP: meta.ip, Navegador: meta.browser, Válido: "10 minutos" });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.noReply), to: email,
    subject: `${codigo}: verifica tu nuevo dispositivo`,
    html: htmlCodigoDispositivo(nombre, codigo, meta),
  });
}

// ── Invitación a colaborador ────────────────────────────────────────────────

export function htmlInvitacion(nombre: string, nombreEmpresa: string, link: string, appUrl = APP_URL): string {
  return plantilla({
    appUrl,
    preencabezado: `${nombreEmpresa} te invitó a ${MARCA}.`,
    contenido:
      titulo(`Hola, ${esc(nombre)}`) +
      p(`<strong>${esc(nombreEmpresa)}</strong> te invitó a colaborar en la gestión de sus propiedades en ${esc(MARCA)}.`) +
      boton(link, "Aceptar invitación") +
      pChico("El enlace expira en <strong>7 días</strong> y solo puede usarse una vez. Si no esperabas esta invitación, ignora este correo.") +
      enlaceDeRespaldo(link),
  });
}

/** Invita a un colaborador a unirse a la cuenta del corredor (ADR-0013). */
export async function sendCollaboratorInviteEmail(
  email: string, nombre: string, rawToken: string, nombreEmpresa: string,
): Promise<void> {
  const link = `${APP_URL}/invitacion?token=${encodeURIComponent(rawToken)}`;
  if (process.env.NODE_ENV !== "production") {
    simular("Invitación a colaborador", { Para: `${email} (${nombre})`, Empresa: nombreEmpresa, Enlace: link, Válido: "7 días" });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.noReply), to: email,
    subject: `${nombreEmpresa} te invitó a unirte en ${MARCA}`,
    html: htmlInvitacion(nombre, nombreEmpresa, link),
  });
}

// ── Cambio de teléfono o correo ─────────────────────────────────────────────

export function htmlCambioContacto(nombre: string, codigo: string, campo: "telefono" | "email", valorNuevo: string, appUrl = APP_URL): string {
  const campoLabel = campo === "telefono" ? "teléfono" : "correo";
  return plantilla({
    appUrl,
    preencabezado: `${codigo} confirma el cambio de tu ${campoLabel}.`,
    contenido:
      titulo(`Hola, ${esc(nombre)}`) +
      p(`Pediste cambiar tu ${campoLabel} a <strong>${esc(valorNuevo)}</strong>.`) +
      cajaCodigo("Tu código de confirmación", codigo, "Válido por 10 minutos · Máximo 3 intentos") +
      pChico(`Si no fuiste tú, ignora este correo: tu ${campoLabel} no cambiará sin este código.`),
  });
}

/** Envía el código de confirmación para cambiar teléfono o correo desde Mi perfil. */
export async function sendCambioContactoCodeEmail(
  email: string, nombre: string, codigo: string, campo: "telefono" | "email", valorNuevo: string,
): Promise<void> {
  const campoLabel = campo === "telefono" ? "teléfono" : "correo";
  if (process.env.NODE_ENV !== "production") {
    simular("Cambio de contacto", { Para: `${email} (${nombre})`, Código: codigo, Campo: campoLabel, "Valor nuevo": valorNuevo, Válido: "10 minutos" });
    return;
  }
  const resend = await getResend();
  await resend.emails.send({
    from: remitente(CORREO.noReply), to: email,
    subject: `${codigo}: confirma tu cambio de ${campoLabel}`,
    html: htmlCambioContacto(nombre, codigo, campo, valorNuevo),
  });
}
