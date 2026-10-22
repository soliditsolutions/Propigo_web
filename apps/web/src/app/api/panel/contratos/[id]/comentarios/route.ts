/**
 * POST /api/panel/contratos/[id]/comentarios
 * Crea un comentario del corredor para el arrendatario de un contrato.
 * Requiere sesión panel activa. Dispara notificación por email.
 *
 * Autorización (ADR-0013): getActor (usuario activo) + un Colaborador solo
 * opera sobre contratos de propiedades asignadas a él; si no, 404.
 *
 * Correo: sale de inmediato, pero respetando la baja de la persona (es un
 * aviso opcional, Ley 19.496 art. 28 B) y con enlace para darse de baja. La
 * notificación queda "enviada" si salió; si el envío falla queda "pendiente"
 * y la reintenta el cron. Antes salía siempre y además quedaba pendiente: el
 * arrendatario lo recibía dos veces, y aun estando dado de baja.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getActor, alcanceContrato, type Actor } from "@/lib/queries";
import { firmarTokenBaja, puedeRecibir } from "@/lib/notificacion-preferencias";
import { logError } from "@/lib/logger";
import { withTenant } from "@/lib/tenant-db";
import { idFiltro } from "@/lib/busqueda";
import { sendComentarioCorredorEmail } from "@/lib/email";
import { MARCA } from "@/lib/marca";

async function actorOError(): Promise<Actor | null> {
  try {
    return await getActor();
  } catch {
    return null;
  }
}

const schema = z.object({
  texto:       z.string().min(1).max(2000).trim(),
  documentoIds: z.array(z.string().uuid()).max(5).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await actorOError();
  if (!actor) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const tenantId = actor.tenantId;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Datos inválidos." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 422 });

  const { texto, documentoIds } = parsed.data;
  const { id: contratoId } = await params;
  if (!idFiltro(contratoId)) {
    return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
  }

  const resultado = await withTenant(tenantId, async (tx) => {
    const contrato = await tx.contrato.findFirst({
      where:  { id: contratoId, tenantId, ...alcanceContrato(actor) },
      select: {
        id: true, tenantId: true, arrendatarioId: true,
        propiedad:    { select: { direccion: true } },
        arrendatario: {
          select: {
            nombre: true, email: true,
            preferenciaNotif: { select: { suscrito: true, bajaHasta: true, alcance: true } },
          },
        },
      },
    });
    if (!contrato) return null;

    const corredor = await tx.usuario.findFirst({
      where:  { id: actor.usuarioId, tenantId },
      select: { nombre: true },
    });

    const comentario = await tx.comentarioCorredor.create({
      data: {
        tenantId,
        contratoId,
        texto,
        usuarioNombre: corredor?.nombre ?? "Corredor",
      },
    });

    // Asociar documentos seleccionados si se proveyeron
    if (documentoIds && documentoIds.length > 0) {
      await tx.documento.updateMany({
        where: { id: { in: documentoIds }, tenantId, contratoId },
        data:  { comentarioId: comentario.id },
      });
    }

    // Registrar notificación (best-effort — no aborta la request si falla)
    let notificacionId: string | null = null;
    if (contrato.arrendatario.email) {
      notificacionId = await tx.notificacion.create({
        data: {
          tenantId,
          personaId: contrato.arrendatarioId,
          contratoId,
          tipo:    "comentario_corredor",
          canal:   "email",
          estado:  "pendiente",
          asunto:  `Nuevo mensaje de tu corredor — ${MARCA}`,
          cuerpo:  texto.substring(0, 200),
        },
        select: { id: true },
      }).then((n) => n.id).catch(() => null);
    }

    return { comentario, contrato, corredorNombre: corredor?.nombre ?? "Corredor", notificacionId };
  });

  if (!resultado) return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });

  // Enviar email fuera de la transacción — I/O externo no debe mantener la
  // conexión de BD abierta.
  const { comentario, contrato, corredorNombre, notificacionId } = resultado;
  const pref = contrato.arrendatario.preferenciaNotif[0] ?? null;
  if (contrato.arrendatario.email && puedeRecibir(pref, "comentario_corredor")) {
    try {
      const urlBaja = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/no-molestar?t=${
        await firmarTokenBaja(contrato.arrendatarioId, tenantId)
      }`;
      await sendComentarioCorredorEmail({
        emailArrendatario:  contrato.arrendatario.email,
        nombreArrendatario: contrato.arrendatario.nombre,
        nombreCorredor:     corredorNombre,
        direccionPropiedad: contrato.propiedad.direccion,
        texto,
        tieneDocumentos: (documentoIds?.length ?? 0) > 0,
        urlBaja,
      });
      if (notificacionId) {
        await withTenant(tenantId, (tx) => tx.notificacion.update({
          where: { id: notificacionId },
          data:  { estado: "enviada", enviadaEn: new Date() },
        }));
      }
    } catch (e) {
      // Queda "pendiente": el cron la reintenta.
      logError("comentarios/envio", e);
    }
  }
  // Con baja vigente no se envía; la pendiente la marca el despachador.

  return NextResponse.json({ ok: true, id: comentario.id });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await actorOError();
  if (!actor) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const { id: contratoId } = await params;
  if (!idFiltro(contratoId)) return NextResponse.json([]);

  const comentarios = await withTenant(actor.tenantId, (tx) => tx.comentarioCorredor.findMany({
    where:   { contratoId, tenantId: actor.tenantId, contrato: alcanceContrato(actor) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, texto: true, usuarioNombre: true, createdAt: true,
      documentos: { select: { id: true, nombre: true, tipo: true } },
    },
  }));

  return NextResponse.json(comentarios);
}
