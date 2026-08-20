/**
 * POST /api/billing/webhook — recepción de eventos de la pasarela (ADR-0014, P-A3).
 *
 * Handler deliberadamente delgado: toda la lógica (firma, idempotencia,
 * anti-replay) vive en `lib/billing/webhook.ts` para poder testearla sin
 * levantar Next. Acá solo se traduce Request → resultado → Response.
 *
 * Endpoint público y sin sesión: la autenticación ES la firma del proveedor.
 * No lleva rate-limit por IP a propósito — descartar eventos de pago reales
 * por un pico de tráfico legítimo (un proveedor reintentando tras una caída
 * nuestra) sería peor que el abuso que evitaría. La protección contra abuso
 * es el tope de tamaño del cuerpo + el rechazo barato por firma inválida.
 */
import { NextRequest, NextResponse } from "next/server";
import { procesarWebhook } from "@/lib/billing/webhook";
import { crearGatewayDeEntorno } from "@/lib/billing/fake-gateway";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    // `req.text()` y NO `req.json()`: la firma se calcula sobre los bytes
    // exactos que envió el proveedor. Parsear y re-serializar cambia espacios
    // y orden de claves, y la firma deja de validar.
    const cuerpoCrudo = await req.text();

    const headers: Record<string, string> = {};
    req.headers.forEach((valor, clave) => {
      headers[clave.toLowerCase()] = valor;
    });

    const gateway = crearGatewayDeEntorno();
    const resultado = await procesarWebhook(gateway, cuerpoCrudo, headers);

    return NextResponse.json(resultado.body, { status: resultado.status });
  } catch (e) {
    // 500 a propósito: le pide al proveedor que reintente. Un fallo nuestro
    // (base caída, gateway sin configurar) no debe hacerle perder el evento.
    logError("billing/webhook", e);
    return NextResponse.json({ ok: false, detalle: "error interno" }, { status: 500 });
  }
}
