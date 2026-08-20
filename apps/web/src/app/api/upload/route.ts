import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getTenant } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import { logError } from "@/lib/logger";
import { DOCUMENTOS_DIR } from "@/lib/uploads";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  verificarMagicBytes,
  ALLOWED_MIME_IMAGES,
  ALLOWED_MIME_DOCS,
  MIME_TO_EXT,
} from "@/lib/magic-bytes";

const MAX_BYTES_IMAGES = 5  * 1024 * 1024; // 5 MB
const MAX_BYTES_DOCS   = 10 * 1024 * 1024; // 10 MB

// SEC: "propiedades" y "perfil" son imágenes públicas por diseño (se
// muestran sin autenticación en el marketplace/portal) — quedan servidas
// como estático bajo public/. "documentos" es sensible (cédulas, contratos,
// comprobantes) y vive fuera de public/ — ver src/lib/uploads.ts.
const UPLOAD_DIRS: Record<string, string> = {
  propiedades: join(process.cwd(), "public", "uploads", "propiedades"),
  perfil:      join(process.cwd(), "public", "uploads", "perfil"),
  documentos:  DOCUMENTOS_DIR,
};

export async function POST(req: NextRequest) {
  try {
    // ── Autenticación obligatoria — uploads solo para usuarios activos ────
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    // ── Rate limit: 10 uploads/min por usuario ──────────────────────────
    const rl = checkRateLimit(`upload:${session.sub}`, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados archivos subidos en poco tiempo. Intenta de nuevo en unos segundos." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    // ── Gate de tenant ─────────────────────────────────────────────────
    try {
      await getTenant();
    } catch {
      return NextResponse.json(
        { error: "Servicio no disponible." },
        { status: 503 },
      );
    }

    // ── Tipo de upload: propiedades (default), perfil o documentos ─────
    const tipo = req.nextUrl.searchParams.get("type") ?? "propiedades";
    const uploadDir = UPLOAD_DIRS[tipo] ?? UPLOAD_DIRS.propiedades;
    const urlPrefix =
      tipo === "perfil"     ? "/uploads/perfil"     :
      tipo === "documentos" ? "/uploads/documentos" :
                              "/uploads/propiedades";

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "La solicitud debe ser multipart/form-data." },
        { status: 400 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo en el campo 'file'." },
        { status: 400 },
      );
    }

    // ── Validar MIME declarado según tipo de upload ────────────────────
    const esDoc = tipo === "documentos";
    const mimePermitidos = esDoc ? ALLOWED_MIME_DOCS : ALLOWED_MIME_IMAGES;
    if (!mimePermitidos.has(file.type)) {
      return NextResponse.json(
        {
          error: esDoc
            ? "Solo se aceptan archivos PDF."
            : "Tipo de archivo no permitido. Solo se aceptan imágenes JPG, PNG, WebP o GIF.",
        },
        { status: 400 },
      );
    }

    // ── Validar tamaño ─────────────────────────────────────────────────
    const maxBytes = esDoc ? MAX_BYTES_DOCS : MAX_BYTES_IMAGES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${esDoc ? "10" : "5"} MB.` },
        { status: 400 },
      );
    }

    // ── Validar magic bytes — CWE-434 ──────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!verificarMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: "El contenido del archivo no corresponde al tipo declarado." },
        { status: 400 },
      );
    }

    // ── Generar nombre seguro (UUID + extensión fija) ──────────────────
    const ext    = MIME_TO_EXT[file.type];
    const nombre = `${randomUUID()}.${ext}`;

    // ── Guardar en disco ───────────────────────────────────────────────
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, nombre), buffer);

    return NextResponse.json({ url: `${urlPrefix}/${nombre}` });
  } catch (err) {
    logError("api/upload", err);
    return NextResponse.json(
      { error: "Error interno al procesar el archivo." },
      { status: 500 },
    );
  }
}
