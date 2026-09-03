/**
 * GET /api/cron/recordatorios
 * Endpoint para automatización de recordatorios (Vercel Cron, cron-job.org, etc.).
 * Genera recordatorios pendientes y envía los emails para TODOS los tenants activos.
 *
 * FIX M3 — Cron sin autenticación en desarrollo:
 * El secreto se exige siempre que CRON_SECRET esté definido, en cualquier
 * entorno. Antes solo se comprobaba en producción, dejando el endpoint
 * completamente abierto en desarrollo.
 *
 * FIX C1 — Multi-tenancy en cron:
 * Las funciones de notificación ya no llaman a getTenant() (que lee sesión
 * de usuario); en su lugar el cron itera todos los tenants explícitamente
 * con getAllTenantsForSystem().
 *
 * SEGURIDAD: configurar CRON_SECRET en todas las variables de entorno.
 */
import { NextRequest, NextResponse } from "next/server";
import { generarRecordatorios, enviarNotificacionesPendientes } from "@/app/panel/notificaciones/actions";
import { getAllTenantsForSystem } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { purgarDatosVencidos, purgaVacia, sumarPurgas } from "@/lib/retencion-purga";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  // En producción CRON_SECRET es obligatorio (runStartupChecks() ya valida esto,
  // pero se dobla la verificación aquí como defensa en profundidad).
  if (isProd && !secret) {
    return NextResponse.json({ error: "Configuración de servidor incompleta." }, { status: 500 });
  }

  // Exigir secreto siempre que esté configurado
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }
  }

  try {
    const tenants = await getAllTenantsForSystem();

    // Procesar cada tenant de forma independiente para que un error en uno
    // no bloquee los demás.
    const resultados = await Promise.allSettled(
      tenants.map(async (tenant) => {
        const [generados, enviados] = await Promise.all([
          generarRecordatorios(tenant),
          enviarNotificacionesPendientes(tenant),
        ]);
        // Retención (L-DP1): aplica los plazos que la política de privacidad
        // publica. Va después de notificar y en su propia transacción, para que
        // un fallo acá no impida que salgan los avisos del día.
        const purgado = await withTenant(tenant.id, (tx) =>
          purgarDatosVencidos(tx, tenant.id),
        );
        return { tenantId: tenant.id, generados, enviados, purgado };
      }),
    );

    const resumen = resultados.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { tenantId: tenants[i]?.id ?? "unknown", error: String(r.reason) };
    });

    // Total de lo purgado, para poder verificar de un vistazo que el proceso
    // de retención efectivamente está borrando algo.
    const purgado = resultados.reduce(
      (acc, r) => (r.status === "fulfilled" ? sumarPurgas(acc, r.value.purgado) : acc),
      purgaVacia(),
    );

    return NextResponse.json({
      ok:        true,
      tenants:   tenants.length,
      purgado,
      resumen,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    logError("cron/recordatorios", e);
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}
