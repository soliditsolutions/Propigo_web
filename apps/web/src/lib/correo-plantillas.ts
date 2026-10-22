/**
 * Plantillas HTML de los correos de Propigo: funciones puras que reciben los
 * datos y devuelven el HTML final, sin enviar nada. Así se pueden testear y
 * previsualizar sin Resend.
 *
 * Diseño compatible con clientes de correo: tablas en vez de flex/grid,
 * estilos en línea, logo en PNG (Gmail y Outlook no muestran SVG) y botones
 * "a prueba de balas" (tabla con fondo, no solo un <a> con padding).
 *
 * SEGURIDAD: todo dato que venga de una persona pasa por esc() — los
 * formularios de contacto y denuncia del marketplace son públicos y el correo
 * sale desde nuestro dominio (vector de phishing si se pudiera inyectar HTML).
 */
import { MARCA, ESLOGAN, DOMINIO, COLOR, RAZON_SOCIAL } from "./marca";

export function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const FUENTE = "'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** URL absoluta del logo PNG (los correos no pueden usar rutas relativas). */
const logoUrl = (appUrl: string) => `${appUrl.replace(/\/$/, "")}/brand/propigo-logo-email.png`;

export function boton(href: string, texto: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr>
    <td style="border-radius:10px;background:${COLOR.azul}">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-family:${FUENTE};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${esc(texto)}</a>
    </td></tr></table>`;
}

export function cajaCodigo(etiqueta: string, codigo: string, nota: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0"><tr>
    <td align="center" style="background:${COLOR.azulSuave};border:1px solid #CFE0FB;border-radius:14px;padding:24px">
      <p style="margin:0;font-size:12px;color:${COLOR.textoSuave};text-transform:uppercase;letter-spacing:.08em">${esc(etiqueta)}</p>
      <p style="margin:10px 0;font-size:38px;font-weight:700;letter-spacing:.18em;color:${COLOR.marino};font-family:Consolas,'Courier New',monospace">${esc(codigo)}</p>
      <p style="margin:0;font-size:12px;color:${COLOR.textoSuave}">${esc(nota)}</p>
    </td></tr></table>`;
}

export function caja(contenidoHtml: string, tono: "neutro" | "exito" | "alerta" | "peligro" | "marca" = "neutro"): string {
  const t = {
    neutro:  { bg: COLOR.fondo,     bd: COLOR.borde, borde: "" },
    marca:   { bg: COLOR.fondo,     bd: COLOR.borde, borde: `border-left:4px solid ${COLOR.azul};` },
    exito:   { bg: "#ECFDF5",       bd: "#A7F3D0",   borde: "" },
    alerta:  { bg: "#FFFBEB",       bd: "#FDE68A",   borde: "" },
    peligro: { bg: "#FEF2F2",       bd: "#FECACA",   borde: "" },
  }[tono];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0"><tr>
    <td style="background:${t.bg};border:1px solid ${t.bd};${t.borde}border-radius:12px;padding:16px 18px">${contenidoHtml}</td></tr></table>`;
}

export const p = (html: string, estilo = "") =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#33415C;${estilo}">${html}</p>`;
export const pChico = (html: string) =>
  `<p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${COLOR.textoSuave}">${html}</p>`;
export const titulo = (texto: string) =>
  `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${COLOR.marino};font-weight:700">${texto}</h1>`;

/**
 * Marco común: franja de marca, logo, contenido y pie.
 * `pie` reemplaza el texto del pie (p. ej. el aviso de baja de las comunicaciones).
 */
export function plantilla(opts: { appUrl: string; preencabezado: string; contenido: string; pie?: string }): string {
  const { appUrl, preencabezado, contenido, pie } = opts;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(MARCA)}</title></head>
<body style="margin:0;padding:0;background:${COLOR.fondo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preencabezado)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.fondo}"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${COLOR.borde};border-radius:16px;overflow:hidden;font-family:${FUENTE}">
    <tr><td style="height:4px;line-height:4px;font-size:0;background:${COLOR.azul};background-image:linear-gradient(90deg,${COLOR.azul},${COLOR.azulClaro},${COLOR.cian})">&nbsp;</td></tr>
    <tr><td style="padding:26px 32px 6px"><img src="${esc(logoUrl(appUrl))}" width="150" height="40" alt="${esc(MARCA)}" style="display:block;border:0;outline:none;height:40px;width:150px"></td></tr>
    <tr><td style="padding:14px 32px 26px">${contenido}</td></tr>
    <tr><td style="padding:18px 32px 24px;border-top:1px solid ${COLOR.borde};background:#FAFCFF">
      ${pie ?? ""}
      <p style="margin:${pie ? "10px" : "0"} 0 0;font-size:11px;line-height:1.5;color:#8A96AE">${esc(MARCA)} · ${esc(ESLOGAN)}<br>${esc(DOMINIO)} · ${esc(RAZON_SOCIAL)} · Ley 21.719</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
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
export function pieConBaja(urlBaja?: string): string {
  const enviadoPor = `<p style="margin:0;font-size:12px;color:${COLOR.textoSuave}">Enviado por ${esc(MARCA)} en nombre de tu corredora.</p>`;
  if (!urlBaja) return enviadoPor;
  return `${enviadoPor}<p style="margin:6px 0 0;font-size:12px;color:${COLOR.textoSuave}">¿No quieres recibir estos avisos? <a href="${esc(urlBaja)}" style="color:${COLOR.azul}">Darte de baja aquí</a>.</p>`;
}

/** Fila etiqueta/valor para tablas de detalle (valor ya escapado por quien llama). */
export const fila = (etiqueta: string, valorHtml: string, sombreada = false) =>
  `<tr${sombreada ? ` style="background:${COLOR.fondo}"` : ""}><td style="padding:9px 12px;font-size:13px;color:${COLOR.textoSuave};font-weight:600;width:150px;vertical-align:top">${esc(etiqueta)}</td><td style="padding:9px 12px;font-size:14px;color:${COLOR.marino}">${valorHtml}</td></tr>`;

export const tabla = (filas: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 16px;border:1px solid ${COLOR.borde};border-radius:10px">${filas}</table>`;

export const etiquetaSeccion = (texto: string) =>
  `<p style="margin:0 0 8px;font-size:12px;color:${COLOR.textoSuave};text-transform:uppercase;letter-spacing:.06em">${esc(texto)}</p>`;
