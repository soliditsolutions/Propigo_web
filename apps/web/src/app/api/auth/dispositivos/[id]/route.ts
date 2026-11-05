/**
 * DELETE /api/auth/dispositivos/[id] — elimina un dispositivo confiable específico.
 * Si el dispositivo eliminado es el actual, también limpia las cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  getVerifiedSession,
  DEVICE_COOKIE_NAME,
  clearSessionCookie,
  clearDeviceCookie,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";
import { idFiltro } from "@/lib/busqueda";
import { cookies } from "next/headers";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return await eliminarDispositivo(await params);
  } catch (e) {
    logError("dispositivos/eliminar", e);
    return NextResponse.json({ error: "No pudimos eliminar el dispositivo. Vuelve a intentarlo." }, { status: 500 });
  }
}

async function eliminarDispositivo({ id }: { id: string }) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!idFiltro(id)) {
    return NextResponse.json({ error: "Dispositivo no encontrado." }, { status: 404 });
  }

  const dispositivo = await prisma.dispositivoConfiable.findUnique({
    where: { id },
    select: { usuarioId: true, tokenHash: true },
  });

  if (!dispositivo || dispositivo.usuarioId !== session.sub) {
    return NextResponse.json({ error: "Dispositivo no encontrado." }, { status: 404 });
  }

  await prisma.dispositivoConfiable.delete({ where: { id } });

  // Detectar si el dispositivo eliminado es el actual
  const jar         = await cookies();
  const currentToken = jar.get(DEVICE_COOKIE_NAME)?.value ?? "";
  const currentHash  = createHash("sha256").update(currentToken).digest("hex");

  if (currentHash === dispositivo.tokenHash) {
    // El usuario eliminó su propio dispositivo activo → forzar re-verificación
    await clearSessionCookie();
    await clearDeviceCookie();
    return NextResponse.json({ ok: true, relogin: true });
  }

  return NextResponse.json({ ok: true, relogin: false });
}
