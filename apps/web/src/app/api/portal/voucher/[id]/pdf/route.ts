/**
 * GET /api/portal/voucher/[id]/pdf — comprobante en PDF para el portal.
 *
 * La otra mitad de L-CP8: el arrendatario y el propietario descargan su propio
 * comprobante desde el portal, no solo el corredor desde el panel.
 *
 * Seguridad (mismo criterio que /api/portal/documento):
 *  1. Sesión de portal válida (hw_portal).
 *  2. El voucher pertenece a un contrato de esta persona, y del tipo que le
 *     corresponde: el arrendatario ve el comprobante de PAGO; el propietario, la
 *     LIQUIDACIÓN. Un arrendatario nunca ve la liquidación (lleva la comisión).
 *  3. Registra el acceso (Ley 21.719).
 *  4. Se regenera desde el snapshot; nunca se cachea en CDN.
 */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPortalSession } from "@/lib/portal-auth";
import { withTenant } from "@/lib/tenant-db";
import { getClientIp } from "@/lib/ip";
import { logError } from "@/lib/logger";
import { ComprobantePdfDocument } from "@/lib/comprobante-pdf";
import { idFiltro } from "@/lib/busqueda";
import type { SnapshotPago, SnapshotLiquidacion } from "@/lib/comprobante";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  if (!idFiltro(id)) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }
  const { personaId, tenantId, rol } = session;

  // El tipo permitido depende del rol: el arrendatario paga (comprobante de
  // pago), al propietario se le liquida. Es lo que impide que el arrendatario
  // vea la liquidación, que incluye la comisión de la corredora.
  const tipoPermitido = rol === "arrendatario" ? "pago" : "liquidacion";
  const whereContrato = rol === "arrendatario"
    ? { tenantId, arrendatarioId: personaId }
    : { tenantId, propietarioId: personaId };

  const voucher = await withTenant(tenantId, async (tx) => {
    const v = await tx.voucher.findFirst({
      where:  { id, tenantId, tipo: tipoPermitido },
      select: { id: true, folio: true, snapshot: true, tipo: true, contratoId: true },
    });
    if (!v) return null;
    // El contrato del voucher debe ser de esta persona.
    const c = await tx.contrato.findFirst({ where: { id: v.contratoId, ...whereContrato }, select: { id: true } });
    return c ? v : null;
  });

  if (!voucher) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  const snapshot = voucher.snapshot as unknown as (SnapshotPago | SnapshotLiquidacion) & { emisor?: unknown };
  if (!voucher.folio || !snapshot?.emisor) {
    return NextResponse.json(
      { error: "Este comprobante es anterior al formato PDF." },
      { status: 409 },
    );
  }

  // Registro de acceso (Ley 21.719), como el resto de las vistas del portal.
  await withTenant(tenantId, (tx) => tx.accesoLog.create({
    data: { tenantId, personaId, accion: "portal_descarga_comprobante", ip: getClientIp(req) },
  })).catch((e) => logError("portal-voucher-pdf/accesoLog", e));

  let buffer;
  try {
    buffer = await renderToBuffer(ComprobantePdfDocument({ snapshot }));
  } catch (e) {
    logError(`portal-voucher-pdf/${id}`, e);
    return NextResponse.json({ error: "No pudimos generar el PDF." }, { status: 500 });
  }

  const fileName = `${voucher.folio}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":           "application/pdf",
      "Content-Disposition":    `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control":          "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
