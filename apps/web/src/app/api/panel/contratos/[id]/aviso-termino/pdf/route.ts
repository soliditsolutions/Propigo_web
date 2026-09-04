/**
 * GET /api/panel/contratos/[id]/aviso-termino/pdf — aviso de término (L-CM2/L-CM3).
 *
 * Solo para contratos ya terminados (tienen causal). Mismo ownership que el resto
 * de /panel: un Colaborador solo accede a contratos de sus propiedades (404 si no).
 */
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { AvisoTerminoDocument } from "@/lib/aviso-termino-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let actor;
  try {
    actor = await getActor();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const contrato = await withTenant(actor.tenantId, (tx) => tx.contrato.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: {
      estado: true, causalTermino: true, fechaTermino: true, fechaInicio: true,
      fechaNotificacionDesahucio: true,
      arrendatario: { select: { nombre: true, rut: true } },
      propietario:  { select: { nombre: true, rut: true } },
      propiedad:    { select: { direccion: true, comuna: true, rol: true, asignadoAId: true } },
    },
  }));

  if (!contrato) {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }
  if (actor.rol !== "manager" && contrato.propiedad.asignadoAId !== actor.usuarioId) {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }
  // El aviso solo existe para un contrato terminado: la causal y la fecha de
  // término son lo que el documento comunica. Sin ellas no hay nada que avisar.
  if (!contrato.causalTermino || !contrato.fechaTermino) {
    return NextResponse.json(
      { error: "El aviso de término solo está disponible para un contrato ya terminado." },
      { status: 409 },
    );
  }

  const tenant = actor.tenant;
  let buffer;
  try {
    buffer = await renderToBuffer(AvisoTerminoDocument({
      data: {
        emisor: { nombre: tenant.nombre, rut: tenant.rut, giro: tenant.giro, direccion: tenant.direccion },
        arrendatario: contrato.arrendatario,
        propietario:  contrato.propietario,
        inmueble: { direccion: contrato.propiedad.direccion, comuna: contrato.propiedad.comuna, rol: contrato.propiedad.rol },
        causal: contrato.causalTermino,
        fechaTermino: contrato.fechaTermino,
        fechaInicio: contrato.fechaInicio,
        fechaNotificacionDesahucio: contrato.fechaNotificacionDesahucio,
        generadoEl: new Date(),
      },
    }));
  } catch (e) {
    logError(`aviso-termino/${id}`, e);
    return NextResponse.json({ error: "No pudimos generar el aviso." }, { status: 500 });
  }

  const fileName = `aviso-termino-${contrato.propiedad.direccion.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40)}.pdf`;
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
