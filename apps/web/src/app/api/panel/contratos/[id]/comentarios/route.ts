/**
 * POST /api/panel/contratos/[id]/comentarios
 * Crea un comentario del corredor para el arrendatario de un contrato.
 * Requiere sesión panel activa. Dispara notificación por email.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-db";
import { idFiltro } from "@/lib/busqueda";
import { sendComentarioCorredorEmail } from "@/lib/email";

const schema = z.object({
  texto:       z.string().min(1).max(2000).trim(),
  documentoIds: z.array(z.string().uuid()).max(5).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Datos inválidos." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 422 });

  const { texto, documentoIds } = parsed.data;
  const { id: contratoId } = await params;
  if (!idFiltro(contratoId)) {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }

  const resultado = await withTenant(session.tenantId, async (tx) => {
    const contrato = await tx.contrato.findFirst({
      where:  { id: contratoId, tenantId: session.tenantId },
      select: {
        id: true, tenantId: true, arrendatarioId: true,
        propiedad:    { select: { direccion: true } },
        arrendatario: { select: { nombre: true, email: true } },
      },
    });
    if (!contrato) return null;

    const corredor = await tx.usuario.findFirst({
      where:  { id: session.sub as string, tenantId: session.tenantId },
      select: { nombre: true },
    });

    const comentario = await tx.comentarioCorredor.create({
      data: {
        tenantId:    session.tenantId,
        contratoId,
        texto,
        usuarioNombre: corredor?.nombre ?? "Corredor",
      },
    });

    // Asociar documentos seleccionados si se proveyeron
    if (documentoIds && documentoIds.length > 0) {
      await tx.documento.updateMany({
        where: { id: { in: documentoIds }, tenantId: session.tenantId, contratoId },
        data:  { comentarioId: comentario.id },
      });
    }

    // Registrar notificación (best-effort — no aborta la request si falla)
    if (contrato.arrendatario.email) {
      await tx.notificacion.create({
        data: {
          tenantId:  session.tenantId,
          personaId: contrato.arrendatarioId,
          contratoId,
          tipo:    "comentario_corredor",
          canal:   "email",
          estado:  "pendiente",
          asunto:  "Nuevo mensaje de tu corredor — Housing",
          cuerpo:  texto.substring(0, 200),
        },
      }).catch(() => {});
    }

    return { comentario, contrato, corredorNombre: corredor?.nombre ?? "Corredor" };
  });

  if (!resultado) return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });

  // Enviar email fuera de la transacción — I/O externo no debe mantener la
  // conexión de BD abierta.
  const { comentario, contrato, corredorNombre } = resultado;
  if (contrato.arrendatario.email) {
    sendComentarioCorredorEmail({
      emailArrendatario:  contrato.arrendatario.email,
      nombreArrendatario: contrato.arrendatario.nombre,
      nombreCorredor:     corredorNombre,
      direccionPropiedad: contrato.propiedad.direccion,
      texto,
      tieneDocumentos: (documentoIds?.length ?? 0) > 0,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: comentario.id });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id: contratoId } = await params;
  if (!idFiltro(contratoId)) return NextResponse.json([]);

  const comentarios = await withTenant(session.tenantId, (tx) => tx.comentarioCorredor.findMany({
    where:   { contratoId, tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, texto: true, usuarioNombre: true, createdAt: true,
      documentos: { select: { id: true, nombre: true, tipo: true } },
    },
  }));

  return NextResponse.json(comentarios);
}
