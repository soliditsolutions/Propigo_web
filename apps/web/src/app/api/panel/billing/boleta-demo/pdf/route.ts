/**
 * GET /api/panel/billing/boleta-demo/pdf?periodo=YYYY-MM — boleta de ejemplo
 * de "Mi Plan" (panel/perfil). Ver la nota de honestidad en billing-demo.ts:
 * no hay pasarela de pago conectada, así que el PDF lo dice en grande.
 *
 * Manager-only, igual que el resto de /panel/billing — es información de
 * cuenta, no algo que un Colaborador necesite ver.
 */
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActor, getUfCLP } from "@/lib/queries";
import { getPlanEfectivo } from "@/lib/plans";
import { periodoDemoPorClave } from "@/lib/billing-demo";
import { logError } from "@/lib/logger";
import { BoletaDemoDocument } from "@/lib/boleta-demo-pdf";

export async function GET(req: Request) {
  let actor;
  try {
    actor = await getActor();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (actor.rol !== "manager") {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }

  const clave = new URL(req.url).searchParams.get("periodo") ?? "";
  const plan = getPlanEfectivo(actor.tenant.plan);
  const periodo = await periodoDemoPorClave(plan, clave, getUfCLP);
  if (!periodo) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  let buffer;
  try {
    buffer = await renderToBuffer(BoletaDemoDocument({
      data: {
        tenant: { nombre: actor.tenant.nombre, rut: actor.tenant.rut },
        planNombre: plan.name,
        periodoLabel: periodo.label,
        fechaEmision: periodo.fecha,
        montoUf: periodo.montoUf,
        netoClp: periodo.netoClp,
        ivaClp: periodo.ivaClp,
        totalClp: periodo.totalClp,
        valorUfClp: periodo.valorUfClp,
      },
    }));
  } catch (e) {
    logError(`boleta-demo/${clave}`, e);
    return NextResponse.json({ error: "No pudimos generar la boleta de ejemplo." }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":           "application/pdf",
      "Content-Disposition":    `attachment; filename*=UTF-8''${encodeURIComponent(`boleta-ejemplo-${clave}.pdf`)}`,
      "Cache-Control":          "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
