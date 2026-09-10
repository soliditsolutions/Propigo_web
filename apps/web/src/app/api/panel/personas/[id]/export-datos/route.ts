/**
 * GET /api/panel/personas/[id]/export-datos?formato=json|pdf
 *
 * Derecho de acceso y de portabilidad de la Ley 21.719 (L-DP2 / L-DP3). El
 * corredor —a pedido de la persona, que ejerce su derecho ante la corredora
 * responsable— descarga todo lo que la plataforma guarda de ella:
 *   · `formato=json` → archivo estructurado, reutilizable (portabilidad);
 *   · `formato=pdf`  → copia legible (acceso).
 *
 * Seguridad:
 *  · Manager-only (acción de cumplimiento; el proxy no cubre rutas API).
 *  · Acotado al tenant (RLS + filtro explícito); id no-UUID → 404.
 *  · El propio export es una actividad de tratamiento: queda en `auditoria_equipo`.
 *  · Rate limit por usuario: es una salida masiva de datos personales.
 *  · `Cache-Control: no-store` — nunca en disco compartido ni CDN.
 */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { logError } from "@/lib/logger";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { idFiltro } from "@/lib/busqueda";
import {
  construirExportDatosPersona,
  nombreArchivoExport,
  PersonaNoEncontrada,
} from "@/lib/export-datos-persona";
import { ExportDatosPersonaDocument } from "@/lib/export-datos-persona-pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!idFiltro(id)) {
    return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });
  }

  let actor;
  try {
    actor = await getActor();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (actor.rol !== "manager") {
    return NextResponse.json(
      { error: "Solo el administrador de la cuenta puede exportar los datos de una persona." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const formato = url.searchParams.get("formato") === "pdf" ? "pdf" : "json";

  const rl = checkRateLimit(`export_datos:${actor.usuarioId}`, 20, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiadas exportaciones en poco tiempo. Intenta más tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let datos;
  try {
    datos = await withTenant(actor.tenantId, (tx) =>
      construirExportDatosPersona(tx, actor.tenantId, id),
    );
  } catch (e) {
    if (e instanceof PersonaNoEncontrada) {
      return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });
    }
    logError(`export-datos/${id}`, e);
    return NextResponse.json({ error: "No pudimos generar el export." }, { status: 500 });
  }

  // El export es tratamiento de datos: se registra quién lo pidió y de quién.
  await withTenant(actor.tenantId, (tx) => tx.auditoriaEquipo.create({
    data: {
      tenantId: actor.tenantId,
      actorId:  actor.usuarioId,
      accion:   "exportar_datos_persona",
      detalle:  `${datos.identidad.rut} · ${formato} · persona ${id}`,
      ip:       getClientIp(req),
    },
  })).catch((e) => logError("export-datos/auditoria", e));

  const baseHeaders = {
    "Cache-Control":          "no-store, private",
    "X-Content-Type-Options": "nosniff",
  };

  if (formato === "json") {
    const fileName = nombreArchivoExport(datos.identidad.rut, "json");
    return new NextResponse(JSON.stringify(datos, null, 2), {
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Type":        "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  }

  let buffer;
  try {
    buffer = await renderToBuffer(ExportDatosPersonaDocument({ data: datos }));
  } catch (e) {
    logError(`export-datos-pdf/${id}`, e);
    return NextResponse.json({ error: "No pudimos generar el PDF." }, { status: 500 });
  }

  const fileName = nombreArchivoExport(datos.identidad.rut, "pdf");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      ...baseHeaders,
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
