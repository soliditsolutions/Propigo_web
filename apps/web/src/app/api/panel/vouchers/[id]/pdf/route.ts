/**
 * GET /api/panel/vouchers/[id]/pdf — comprobante de pago o liquidación en PDF.
 *
 * El PDF se regenera desde el `snapshot` del voucher en cada descarga (L-CP7):
 * el snapshot es el dato permanente, el archivo es solo su representación. Por
 * eso no se guarda ni se cachea a nivel de archivo — se dibuja al vuelo.
 *
 * Mismo criterio de ownership que el resto de /panel (ADR-0013 Fase D): un
 * Colaborador solo accede a vouchers de propiedades que tiene asignadas; si no,
 * 404 (no 403 — no revela que el voucher existe).
 */
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { ComprobantePdfDocument } from "@/lib/comprobante-pdf";
import { idFiltro } from "@/lib/busqueda";
import type { SnapshotPago, SnapshotLiquidacion } from "@/lib/comprobante";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idFiltro(id)) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  let actor;
  try {
    actor = await getActor();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const voucher = await withTenant(actor.tenantId, (tx) => tx.voucher.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: {
      folio: true, snapshot: true, tipo: true,
      contrato: { select: { propiedad: { select: { asignadoAId: true } } } },
    },
  }));

  if (!voucher) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }
  if (actor.rol !== "manager" && voucher.contrato.propiedad.asignadoAId !== actor.usuarioId) {
    return NextResponse.json({ error: "Comprobante no encontrado." }, { status: 404 });
  }

  // Vouchers anteriores al folio/snapshot enriquecido no se pueden dibujar: su
  // snapshot no trae emisor ni partes. Se distingue del "no existe" para que el
  // corredor entienda que es un comprobante viejo, no un error.
  const snapshot = voucher.snapshot as unknown as (SnapshotPago | SnapshotLiquidacion) & { tipo?: string };
  if (!voucher.folio || !snapshot?.emisor) {
    return NextResponse.json(
      { error: "Este comprobante es anterior al formato PDF y no puede regenerarse." },
      { status: 409 },
    );
  }

  let buffer;
  try {
    buffer = await renderToBuffer(ComprobantePdfDocument({ snapshot }));
  } catch (e) {
    logError(`voucher-pdf/${id}`, e);
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
