/**
 * GET /api/documentos/[id]
 * Descarga autenticada y multi-tenant de documentos.
 *
 * FIX A3 — Documentos accesibles sin autenticación:
 * Los documentos estaban en /public/uploads/ accesibles por URL directa.
 * Esta ruta reemplaza el acceso público por descarga autenticada:
 *  1. Verifica JWT de sesión activa.
 *  2. Verifica que el documento pertenece al mismo tenant del usuario.
 *  3. Registra acceso en acceso_log (Ley 21.719).
 *  4. Lee el archivo desde disco y lo sirve con headers seguros.
 *
 * SEGURIDAD:
 * - Tenant-scoped: IDOR imposible, el documento debe ser del tenant del usuario.
 * - Content-Disposition: attachment — fuerza descarga, no renderizado inline.
 * - Cache-Control: no-store, private — nunca en CDN ni caché del browser.
 * - storageKey sanitizado — no se usa input del usuario como ruta de archivo.
 */
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, basename } from "path";
import { getSession } from "@/lib/auth";
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
  // 1. Autenticación
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  if (!idFiltro(id)) {
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  // 2. Buscar documento — scoped al tenant del usuario (previene IDOR).
  //    ADR-0011 Fase 2: bajo housing_app + RLS, un documento de otro tenant
  //    ya ni siquiera es visible a nivel de fila — el filtro tenantId de la
  //    query es ahora un segundo respaldo sobre lo que la BD ya garantiza.
  const doc = await withTenant(session.tenantId, (tx) => tx.documento.findFirst({
    where:  { id, tenantId: session.tenantId },
    select: { id: true, tenantId: true, nombre: true, storageKey: true },
  }));

  if (!doc) {
    // Respuesta idéntica tanto si no existe como si es de otro tenant
    return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  }

  // 3. Resolver ruta en disco — nunca usar input del usuario como path
  //    storageKey es una ruta relativa generada internamente (UUID.ext)
  const safeName = basename(doc.storageKey); // strip any directory traversal
  const filePath = join(DOCUMENTOS_DIR, safeName);

  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(filePath);
  } catch {
    return NextResponse.json({ error: "Archivo no disponible." }, { status: 404 });
  }

  // 4. Registrar acceso (Ley 21.719 — audit trail)
  const ip = getClientIp(req);
  await withTenant(session.tenantId, (tx) => tx.accesoLog.create({
    data: {
      tenantId:    session.tenantId,
      documentoId: doc.id,
      accion:      "documento_descargado",
      ip,
    },
  })).catch(() => { /* no bloquear descarga si el log falla */ });

  // 5. Servir con headers seguros
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
