/**
 * GET /api/portal/documento/[id]
 * Descarga de documentos para usuarios del portal (arrendatarios y propietarios).
 *
 * Seguridad:
 *  1. Requiere sesión JWT portal válida (hw_portal cookie).
 *  2. Verifica que el documento pertenece al mismo tenant.
 *  3. Verifica que el documento está asociado a un contrato accesible por la persona.
 *  4. Registra acceso en acceso_log (Ley 21.719).
 *  5. Cache-Control: no-store, private — nunca en CDN.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { getPortalSession } from "@/lib/portal-auth";
import { withTenant } from "@/lib/tenant-db";
import { getClientIp } from "@/lib/ip";
import { idFiltro } from "@/lib/busqueda";
import { DOCUMENTOS_DIR } from "@/lib/uploads";

const MIME_BY_EXT: Record<string, string> = {
  pdf:  "application/pdf",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
};

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
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }
  const { personaId, tenantId, rol } = session;

  const doc = await withTenant(tenantId, async (tx) => {
    const d = await tx.documento.findUnique({
      where:  { id },
      select: { id: true, tenantId: true, nombre: true, storageKey: true, contratoId: true, periodoId: true, comentarioId: true },
    });
    if (!d || d.tenantId !== tenantId) return null;

    // Verificar acceso: el doc debe pertenecer a un contrato de esta persona
    const whereContrato = rol === "arrendatario"
      ? { tenantId, arrendatarioId: personaId }
      : { tenantId, propietarioId: personaId };

    let accesible = false;
    if (d.contratoId) {
      const c = await tx.contrato.findFirst({ where: { id: d.contratoId, ...whereContrato } });
      accesible = !!c;
    } else if (d.periodoId) {
      const p = await tx.periodoPago.findFirst({
        where:  { id: d.periodoId, contrato: whereContrato },
        select: { id: true },
      });
      accesible = !!p;
    } else if (d.comentarioId) {
      const c = await tx.comentarioCorredor.findFirst({
        where:  { id: d.comentarioId, contrato: whereContrato },
        select: { id: true },
      });
      accesible = !!c;
    }

    return accesible ? d : null;
  });

  if (!doc) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  const safeName = basename(doc.storageKey);
  const filePath = join(DOCUMENTOS_DIR, safeName);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }

  const ip = getClientIp(req);
  await withTenant(tenantId, (tx) => tx.accesoLog.create({
    data: {
      tenantId,
      personaId,
      documentoId: doc.id,
      accion:      "portal_documento_descargado",
      ip,
    },
  })).catch(() => {});

  const ext      = safeName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const fileName = encodeURIComponent(doc.nombre || safeName);

  return new NextResponse(new Uint8Array(fileBuffer), {
    status: 200,
    headers: {
      "Content-Type":           mimeType,
      "Content-Disposition":    `attachment; filename*=UTF-8''${fileName}`,
      "Cache-Control":          "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
