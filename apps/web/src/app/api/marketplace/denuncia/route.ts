import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendDenunciaAdminEmail } from "@/lib/email";
import { z } from "zod";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";

const TIPO_DENUNCIA = ["fraude_inmobiliario", "estafa", "informacion_falsa", "acoso", "discriminacion", "incumplimiento", "otro"] as const;
const OBJETIVO_DENUNCIA = ["propiedad", "corredor"] as const;

const schema = z.object({
  tipo:                 z.enum(TIPO_DENUNCIA),
  objetivo:             z.enum(OBJETIVO_DENUNCIA),
  publicacionId:        z.string().uuid().optional(),
  nombreCorredor:       z.string().max(120).trim().optional(),
  descripcion:          z.string().min(30, "La descripción debe tener al menos 30 caracteres.").max(3000).trim(),
  evidenciaDescripcion: z.string().max(1000).trim().optional(),
  esAnonima:            z.boolean(),
  nombreDenunciante:    z.string().max(80).trim().optional(),
  apellidoDenunciante:  z.string().max(80).trim().optional(),
  emailDenunciante:     z.string().email().max(120).trim().toLowerCase().optional(),
  declaraVeracidad:     z.literal(true, { message: "Debes declarar la veracidad de la información." }),
  aceptaTratamientoDatos: z.literal(true, { message: "Debes aceptar el tratamiento de datos personales." }),
}).refine(
  (d) => d.esAnonima || (!!d.nombreDenunciante && !!d.apellidoDenunciante),
  { message: "Si la denuncia no es anónima, debes indicar tu nombre y apellido.", path: ["nombreDenunciante"] }
).refine(
  (d) => d.objetivo !== "propiedad" || !!d.publicacionId,
  { message: "Selecciona la publicación que deseas denunciar.", path: ["publicacionId"] }
);

export async function POST(req: NextRequest) {
  // Máx. 3 denuncias por IP por hora. La IP sale de getClientIp (el primer
  // valor de x-forwarded-for lo elige el cliente).
  const ip = getClientIp(req);
  if (!checkRateLimit(`marketplace_denuncia:${ip}`, 3, 60 * 60_000).allowed) {
    return NextResponse.json({ error: "Has enviado demasiadas denuncias. Intenta en una hora." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Datos inválidos." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msgs = parsed.error.issues.map(e => e.message);
    return NextResponse.json({ error: msgs[0] ?? "Revisa los datos ingresados.", detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const d = parsed.data;

  // Verificar que la publicación existe (si se indica). A propósito NO exige
  // estado='publicada' — se puede denunciar algo ya dado de baja — así que
  // usa una función SECURITY DEFINER en vez de la política pública normal
  // (que solo cubre publicadas) o de acceso directo a la tabla.
  let tituloPub: string | undefined;
  if (d.publicacionId) {
    const rows = await prisma.$queryRaw<{ marketplace_lookup_publicacion_titulo: string | null }[]>`
      SELECT marketplace_lookup_publicacion_titulo(${d.publicacionId}::uuid)
    `;
    const titulo = rows[0]?.marketplace_lookup_publicacion_titulo;
    if (titulo == null) return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
    tituloPub = titulo;
  }

  // Guardar denuncia
  await prisma.denuncia.create({
    data: {
      tipo:                  d.tipo,
      objetivo:              d.objetivo,
      publicacionId:         d.publicacionId ?? null,
      nombreCorredor:        d.nombreCorredor ?? null,
      descripcion:           d.descripcion,
      evidenciaDescripcion:  d.evidenciaDescripcion ?? null,
      esAnonima:             d.esAnonima,
      nombreDenunciante:     d.esAnonima ? null : (d.nombreDenunciante ?? null),
      apellidoDenunciante:   d.esAnonima ? null : (d.apellidoDenunciante ?? null),
      emailDenunciante:      d.esAnonima ? null : (d.emailDenunciante ?? null),
      declaraVeracidad:      d.declaraVeracidad as boolean,
      aceptaTratamientoDatos: d.aceptaTratamientoDatos as boolean,
      estado:                "recibida",
      ip:                    ip.slice(0, 45),
    },
  });

  // Notificar al admin (sin bloquear respuesta)
  sendDenunciaAdminEmail({
    tipo:               d.tipo,
    objetivo:           d.objetivo,
    descripcion:        d.descripcion,
    evidencia:          d.evidenciaDescripcion,
    esAnonima:          d.esAnonima,
    nombreDenunciante:  d.esAnonima ? undefined : d.nombreDenunciante,
    apellidoDenunciante: d.esAnonima ? undefined : d.apellidoDenunciante,
    emailDenunciante:   d.esAnonima ? undefined : d.emailDenunciante,
    nombreCorredor:     d.nombreCorredor,
    tituloPub,
    ip,
  }).catch(err => console.error("[denuncia] Error enviando email:", err));

  return NextResponse.json({ ok: true });
}
