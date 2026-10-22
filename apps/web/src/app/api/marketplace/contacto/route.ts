import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendContactoCorredorEmail, sendAcuseContactoEmail } from "@/lib/email";
import { z } from "zod";
import { CORREO } from "@/lib/marca";

const schema = z.object({
  publicacionId: z.string().uuid(),
  nombre:        z.string().min(1).max(80).trim(),
  apellido:      z.string().min(1).max(80).trim(),
  telefono:      z.string().min(8).max(20).trim(),
  email:         z.string().email().max(120).trim().toLowerCase(),
  titulo:        z.string().min(3).max(120).trim(),
  descripcion:   z.string().min(10).max(2000).trim(),
  quiereContacto: z.boolean().default(true),
  viaEmail:      z.boolean().default(true),
  viaTelefono:   z.boolean().default(false),
});

// Rate limit simple: max 5 solicitudes por IP cada 10 min (en-memory, basta para MVP)
const ipLog = new Map<string, number[]>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const ventana = 10 * 60 * 1000;
  const hits = (ipLog.get(ip) ?? []).filter(t => now - t < ventana);
  if (hits.length >= 5) return false;
  ipLog.set(ip, [...hits, now]);
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Demasiadas solicitudes. Intenta más tarde." }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Datos inválidos." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Completa todos los campos correctamente.", detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { publicacionId, nombre, apellido, telefono, email, titulo, descripcion, quiereContacto, viaEmail, viaTelefono } = parsed.data;

  // Verificar que la publicación existe y está activa
  const pub = await prisma.publicacion.findFirst({
    where:   { id: publicacionId, estado: "publicada" },
    include: { tenant: { select: { id: true, nombre: true, emailContacto: true } } },
  });

  if (!pub) {
    return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
  }

  // Determinar email del corredor: emailContacto → primer usuario admin → CORREO.soporte
  // ADR-0011 Fase 2: usuario está sujeto a RLS y el visitante no tiene sesión
  // de ningún tenant — se resuelve con una función SECURITY DEFINER de solo
  // lectura (setup.sql), no con acceso directo a la tabla completa.
  let emailCorredor = pub.tenant.emailContacto;
  if (!emailCorredor) {
    const rows = await prisma.$queryRaw<{ marketplace_lookup_corredor_email_fallback: string | null }[]>`
      SELECT marketplace_lookup_corredor_email_fallback(${pub.tenant.id}::uuid)
    `;
    emailCorredor = rows[0]?.marketplace_lookup_corredor_email_fallback ?? CORREO.soporte;
  }

  // Generar token de valoración (UUID v4)
  const { randomUUID } = await import("crypto");
  const tokenValoracion = randomUUID();

  // Guardar consulta
  await prisma.consultaContacto.create({
    data: {
      publicacionId,
      tenantId:      pub.tenant.id,
      nombre, apellido, telefono, email,
      titulo, descripcion,
      quiereContacto, viaEmail, viaTelefono,
      tokenValoracion,
      ip: ip.slice(0, 45),
    },
  });

  // Enviar emails (en paralelo, sin bloquear respuesta si fallan)
  Promise.all([
    sendContactoCorredorEmail({
      emailCorredor,
      nombreCorredor: pub.tenant.nombre,
      tituloPub:      pub.titulo,
      nombre, apellido, telefono, email,
      titulo, descripcion, viaEmail, viaTelefono,
    }),
    sendAcuseContactoEmail({
      emailCliente:   email,
      nombreCliente:  nombre,
      tituloPub:      pub.titulo,
      nombreCorredor: pub.tenant.nombre,
    }),
  ]).catch(err => console.error("[contacto] Error enviando emails:", err));

  return NextResponse.json({ ok: true, tokenValoracion });
}
