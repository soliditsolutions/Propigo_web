import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant-db";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit, respuestaLimite } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";
import { z } from "zod";

const schema = z.object({
  token:      z.string().uuid(),
  estrellas:  z.number().int().min(1).max(5),
  comentario: z.string().max(500).trim().optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // AUD-04: sin esto, un script podía enviar valoraciones sin límite.
  const rl = checkRateLimit(`marketplace_valoracion:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return respuestaLimite("Demasiadas solicitudes seguidas.", rl.retryAfter);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Datos inválidos." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos.", detalles: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { token, estrellas, comentario } = parsed.data;

  // AUD-04: todo el acceso a datos queda protegido — antes un error de BD (o
  // la carrera de dos envíos concurrentes con el mismo token, ver más abajo)
  // producía un 500 crudo en vez de una respuesta controlada.
  try {
    // Ruta 1: token viene de ConsultaContacto (interesado que envió formulario de contacto)
    const consulta = await prisma.consultaContacto.findUnique({
      where:  { tokenValoracion: token },
      select: { id: true, tenantId: true, valoracionDada: true, nombre: true, apellido: true },
    });

    if (consulta) {
      if (consulta.valoracionDada) {
        return NextResponse.json({ error: "Esta valoración ya fue enviada anteriormente." }, { status: 409 });
      }
      try {
        await prisma.$transaction([
          prisma.valoracionCorredor.create({
            data: {
              tenantId:  consulta.tenantId,
              consultaId: consulta.id,
              nombre:    consulta.nombre,
              apellido:  consulta.apellido,
              estrellas,
              comentario: comentario ?? null,
              esVisible:  true,
            },
          }),
          // AUD-04: gate atómico — si otra request concurrente ya marcó
          // valoracionDada=true, este WHERE no matchea ninguna fila y Prisma
          // lanza P2025 (registro no encontrado), que capturamos como 409
          // en vez de dejar pasar dos valoraciones para el mismo token.
          prisma.consultaContacto.update({
            where: { id: consulta.id, valoracionDada: false },
            data:  { valoracionDada: true },
          }),
        ]);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
          return NextResponse.json({ error: "Esta valoración ya fue enviada anteriormente." }, { status: 409 });
        }
        throw e;
      }
      return NextResponse.json({ ok: true });
    }

    // Ruta 2: token viene de Contrato (arrendatario con contrato vigente).
    // ADR-0011 Fase 2: contrato SÍ está sujeto a RLS y el token no revela el
    // tenant por adelantado — mismo patrón cross-tenant que login, resuelto
    // con una función SECURITY DEFINER de solo lectura (no un bypass general).
    const contratoRows = await prisma.$queryRaw<{
      id: string; tenant_id: string; valoracion_dada: boolean; arrendatario_nombre: string;
    }[]>`SELECT * FROM marketplace_lookup_valoracion_contrato(${token}::uuid)`;
    const contrato = contratoRows[0];

    if (!contrato) {
      return NextResponse.json({ error: "Enlace de valoración inválido." }, { status: 404 });
    }

    if (contrato.valoracion_dada) {
      return NextResponse.json({ error: "Esta valoración ya fue enviada anteriormente." }, { status: 409 });
    }

    // Persona.nombre es el nombre completo — partimos en primer token y el resto
    const partes   = contrato.arrendatario_nombre.trim().split(/\s+/);
    const nombre   = partes[0] ?? "";
    const apellido = partes.slice(1).join(" ");

    try {
      // Ya estamos dentro de UNA transacción (withTenant) — ambas operaciones
      // son atómicas entre sí sin necesidad de anidar otro $transaction.
      await withTenant(contrato.tenant_id, async (tx) => {
        await tx.valoracionCorredor.create({
          data: {
            tenantId:  contrato.tenant_id,
            contratoId: contrato.id,
            nombre,
            apellido,
            estrellas,
            comentario: comentario ?? null,
            esVisible:  true,
          },
        });
        // AUD-04: mismo gate atómico que arriba, para la ruta de contrato.
        await tx.contrato.update({
          where: { id: contrato.id, valoracionDada: false },
          data:  { valoracionDada: true },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return NextResponse.json({ error: "Esta valoración ya fue enviada anteriormente." }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    logError("marketplace/valoracion", e);
    return NextResponse.json({ error: "No se pudo registrar la valoración. Intenta de nuevo." }, { status: 500 });
  }
}
