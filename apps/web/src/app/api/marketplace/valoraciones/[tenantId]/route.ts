import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit, respuestaLimite } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  // AUD-05: endpoint público sin límite alguno — scrapeable sin costo.
  const ip = getClientIp(req);
  const rl = checkRateLimit(`marketplace_valoraciones:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return respuestaLimite("Demasiadas solicitudes seguidas.", rl.retryAfter);
  }

  const { tenantId } = await params;
  if (!UUID_RE.test(tenantId)) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }

  try {
    const valoraciones = await prisma.valoracionCorredor.findMany({
      where:   { tenantId, esVisible: true },
      orderBy: { createdAt: "desc" },
      take:    20,
      select: {
        id:        true,
        estrellas: true,
        comentario: true,
        createdAt: true,
        nombre:    true,
        apellido:  true,
      },
    });

    const total = valoraciones.length;
    const promedio = total > 0
      ? Math.round((valoraciones.reduce((s, v) => s + v.estrellas, 0) / total) * 10) / 10
      : null;

    const distribucion = [1, 2, 3, 4, 5].map(n => ({
      estrellas: n,
      cantidad:  valoraciones.filter(v => v.estrellas === n).length,
    }));

    return NextResponse.json({ promedio, total, distribucion, valoraciones });
  } catch (e) {
    logError("marketplace/valoraciones", e);
    return NextResponse.json({ error: "No se pudieron cargar las valoraciones." }, { status: 500 });
  }
}
