/**
 * POST /api/auth/dispositivo/confirmar
 * Valida el código de 6 dígitos. Si es correcto:
 *  1. Crea DispositivoConfiable en DB
 *  2. Escribe cookie pgo_device (httpOnly, 1 año)
 *  3. Refresca el JWT con deviceToken embebido
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  getSession,
  setSessionCookie,
  clearSessionCookie,
  clearDeviceCookie,
  setDeviceCookie,
  refreshSessionWithDevice,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant-db";
import { getClientIp } from "@/lib/ip";
import { logError } from "@/lib/logger";
import { hashCodigo as hashCode } from "@/lib/codigo-verificacion";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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

  let codigo: string;
  try {
    const body = await req.json();
    codigo = (body.codigo ?? "").toString().trim();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!/^\d{6}$/.test(codigo)) {
    return NextResponse.json({ error: "El código debe tener 6 dígitos" }, { status: 400 });
  }

  try {
    // AUD-02: sesión "fantasma" — el usuario referenciado en el JWT ya no
    // existe (cuenta eliminada / reset de datos). Sin este check, el
    // dispositivoConfiable.create() de abajo lanza P2003 (FK) sin manejar.
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

    const codigoHash = hashCode(codigo);

    // Buscar el código más reciente sin usar, sin filtrar por expiración,
    // para poder distinguir EXPIRADO de AGOTADO en la respuesta al cliente.
    // Desempate por id además de createdAt: si dos códigos quedaran con el
    // mismo timestamp (ver fix de atomicidad en /enviar), el orden por
    // createdAt solo no es determinístico en Postgres.
    const registro = await prisma.codigoDispositivo.findFirst({
      where:   { usuarioId: session.sub, usadoAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    if (!registro) {
      return NextResponse.json(
        { error: "No hay código activo. Solicita uno nuevo.", errorCode: "AGOTADO" },
        { status: 400 },
      );
    }

    // Verificar expiración de forma explícita — el cliente distingue este caso
    // para mostrar "Código expirado" en lugar de "Intentos agotados".
    if (registro.expiraAt <= new Date()) {
      return NextResponse.json(
        { error: "Tu código expiró. Solicita uno nuevo.", errorCode: "EXPIRADO" },
        { status: 400 },
      );
    }

    // Bloqueo preventivo: si el registro ya llegó al límite (p.ej. por
    // una raza entre solicitudes concurrentes), cortar sin incrementar.
    if (registro.intentos >= 3) {
      return NextResponse.json(
        { error: "Demasiados intentos. Solicita un nuevo código.", errorCode: "AGOTADO" },
        { status: 429 },
      );
    }

    // Incrementar intentos atómicamente y obtener el valor post-incremento.
    const { intentos: intentosUsados } = await prisma.codigoDispositivo.update({
      where:  { id: registro.id },
      data:   { intentos: { increment: 1 } },
      select: { intentos: true },
    });

    if (registro.codigoHash !== codigoHash) {
      if (intentosUsados >= 3) {
        // Tercer intento incorrecto — invalidar para evitar más intentos.
        await prisma.codigoDispositivo.update({
          where: { id: registro.id },
          data:  { usadoAt: new Date() },
        });
        return NextResponse.json(
          { error: "Demasiados intentos. Solicita un nuevo código.", errorCode: "AGOTADO" },
          { status: 429 },
        );
      }
      const restantes = 3 - intentosUsados;
      return NextResponse.json(
        {
          error:             `Código incorrecto. ${restantes} intento${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""}.`,
          errorCode:         "INCORRECTO",
          intentosRestantes: restantes,
        },
        { status: 400 },
      );
    }

    // Código correcto — marcar como usado
    await prisma.codigoDispositivo.update({
      where: { id: registro.id },
      data:  { usadoAt: new Date() },
    });

    const ua          = req.headers.get("user-agent") ?? "";
    const ip          = getClientIp(req);
    const nombre      = `${parseBrowser(ua)} en ${parseOS(ua)}`;
    const deviceToken = registro.deviceToken;
    const tokenHash   = hashToken(deviceToken);

    // Registrar dispositivo confiable
    await prisma.dispositivoConfiable.create({
      data: {
        usuarioId:  session.sub,
        tokenHash,
        nombre,
        ipCreacion: ip,
      },
    });

    // Refrescar JWT con deviceToken y escribir ambas cookies
    const newJwt = await refreshSessionWithDevice(session, deviceToken);
    await setSessionCookie(newJwt);
    await setDeviceCookie(deviceToken);

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("dispositivo/confirmar", e);
    return NextResponse.json({ error: "No se pudo verificar el dispositivo. Intenta de nuevo." }, { status: 500 });
  }
}
