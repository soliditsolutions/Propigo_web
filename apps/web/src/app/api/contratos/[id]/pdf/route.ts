/**
 * GET /api/contratos/[id]/pdf — descarga del borrador de contrato en PDF.
 *
 * Mismo patrón de autenticación/ownership que el resto de /panel/contratos
 * (ADR-0013 Fase D): getActor() + rechazo si un Colaborador pide un contrato
 * de una propiedad que no le pertenece (404, no 403 — no revela existencia).
 * El PDF es un BORRADOR (ver lib/contrato-pdf.tsx) — plantilla fija + datos
 * reales, sin redacción libre de IA.
 */
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { ContratoPdfDocument, type ContratoPdfData } from "@/lib/contrato-pdf";

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
    include: {
      // El rol viene en `propiedad`; los complementos son tabla aparte y hay
      // que pedirlos, o la cláusula PRIMERO deja fuera el estacionamiento y la
      // bodega del contrato.
      propiedad:    { include: { rolesComplementarios: { orderBy: { tipo: "asc" } } } },
      arrendatario: true,
      propietario:  true,
    },
  }));

  if (!contrato) {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }
  if (actor.rol !== "manager" && contrato.propiedad.asignadoAId !== actor.usuarioId) {
    // Mismo criterio que contratos/[id]/page.tsx: 404, no 403 — no revela
    // que el contrato existe a un Colaborador sin acceso a esa propiedad.
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }
  if (contrato.estado !== "borrador") {
    // Solo antes de activar: "vigente" significa que ya existe un contrato
    // firmado de verdad fuera del sistema (activarContrato exige confirmar
    // que ambas partes ya firmaron). No solo se oculta en la UI — se rechaza
    // aquí también para que nadie pueda descargar un PDF "BORRADOR" que
    // podría no coincidir con lo que realmente se firmó.
    return NextResponse.json(
      { error: "El borrador solo está disponible mientras el contrato no se active." },
      { status: 409 },
    );
  }

  const data: ContratoPdfData = {
    tenantNombre: actor.tenant.nombre,
    propietario: {
      nombre: contrato.propietario.nombre,
      rut:    contrato.propietario.rut,
      email:  contrato.propietario.email,
    },
    arrendatario: {
      nombre: contrato.arrendatario.nombre,
      rut:    contrato.arrendatario.rut,
      email:  contrato.arrendatario.email,
    },
    propiedad: {
      direccion: contrato.propiedad.direccion,
      comuna:    contrato.propiedad.comuna,
      region:    contrato.propiedad.region,
      tipo:      contrato.propiedad.tipo,
      rol:       contrato.propiedad.rol,
      complementos: contrato.propiedad.rolesComplementarios.map((r) => ({
        tipo: r.tipo, rol: r.rol, descripcion: r.descripcion,
      })),
    },
    denominacion:         contrato.denominacion,
    valorArriendo:        Number(contrato.valorArriendo),
    diaVencimiento:       contrato.diaVencimiento,
    reajuste:             contrato.reajuste,
    moraTasaPct:          Number(contrato.moraTasaPct),
    moraDiasGracia:       contrato.moraDiasGracia,
    garantiaMeses:        Number(contrato.garantiaMeses),
    garantiaDenominacion: contrato.garantiaDenominacion,
    garantiaMontoBase:    contrato.garantiaMontoBase !== null ? Number(contrato.garantiaMontoBase) : null,
    fechaInicio:          contrato.fechaInicio,
    fechaFin:             contrato.fechaFin,
    generadoEl:           new Date(),
  };

  const buffer = await renderToBuffer(ContratoPdfDocument({ data }));
  const fileName = `borrador-contrato-${contrato.propiedad.direccion.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40)}.pdf`;

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
