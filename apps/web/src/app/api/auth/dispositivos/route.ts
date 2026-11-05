/**
 * GET  /api/auth/dispositivos — lista los dispositivos confiables del usuario
 * DELETE /api/auth/dispositivos — elimina TODOS los dispositivos del usuario
 */
import { NextResponse } from "next/server";
import { getVerifiedSession, clearSessionCookie, clearDeviceCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";

export async function GET() {
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const dispositivos = await prisma.dispositivoConfiable.findMany({
      where:   { usuarioId: session.sub },
      select:  { id: true, nombre: true, ipCreacion: true, lastSeenAt: true, createdAt: true },
      orderBy: { lastSeenAt: "desc" },
    });

    return NextResponse.json({ dispositivos });
  } catch (e) {
    logError("dispositivos/listar", e);
    return NextResponse.json({ error: "No pudimos cargar tus dispositivos. Vuelve a intentarlo." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getVerifiedSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    await prisma.dispositivoConfiable.deleteMany({ where: { usuarioId: session.sub } });

    // Borrar cookies y forzar re-login + re-verificación
    await clearSessionCookie();
    await clearDeviceCookie();

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("dispositivos/eliminar-todos", e);
    return NextResponse.json({ error: "No pudimos eliminar los dispositivos. Vuelve a intentarlo." }, { status: 500 });
  }
}
