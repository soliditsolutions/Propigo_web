/**
 * Capa de envío de email para Housing.
 * Dev: simula con console.log.
 * Prod: requiere RESEND_API_KEY — lanza error si no está configurado.
 *
 * SEGURIDAD: el dominio base SIEMPRE viene de NEXT_PUBLIC_APP_URL (variable de entorno),
 * NUNCA del header Host del request — mitiga Host Header Injection attacks.
 */

// Fallback SOLO para dev sin la variable configurada: 3000 es el puerto por
// defecto de `npm run dev` (documentado en README/guía local). En producción
// esta variable es obligatoria — ver runStartupChecks().
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Escapa texto antes de interpolarlo en el HTML de un correo.
 *
 * Todo lo que venga de una persona —nombres, direcciones, el texto libre de un
 * comentario, y sobre todo los formularios PÚBLICOS de contacto y denuncia del
 * marketplace— llega acá sin ninguna garantía. Sin escapar, quien envía el
 * formulario decide el HTML de un correo que sale desde nuestro dominio: es un
 * vector de phishing con la credibilidad de Housing detrás.
 */
function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Pie con la vía para dar de baja los avisos.
 *
 * Va en TODA comunicación de aviso (art. 28 B de la Ley 19.496: identificar al
 * remitente y ofrecer una vía para pedir la suspensión). NO va en los correos
 * de seguridad —código del portal, verificación de dispositivo, recuperación
 * de contraseña—: darse de baja del código con el que entras a tu cuenta te
 * deja fuera del sistema, y esos correos responden a una acción que la persona
 * acaba de hacer, no son comunicaciones que no pidió.
 */
function pieConBaja(urlBaja?: string): string {
  const remitente = `<p style="font-size:12px;color:#94A3B8;margin:0">Enviado por Housing SOLIDIT en nombre de tu corredora.</p>`;
  if (!urlBaja) return remitente;
  return `${remitente}
        <p style="font-size:12px;color:#94A3B8;margin:6px 0 0">
          ¿No quieres recibir estos avisos?
          <a href="${esc(urlBaja)}" style="color:#2563EB">Darte de baja aquí</a>.
        </p>`;
}

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

export async function sendPasswordResetEmail(
  email: string,
  rawToken: string,
): Promise<void> {
  const link = `${APP_URL}/nueva-contrasena?token=${encodeURIComponent(rawToken)}`;

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("📧  EMAIL SIMULADO — Recuperación de contraseña");
    console.log(`    Para   : ${email}`);
    console.log(`    Enlace : ${link}`);
    console.log(`    Válido : 15 minutos`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <no-reply@solidit.cl>",
    to:      email,
    subject: "Restablece tu contraseña de Housing",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px;color:#0F172A">Recupera tu contraseña</h2>
        <p style="color:#475569">Recibimos una solicitud para restablecer tu contraseña.</p>
        <div style="margin:24px 0">
          <a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
            Restablecer contraseña
          </a>
        </div>
        <p style="font-size:13px;color:#64748B">
          El enlace expira en <strong>15 minutos</strong> y solo puede usarse una vez.<br>
          Si no solicitaste esto, ignora este correo.
        </p>
        <p style="font-size:11px;color:#94A3B8;margin-top:16px">
          Si el botón no funciona, copia este enlace: ${link}
        </p>
      </div>
    `,
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
    console.log("\n──────────────────────────────────────────────────────");
    console.log("📧  EMAIL SIMULADO — Notificación");
    console.log(`    Para   : ${email} (${nombre})`);
    console.log(`    Asunto : ${notif.asunto}`);
    console.log(`    Tipo   : ${notif.tipo}`);
    console.log(`    Baja   : ${urlBaja ?? "(sin enlace)"}`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <notificaciones@solidit.cl>",
    to:      email,
    subject: notif.asunto,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em">Housing SOLIDIT</p>
        <h2 style="margin:0 0 16px;color:#0F172A">${esc(notif.asunto)}</h2>
        <p style="color:#475569;line-height:1.6">${esc(notif.cuerpo ?? "")}</p>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">
        ${pieConBaja(urlBaja)}
      </div>
    `,
  });
}

/** Envía el código OTP para el portal de autoconsulta. */
export async function sendPortalOtpEmail(
  email: string,
  nombre: string,
  codigo: string,
  direccion: string,
  rol: "arrendatario" | "propietario",
): Promise<void> {
  const rolLabel = rol === "arrendatario" ? "Arrendatario" : "Propietario";

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("🔑  EMAIL SIMULADO — Portal OTP");
    console.log(`    Para      : ${email} (${nombre})`);
    console.log(`    Código    : ${codigo}`);
    console.log(`    Propiedad : ${direccion}`);
    console.log(`    Rol       : ${rolLabel}`);
    console.log(`    Válido    : 10 minutos`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <no-reply@solidit.cl>",
    to:      email,
    subject: `${codigo}: tu código de acceso al portal`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px;color:#0F172A">Hola, ${esc(nombre)}</h2>
        <p style="color:#475569">Solicitaste acceso al portal de autoconsulta para la propiedad:</p>
        <p style="font-weight:600;color:#0F172A">${esc(direccion)}</p>
        <div style="background:#F1F5F9;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <p style="margin:0;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:.05em">Tu código de acceso (${rolLabel})</p>
          <p style="font-size:40px;font-weight:700;letter-spacing:.15em;color:#0F172A;margin:8px 0">${codigo}</p>
          <p style="margin:0;font-size:12px;color:#94A3B8">Válido por 10 minutos · Máximo 5 intentos</p>
        </div>
        <p style="font-size:12px;color:#94A3B8">
          Si no solicitaste este código, ignora este correo. Tus datos están seguros.
        </p>
      </div>
    `,
  });
}

/** Notifica al corredor sobre una nueva consulta de contacto desde el marketplace. */
export async function sendContactoCorredorEmail(opts: {
  emailCorredor: string;
  nombreCorredor: string;
  tituloPub: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  titulo: string;
  descripcion: string;
  viaEmail: boolean;
  viaTelefono: boolean;
}): Promise<void> {
  const { emailCorredor, nombreCorredor, tituloPub, nombre, apellido, telefono, email, titulo, descripcion, viaEmail, viaTelefono } = opts;
  const canales = [viaEmail && "Email", viaTelefono && "Teléfono"].filter(Boolean).join(" / ") || "Sin preferencia";

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("📬  EMAIL SIMULADO — Consulta de contacto al corredor");
    console.log(`    Para       : ${emailCorredor} (${nombreCorredor})`);
    console.log(`    Propiedad  : ${tituloPub}`);
    console.log(`    De         : ${nombre} ${apellido} <${email}>`);
    console.log(`    Teléfono   : ${telefono}`);
    console.log(`    Asunto     : ${titulo}`);
    console.log(`    Canales    : ${canales}`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <notificaciones@solidit.cl>",
    to:      emailCorredor,
    replyTo: email,
    subject: `Nueva consulta: ${titulo}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em">Housing SOLIDIT</p>
        <h2 style="margin:0 0 16px;color:#0F172A">Nueva consulta de contacto</h2>
        <p style="color:#475569">Recibiste una consulta sobre la propiedad <strong>${esc(tituloPub)}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
          <tr><td style="padding:8px 0;color:#64748B;width:120px">Nombre</td><td style="padding:8px 0;color:#0F172A;font-weight:600">${esc(nombre)} ${esc(apellido)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748B">Email</td><td style="padding:8px 0"><a href="mailto:${esc(email)}" style="color:#2563EB">${esc(email)}</a></td></tr>
          <tr><td style="padding:8px 0;color:#64748B">Teléfono</td><td style="padding:8px 0;color:#0F172A">${esc(telefono)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748B">Contactar por</td><td style="padding:8px 0;color:#0F172A">${canales}</td></tr>
          <tr><td style="padding:8px 0;color:#64748B">Asunto</td><td style="padding:8px 0;color:#0F172A;font-weight:600">${esc(titulo)}</td></tr>
        </table>
        <div style="background:#F8FAFC;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:0;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Mensaje</p>
          <p style="margin:0;color:#0F172A;line-height:1.6;white-space:pre-wrap">${esc(descripcion)}</p>
        </div>
        <p style="font-size:12px;color:#94A3B8;margin-top:16px">
          Puedes responder directamente a este correo para contactar al interesado.<br>
          Housing SOLIDIT · Gestión de arriendos
        </p>
      </div>
    `,
  });
}

/** Acuse de recibo al interesado después de enviar formulario de contacto. */
export async function sendAcuseContactoEmail(opts: {
  emailCliente: string;
  nombreCliente: string;
  tituloPub: string;
  nombreCorredor: string;
}): Promise<void> {
  const { emailCliente, nombreCliente, tituloPub, nombreCorredor } = opts;

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("📬  EMAIL SIMULADO — Acuse de recibo al cliente");
    console.log(`    Para       : ${emailCliente} (${nombreCliente})`);
    console.log(`    Propiedad  : ${tituloPub}`);
    console.log(`    Corredor   : ${nombreCorredor}`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <notificaciones@solidit.cl>",
    to:      emailCliente,
    subject: "Recibimos tu consulta",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em">Housing SOLIDIT</p>
        <h2 style="margin:0 0 8px;color:#0F172A">Recibimos tu consulta</h2>
        <p style="color:#475569">Hola, ${nombreCliente}. Tu consulta sobre la propiedad <strong>${esc(tituloPub)}</strong> fue enviada correctamente al corredor <strong>${esc(nombreCorredor)}</strong>.</p>
        <div style="background:#F0FDF4;border-radius:12px;padding:16px;margin:20px 0;border:1px solid #BBF7D0">
          <p style="margin:0;font-size:13px;color:#15803D">El corredor se pondrá en contacto contigo próximamente usando los canales que indicaste.</p>
        </div>
        <p style="font-size:12px;color:#94A3B8;margin-top:16px">
          Después de ser atendido, podrás valorar la atención del corredor usando el enlace que recibiste.<br>
          Housing SOLIDIT · Gestión de arriendos · Ley 21.719
        </p>
      </div>
    `,
  });
}

/** Envía denuncia al administrador de la plataforma (contacto@solidit.cl). */
export async function sendDenunciaAdminEmail(opts: {
  tipo: string;
  objetivo: string;
  descripcion: string;
  evidencia?: string;
  esAnonima: boolean;
  nombreDenunciante?: string;
  apellidoDenunciante?: string;
  emailDenunciante?: string;
  nombreCorredor?: string;
  tituloPub?: string;
  ip?: string;
}): Promise<void> {
  const { tipo, objetivo, descripcion, evidencia, esAnonima, nombreDenunciante, apellidoDenunciante, emailDenunciante, nombreCorredor, tituloPub, ip } = opts;
  const denunciante = esAnonima ? "Anónimo" : `${nombreDenunciante ?? ""} ${apellidoDenunciante ?? ""}`.trim() || "Sin nombre";
  const tipoLabel: Record<string, string> = {
    fraude_inmobiliario: "Fraude inmobiliario",
    estafa: "Estafa",
    informacion_falsa: "Información falsa",
    acoso: "Acoso",
    discriminacion: "Discriminación",
    incumplimiento: "Incumplimiento de contrato",
    otro: "Otro",
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("🚨  EMAIL SIMULADO — Denuncia al administrador");
    console.log(`    Tipo       : ${tipo}`);
    console.log(`    Objetivo   : ${objetivo}`);
    console.log(`    Denunciante: ${denunciante}`);
    console.log(`    Descripción: ${descripcion.substring(0, 60)}...`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <notificaciones@solidit.cl>",
    to:      "contacto@solidit.cl",
    subject: `[Denuncia] ${tipoLabel[tipo] ?? tipo}: ${objetivo === "propiedad" ? "propiedad" : "corredor"}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:16px;margin-bottom:20px">
          <p style="margin:0;font-weight:700;color:#991B1B;font-size:16px">⚠️ Nueva denuncia recibida</p>
          <p style="margin:4px 0 0;color:#B91C1C;font-size:13px">${new Date().toLocaleString("es-CL", { timeZone: "America/Santiago" })}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
          <tr style="background:#F8FAFC"><td style="padding:8px 12px;color:#64748B;font-weight:600;width:160px">Tipo de denuncia</td><td style="padding:8px 12px;color:#0F172A">${esc(tipoLabel[tipo] ?? tipo)}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748B;font-weight:600">Objetivo</td><td style="padding:8px 12px;color:#0F172A">${objetivo === "propiedad" ? "Propiedad" : "Corredor"}</td></tr>
          ${tituloPub ? `<tr style="background:#F8FAFC"><td style="padding:8px 12px;color:#64748B;font-weight:600">Propiedad</td><td style="padding:8px 12px;color:#0F172A">${esc(tituloPub)}</td></tr>` : ""}
          ${nombreCorredor ? `<tr><td style="padding:8px 12px;color:#64748B;font-weight:600">Corredor</td><td style="padding:8px 12px;color:#0F172A">${esc(nombreCorredor)}</td></tr>` : ""}
          <tr style="background:#F8FAFC"><td style="padding:8px 12px;color:#64748B;font-weight:600">Denunciante</td><td style="padding:8px 12px;color:#0F172A">${esc(denunciante)}${!esAnonima && emailDenunciante ? ` &lt;${esc(emailDenunciante)}&gt;` : ""}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748B;font-weight:600">IP origen</td><td style="padding:8px 12px;color:#0F172A">${esc(ip ?? "no disponible")}</td></tr>
        </table>
        <div style="background:#F8FAFC;border-radius:12px;padding:16px;margin-bottom:16px">
          <p style="margin:0 0 8px;font-size:12px;color:#64748B;text-transform:uppercase;letter-spacing:.05em">Descripción</p>
          <p style="margin:0;color:#0F172A;line-height:1.6;white-space:pre-wrap">${esc(descripcion)}</p>
        </div>
        ${evidencia ? `<div style="background:#FFFBEB;border-radius:12px;padding:16px;border:1px solid #FDE68A"><p style="margin:0 0 8px;font-size:12px;color:#92400E;text-transform:uppercase;letter-spacing:.05em">Evidencia aportada</p><p style="margin:0;color:#78350F;line-height:1.6">${esc(evidencia)}</p></div>` : ""}
        <p style="font-size:11px;color:#94A3B8;margin-top:20px">Esta denuncia fue recibida a través del formulario público de Housing. Evalúa su pertinencia antes de actuar.</p>
      </div>
    `,
  });
}

/** Notifica al arrendatario que el corredor dejó un comentario en su portal. */
export async function sendComentarioCorredorEmail(opts: {
  /** Enlace de baja; ver pieConBaja(). */
  urlBaja?: string;
  emailArrendatario: string;
  nombreArrendatario: string;
  nombreCorredor: string;
  direccionPropiedad: string;
  texto: string;
  tieneDocumentos: boolean;
}): Promise<void> {
  const { emailArrendatario, nombreArrendatario, nombreCorredor, direccionPropiedad, texto, tieneDocumentos } = opts;

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("📬  EMAIL SIMULADO — Comentario del corredor");
    console.log(`    Para       : ${emailArrendatario} (${nombreArrendatario})`);
    console.log(`    Corredor   : ${nombreCorredor}`);
    console.log(`    Propiedad  : ${direccionPropiedad}`);
    console.log(`    Documentos : ${tieneDocumentos ? "sí" : "no"}`);
    console.log(`    Mensaje    : ${texto.substring(0, 80)}...`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <notificaciones@solidit.cl>",
    to:      emailArrendatario,
    subject: "Tu corredor te dejó un mensaje",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <p style="margin:0 0 4px;font-size:12px;color:#94A3B8;text-transform:uppercase;letter-spacing:.05em">Housing SOLIDIT</p>
        <h2 style="margin:0 0 8px;color:#0F172A">Hola, ${esc(nombreArrendatario)}</h2>
        <p style="color:#475569">Tu corredor <strong>${esc(nombreCorredor)}</strong> te dejó un mensaje sobre la propiedad <strong>${direccionPropiedad}</strong>.</p>
        <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #2563EB">
          <p style="margin:0;color:#0F172A;line-height:1.6;white-space:pre-wrap">${esc(texto)}</p>
        </div>
        ${tieneDocumentos ? `<p style="color:#475569;font-size:13px">Este mensaje incluye documentos adjuntos. Accede a tu portal para descargarlos.</p>` : ""}
        <p style="font-size:12px;color:#94A3B8;margin-top:20px">
          Puedes ver este mensaje en tu portal de arrendatarios.
        </p>
        ${pieConBaja(opts.urlBaja)}
      </div>
    `,
  });
}

export async function sendDeviceCodeEmail(
  email: string,
  nombre: string,
  codigo: string,
  meta: { ip: string; browser: string },
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("🔐  EMAIL SIMULADO — Verificación de dispositivo");
    console.log(`    Para      : ${email} (${nombre})`);
    console.log(`    Código    : ${codigo}`);
    console.log(`    IP        : ${meta.ip}`);
    console.log(`    Navegador : ${meta.browser}`);
    console.log(`    Válido    : 10 minutos`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from:    "Housing SOLIDIT <no-reply@solidit.cl>",
    to:      email,
    subject: `${codigo}: verifica tu nuevo dispositivo`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Hola, ${esc(nombre)}</h2>
        <p style="color:#475569">Detectamos un acceso desde un nuevo dispositivo.</p>
        <div style="background:#F1F5F9;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <p style="margin:0;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:.05em">Tu código de verificación</p>
          <p style="font-size:40px;font-weight:700;letter-spacing:.15em;color:#0F172A;margin:8px 0">${codigo}</p>
          <p style="margin:0;font-size:12px;color:#94A3B8">Válido por 10 minutos · Máximo 3 intentos</p>
        </div>
        <p style="font-size:13px;color:#64748B">
          IP de origen: <strong>${meta.ip}</strong><br>
          Navegador: <strong>${meta.browser}</strong>
        </p>
        <p style="font-size:12px;color:#94A3B8">
          Si no reconoces este intento, ignora este correo y cambia tu contraseña.
        </p>
      </div>
    `,
  });
}

/** Invita a un colaborador a unirse a la cuenta del corredor (ADR-0013). */
export async function sendCollaboratorInviteEmail(
  email: string,
  nombre: string,
  rawToken: string,
  nombreEmpresa: string,
): Promise<void> {
  const link = `${APP_URL}/invitacion?token=${encodeURIComponent(rawToken)}`;

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("📧  EMAIL SIMULADO — Invitación a colaborador");
    console.log(`    Para     : ${email} (${nombre})`);
    console.log(`    Empresa  : ${nombreEmpresa}`);
    console.log(`    Enlace   : ${link}`);
    console.log(`    Válido   : 7 días`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const resend = await getResend();
  await resend.emails.send({
    from:    "Housing SOLIDIT <no-reply@solidit.cl>",
    to:      email,
    subject: `${nombreEmpresa} te invitó a unirte en Housing`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px;color:#0F172A">Hola, ${esc(nombre)}</h2>
        <p style="color:#475569"><strong>${nombreEmpresa}</strong> te invitó a colaborar en la gestión de sus propiedades en Housing.</p>
        <div style="margin:24px 0">
          <a href="${link}" style="display:inline-block;background:#2563EB;color:#fff;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none">
            Aceptar invitación
          </a>
        </div>
        <p style="font-size:13px;color:#64748B">
          El enlace expira en <strong>7 días</strong> y solo puede usarse una vez.<br>
          Si no esperabas esta invitación, ignora este correo.
        </p>
        <p style="font-size:11px;color:#94A3B8;margin-top:16px">
          Si el botón no funciona, copia este enlace: ${link}
        </p>
      </div>
    `,
  });
}

/** Envía el código de confirmación para cambiar teléfono o correo desde Mi perfil. */
export async function sendCambioContactoCodeEmail(
  email: string,
  nombre: string,
  codigo: string,
  campo: "telefono" | "email",
  valorNuevo: string,
): Promise<void> {
  const campoLabel = campo === "telefono" ? "teléfono" : "correo";

  if (process.env.NODE_ENV !== "production") {
    console.log("\n──────────────────────────────────────────────────────");
    console.log("🔐  EMAIL SIMULADO — Cambio de contacto");
    console.log(`    Para        : ${email} (${nombre})`);
    console.log(`    Código      : ${codigo}`);
    console.log(`    Campo       : ${campoLabel}`);
    console.log(`    Valor nuevo : ${valorNuevo}`);
    console.log(`    Válido      : 10 minutos`);
    console.log("──────────────────────────────────────────────────────\n");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from:    "Housing SOLIDIT <no-reply@solidit.cl>",
    to:      email,
    subject: `${codigo}: confirma tu cambio de ${campoLabel}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Hola, ${esc(nombre)}</h2>
        <p style="color:#475569">Pediste cambiar tu ${campoLabel} a <strong>${valorNuevo}</strong>.</p>
        <div style="background:#F1F5F9;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <p style="margin:0;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:.05em">Tu código de confirmación</p>
          <p style="font-size:40px;font-weight:700;letter-spacing:.15em;color:#0F172A;margin:8px 0">${codigo}</p>
          <p style="margin:0;font-size:12px;color:#94A3B8">Válido por 10 minutos · Máximo 3 intentos</p>
        </div>
        <p style="font-size:12px;color:#94A3B8">
          Si no fuiste tú, ignora este correo — tu ${campoLabel} no cambiará sin este código.
        </p>
      </div>
    `,
  });
}
