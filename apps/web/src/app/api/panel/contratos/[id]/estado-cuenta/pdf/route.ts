/**
 * GET /api/panel/contratos/[id]/estado-cuenta/pdf — estado de cuenta de deuda (L-CM1).
 *
 * Lista la deuda vigente (períodos vencidos e impagos) con su desglose y la mora
 * al día de hoy. Es el documento que respalda la demanda monitoria. Mismo
 * ownership que el resto de /panel.
 */
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { convertirUfAClp } from "@propigo/core";
import { getUfCLPTx } from "@/lib/queries";
import { construirEstadoCuenta, type PeriodoDeuda } from "@/lib/estado-cuenta";
import { idFiltro } from "@/lib/busqueda";
import { EstadoCuentaDocument } from "@/lib/estado-cuenta-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idFiltro(id)) {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }

  let actor;
  try {
    actor = await getActor();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const hoy = new Date();

  const datos = await withTenant(actor.tenantId, async (tx) => {
    const contrato = await tx.contrato.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: {
        denominacion: true, moraTasaPct: true, moraDiasGracia: true,
        arrendatario: { select: { nombre: true, rut: true } },
        propietario:  { select: { nombre: true, rut: true } },
        propiedad:    { select: { direccion: true, comuna: true, rol: true, asignadoAId: true } },
        periodos: {
          where: { estado: { in: ["atrasado", "pendiente"] } },
          orderBy: { numero: "asc" },
          select: { numero: true, fechaVencimiento: true, montoBase: true, montoGastoComun: true, estado: true },
        },
      },
    });
    if (!contrato) return { estado: "no_existe" as const };
    if (actor.rol !== "manager" && contrato.propiedad.asignadoAId !== actor.usuarioId) {
      return { estado: "no_existe" as const };
    }

    // Solo cuenta como deuda lo vencido e impago: atrasado, o pendiente cuyo
    // vencimiento ya pasó. La renta en UF se congela a la UF de su vencimiento,
    // igual que en cobros (no se revalúa a hoy).
    const vencidos = contrato.periodos.filter(
      (p) => p.estado === "atrasado" || (p.estado === "pendiente" && p.fechaVencimiento < hoy),
    );
    const periodosDeuda: PeriodoDeuda[] = [];
    for (const p of vencidos) {
      const uf = contrato.denominacion === "UF" ? await getUfCLPTx(tx, p.fechaVencimiento) : 0;
      const arriendoClp = contrato.denominacion === "UF"
        ? convertirUfAClp(Number(p.montoBase), uf)
        : Math.round(Number(p.montoBase));
      periodosDeuda.push({
        numero: p.numero,
        fechaVencimiento: p.fechaVencimiento,
        arriendoClp,
        gastoComunClp: Math.round(Number(p.montoGastoComun)),
      });
    }

    return { estado: "ok" as const, contrato, periodosDeuda };
  });

  if (datos.estado === "no_existe") {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }
  if (datos.periodosDeuda.length === 0) {
    return NextResponse.json({ error: "El contrato no tiene deuda vencida." }, { status: 409 });
  }

  const { contrato } = datos;
  const estadoCuenta = construirEstadoCuenta(
    datos.periodosDeuda,
    { moraTasaPctMensual: Number(contrato.moraTasaPct), moraDiasGracia: contrato.moraDiasGracia },
    hoy,
  );

  const tenant = actor.tenant;
  let buffer;
  try {
    buffer = await renderToBuffer(EstadoCuentaDocument({
      data: {
        emisor: { nombre: tenant.nombre, rut: tenant.rut, giro: tenant.giro, direccion: tenant.direccion },
        arrendatario: contrato.arrendatario,
        propietario:  contrato.propietario,
        inmueble: { direccion: contrato.propiedad.direccion, comuna: contrato.propiedad.comuna, rol: contrato.propiedad.rol },
        estadoCuenta,
      },
    }));
  } catch (e) {
    logError(`estado-cuenta/${id}`, e);
    return NextResponse.json({ error: "No pudimos generar el estado de cuenta." }, { status: 500 });
  }

  const fileName = `estado-cuenta-${contrato.propiedad.direccion.replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 40)}.pdf`;
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
