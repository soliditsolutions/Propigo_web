/**
 * GET /api/salud — chequeo de salud para el balanceador / App Runner.
 *
 * Verifica que el proceso responde Y que llega a la base: un DATABASE_URL mal
 * configurado debe frenar el despliegue (la instancia nunca pasa a "sana"), no
 * publicar una app que falla en cada página. Público y sin datos: no expone
 * versión, errores ni nada del entorno (el detalle va solo al log).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const SIN_CACHE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return NextResponse.json({ estado: "ok" }, { headers: SIN_CACHE });
  } catch (e) {
    logError("salud", e);
    return NextResponse.json({ estado: "sin_base" }, { status: 503, headers: SIN_CACHE });
  }
}
