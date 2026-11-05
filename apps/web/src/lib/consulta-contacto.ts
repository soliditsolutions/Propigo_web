/**
 * Entrega al corredor de las consultas del marketplace (M-21, auditoría de
 * mensajes 2026-11).
 *
 * Antes el correo salía "en segundo plano" y si fallaba solo quedaba en el log:
 * la consulta se guardaba, el visitante leía "El corredor recibirá tu mensaje"
 * y el corredor nunca se enteraba. Ahora cada consulta lleva su estado de
 * entrega (`correoEnviadoEn`) y el cron de recordatorios reintenta las
 * pendientes, así la promesa que se le hace al visitante se cumple.
 *
 * Sin RLS: `consulta_contacto` no la tiene (la escribe un visitante sin sesión
 * de ningún tenant), por eso se usa el cliente global.
 */
import { prisma } from "@/lib/db";
import { sendContactoCorredorEmail } from "@/lib/email";
import { CORREO } from "@/lib/marca";
import { logError } from "@/lib/logger";

/** Intentos máximos por consulta (el primero es el de la ruta). */
export const MAX_INTENTOS_ENVIO = 6;
/** Pasada esta antigüedad una consulta no se reintenta: llegaría tarde y confundiría. */
export const VENTANA_REINTENTO_MS = 7 * 24 * 60 * 60_000;
/**
 * El cron no toca consultas más nuevas que esto: la ruta todavía puede estar
 * enviándolas y la reserva del intento ya lo impide, pero así ni siquiera
 * compiten por ella.
 */
export const ESPERA_ANTES_DE_REINTENTAR_MS = 5 * 60_000;
const LOTE_REINTENTO = 50;

/**
 * Correo de destino: el de contacto de la corredora o, si no tiene, el del
 * primer administrador (función SECURITY DEFINER, ADR-0011: `usuario` tiene
 * RLS y aquí no hay sesión de tenant). Último recurso: soporte, para que la
 * consulta no se pierda.
 */
async function correoDelCorredor(tenantId: string, emailContacto: string | null): Promise<string> {
  if (emailContacto) return emailContacto;
  const filas = await prisma.$queryRaw<{ marketplace_lookup_corredor_email_fallback: string | null }[]>`
    SELECT marketplace_lookup_corredor_email_fallback(${tenantId}::uuid)
  `;
  return filas[0]?.marketplace_lookup_corredor_email_fallback ?? CORREO.soporte;
}

export type ResultadoEntrega = "enviada" | "ya-enviada" | "fallida" | "sin-reserva";

/**
 * Intenta enviar el correo de una consulta. Nunca lanza: registra el error y
 * deja la consulta pendiente para el próximo reintento.
 *
 * El intento se reserva con un UPDATE condicional sobre `intentosEnvio`
 * (bloqueo optimista): si la ruta y el cron, o dos corridas del cron, llegan
 * a la vez, solo una gana la reserva y el corredor no recibe el correo dos veces.
 */
export async function entregarConsulta(consultaId: string): Promise<ResultadoEntrega> {
  try {
    const consulta = await prisma.consultaContacto.findUnique({
      where: { id: consultaId },
      include: {
        publicacion: { select: { titulo: true } },
        tenant:      { select: { id: true, nombre: true, emailContacto: true } },
      },
    });
    if (!consulta || consulta.correoEnviadoEn) return "ya-enviada";
    if (consulta.intentosEnvio >= MAX_INTENTOS_ENVIO) return "sin-reserva";

    const reserva = await prisma.consultaContacto.updateMany({
      where: { id: consultaId, correoEnviadoEn: null, intentosEnvio: consulta.intentosEnvio },
      data:  { intentosEnvio: { increment: 1 } },
    });
    if (reserva.count !== 1) return "sin-reserva";

    try {
      await sendContactoCorredorEmail({
        emailCorredor:  await correoDelCorredor(consulta.tenant.id, consulta.tenant.emailContacto),
        nombreCorredor: consulta.tenant.nombre,
        tituloPub:      consulta.publicacion.titulo,
        nombre:         consulta.nombre,
        apellido:       consulta.apellido,
        telefono:       consulta.telefono,
        email:          consulta.email,
        titulo:         consulta.titulo,
        descripcion:    consulta.descripcion,
        viaEmail:       consulta.viaEmail,
        viaTelefono:    consulta.viaTelefono,
      });
    } catch (err) {
      logError(`consulta-contacto/envio intento ${consulta.intentosEnvio + 1}`, err);
      return "fallida";
    }

    await prisma.consultaContacto.update({
      where: { id: consultaId },
      data:  { correoEnviadoEn: new Date() },
    });
    return "enviada";
  } catch (err) {
    logError("consulta-contacto/entregar", err);
    return "fallida";
  }
}

/** Reintenta las consultas pendientes recientes. Lo llama el cron. */
export async function reintentarConsultasPendientes(ahora: Date = new Date()): Promise<{
  pendientes: number; enviadas: number; fallidas: number;
}> {
  const pendientes = await prisma.consultaContacto.findMany({
    where: {
      correoEnviadoEn: null,
      intentosEnvio:   { lt: MAX_INTENTOS_ENVIO },
      createdAt: {
        gte: new Date(ahora.getTime() - VENTANA_REINTENTO_MS),
        lte: new Date(ahora.getTime() - ESPERA_ANTES_DE_REINTENTAR_MS),
      },
    },
    select:  { id: true },
    orderBy: { createdAt: "asc" },
    take:    LOTE_REINTENTO,
  });

  let enviadas = 0;
  let fallidas = 0;
  // En serie: un proveedor de correo caído responde rápido con error, y en
  // paralelo un lote grande podría gatillar su límite de envío.
  for (const { id } of pendientes) {
    const r = await entregarConsulta(id);
    if (r === "enviada") enviadas++;
    else if (r === "fallida") fallidas++;
  }
  return { pendientes: pendientes.length, enviadas, fallidas };
}
