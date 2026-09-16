/**
 * POST /api/auth/dispositivo/enviar
 * Genera un código de 6 dígitos, lo guarda en DB (hasheado) y lo envía por email.
 * Puede llamarse desde /verificar-dispositivo al cargar la página o al presionar "Reenviar".
 * Requiere sesión JWT válida (sin deviceToken confirmado — por eso no pasa el middleware de device).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession, clearSessionCookie, clearDeviceCookie } from "@/lib/auth";
import { sendDeviceCodeEmail } from "@/lib/email";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant-db";
import { getClientIp } from "@/lib/ip";
import { logError } from "@/lib/logger";
import { generarCodigo, hashCodigo as hashCode } from "@/lib/codigo-verificacion";

function parseBrowser(ua: string): string {
  if (!ua) return "Navegador desconocido";
  if (ua.includes("Edg/"))    return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/"))return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  return "Navegador desconocido";
}

function parseOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac"))     return "macOS";
  if (ua.includes("iPhone"))  return "iPhone";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Linux"))   return "Linux";
  return "dispositivo desconocido";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    // AUD-02: sesión "fantasma" — el usuario referenciado en el JWT ya no
    // existe (cuenta eliminada / reset de datos). Sin este check, el
    // codigoDispositivo.create() de abajo lanza P2003 (FK) sin manejar.
    const usuarioExiste = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
      where: { id: session.sub }, select: { id: true },
    }));
    if (!usuarioExiste) {
      await clearSessionCookie();
      await clearDeviceCookie();
      return NextResponse.json(
        { error: "Tu sesión ya no es válida. Inicia sesión nuevamente.", errorCode: "SESION_INVALIDA" },
        { status: 401 },
      );
    }

    const ua      = req.headers.get("user-agent") ?? "";
    const ip      = getClientIp(req);
    const browser = `${parseBrowser(ua)} en ${parseOS(ua)}`;

    // ── Rate limiting ────────────────────────────────────────────────────────
    // Máximo 1 envío por minuto y máximo 5 en 10 minutos por usuario.
    // Protege contra inundación de emails y manipulación del flujo de verificación.
    const ahora       = new Date();
    const hace1min    = new Date(ahora.getTime() - 60 * 1000);
    const hace10min   = new Date(ahora.getTime() - 10 * 60 * 1000);

    const [reciente, totalRecientes] = await Promise.all([
      prisma.codigoDispositivo.findFirst({
        where: { usuarioId: session.sub, createdAt: { gt: hace1min } },
      }),
      prisma.codigoDispositivo.count({
        where: { usuarioId: session.sub, createdAt: { gt: hace10min } },
      }),
    ]);

    if (reciente) {
      const cooldownSec = Math.max(1, Math.ceil((reciente.createdAt.getTime() + 60_000 - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Espera al menos 1 minuto antes de solicitar otro código.", cooldownSec },
        { status: 429 },
      );
    }
    if (totalRecientes >= 5) {
      const earliest = await prisma.codigoDispositivo.findFirst({
        where:   { usuarioId: session.sub, createdAt: { gt: hace10min } },
        orderBy: { createdAt: "asc" },
        select:  { createdAt: true },
      });
      const cooldownSec = earliest
        ? Math.max(1, Math.ceil((earliest.createdAt.getTime() + 10 * 60_000 - Date.now()) / 1000))
        : 600;
      return NextResponse.json(
        { error: "Demasiados intentos. Espera antes de volver a intentarlo.", cooldownSec },
        { status: 429 },
      );
    }

    // Generar código de 6 dígitos y UUID pre-confirmación
    const codigo      = generarCodigo();
    const deviceToken = randomUUID();
    const codigoHash  = hashCode(codigo);
    const expiraAt    = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Invalidar códigos anteriores del usuario y crear el nuevo en una sola
    // transacción — evita que dos llamadas casi simultáneas (doble clic en
    // "Reenviar", reintento de red) dejen dos códigos sin usar a la vez para
    // el mismo usuario, lo que rompería la comparación por orden de creación
    // en /confirmar cuando ambas filas quedan con el mismo timestamp.
    await prisma.$transaction([
      prisma.codigoDispositivo.deleteMany({
        where: { usuarioId: session.sub, usadoAt: null },
      }),
      prisma.codigoDispositivo.create({
        data: {
          usuarioId:   session.sub,
          codigoHash,
          deviceToken,
          expiraAt,
        },
      }),
    ]);

    await sendDeviceCodeEmail(session.email, session.nombre, codigo, { ip, browser });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("dispositivo/enviar", e);
    return NextResponse.json({ error: "No se pudo enviar el código. Intenta de nuevo." }, { status: 500 });
  }
}
