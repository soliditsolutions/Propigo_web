import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { alcanceContrato } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { type ValidacionResultado, validarEsquema } from "../validar/route";
import { detectarPii } from "@/lib/pii-detector";
import { idFiltro } from "@/lib/busqueda";
import { logError } from "@/lib/logger";
import { checkRateLimit, respuestaLimite } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { consumirTokenIa } from "@/lib/plan-limits";
import { actorDeRuta } from "@/lib/actor-ruta";
import { ErrorIa, hayCupoDiarioIa, iaConfigurada } from "@/lib/ia/cloudflare";
import { extraerObjetoJson } from "@/lib/ia/json";
import { neutralizarCitas, revisarContratoConIA } from "@/lib/ia/contrato";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_TEXT_CHARS = 20_000;            // ~5 000 tokens — más que suficiente

/**
 * Sanitiza el texto extraído de un PDF/DOCX antes de enviarlo al LLM.
 * Elimina vectores de prompt injection comunes en documentos maliciosos:
 *  - Caracteres de control invisibles
 *  - Unicode RLO/LRO (text direction override — pueden ocultar instrucciones)
 *  - Separadores de párrafo Unicode ( ,  ) usados para inyectar líneas
 *  - Texto excesivamente largo (ya cubierto por MAX_TEXT_CHARS, pero cap adicional)
 */
export function sanitizarTextoDocumento(texto: string): string {
  return texto
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/(\n\s*){4,}/g, "\n\n\n")
    .trim();
}

// ── Extracción PDF ──────────────────────────────────────────────────────────
// pdf-parse v2 reemplazó la función callable de v1 por la clase `PDFParse`
// (new PDFParse({ data }).getText()) — sin este cambio, cualquier PDF real
// fallaba con "pdfParse is not a function" (encontrado al probar con un PDF
// real durante la verificación del gate de consentimiento IA).
export async function extraerTextoPdf(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf });
  try {
    const { text } = await parser.getText();
    return text.replace(/\s+/g, " ").trim();
  } finally {
    await parser.destroy();
  }
}

// ── Extracción DOCX (ZIP + zlib) ────────────────────────────────────────────
async function extraerTextoDocx(buf: Buffer): Promise<string> {
  const { inflateRawSync } = await import("zlib");

  let pos = 0;
  while (pos < buf.length - 30) {
    // Firma de cabecera local ZIP: PK\x03\x04
    if (
      buf[pos] === 0x50 && buf[pos + 1] === 0x4b &&
      buf[pos + 2] === 0x03 && buf[pos + 3] === 0x04
    ) {
      const compMethod = buf.readUInt16LE(pos + 8);
      const compSize   = buf.readUInt32LE(pos + 18);
      const nameLen    = buf.readUInt16LE(pos + 26);
      const extraLen   = buf.readUInt16LE(pos + 28);
      const entryName  = buf.subarray(pos + 30, pos + 30 + nameLen).toString("utf8");
      const dataStart  = pos + 30 + nameLen + extraLen;

      if (entryName === "word/document.xml") {
        const compressed = buf.subarray(dataStart, dataStart + compSize);
        const xml =
          compMethod === 8
            ? inflateRawSync(compressed).toString("utf8")
            : compressed.toString("utf8"); // method 0 = sin compresión

        // Párrafos → saltos de línea, luego quitar etiquetas XML
        return xml
          .replace(/<w:p[ >]/g, "\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/[ \t]+/g, " ")
          .replace(/\n[ \t]+/g, "\n")
          .trim();
      }

      const next = dataStart + compSize;
      pos = next > pos ? next : pos + 1;
    } else {
      pos++;
    }
  }
  throw new Error("Archivo DOCX inválido o sin entrada word/document.xml");
}

// ── POST /api/contratos/[id]/validar-doc ────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    // Rate limit por usuario — llamadas a IA externa son costosas, evita spam.
    const rl = checkRateLimit(`validar_doc:${session.sub}`, 10, 10 * 60_000);
    if (!rl.allowed) {
      return respuestaLimite("Demasiadas validaciones en poco tiempo.", rl.retryAfter);
    }

    // getActor (y no solo el tenant): un Colaborador solo opera sobre
    // contratos de propiedades asignadas a él (ADR-0013); si no, 404.
    const actor = await actorDeRuta("contratos/validar-doc");
    if (actor instanceof NextResponse) return actor;
    const tenant = actor.tenant;

    const { id: contratoId } = await params;
    if (!idFiltro(contratoId)) {
      return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
    }

    const contrato = await withTenant(tenant.id, (tx) => tx.contrato.findFirst({
      where:  { id: contratoId, tenantId: tenant.id, ...alcanceContrato(actor) },
      select: { id: true },
    }));
    if (!contrato) {
      return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
    }

    // ── Parseo multipart ──────────────────────────────────────────────────
    let form: FormData;
    try { form = await req.formData(); }
    catch {
      return NextResponse.json({ error: "Error al procesar el archivo enviado." }, { status: 400 });
    }

    const archivo = form.get("archivo");
    if (!archivo || !(archivo instanceof File)) {
      return NextResponse.json({ error: "Se requiere un archivo en el campo 'archivo'." }, { status: 400 });
    }

    // Consentimiento explícito ANTES de enviar el texto extraído a la IA externa
    // (Cloudflare Workers AI) — distinto del gate de PII más abajo. Sin esto, rechazamos aquí
    // aunque la UI lo hubiera permitido (defensa en profundidad).
    if (!form.get("consentIa")) {
      return NextResponse.json(
        { error: "Debes aceptar el envío del documento a nuestro proveedor de análisis por IA." },
        { status: 400 },
      );
    }

    // Registro auditable del consentimiento — se deja constancia de que se pidió
    // y se dio, independiente de si el análisis posterior tiene éxito o no.
    await withTenant(tenant.id, (tx) => tx.consentimientoIa.create({
      data: {
        tenantId:  tenant.id,
        usuarioId: session.sub,
        flujo:     "contrato_validar_doc",
        detalle:   contratoId,
        version:   "ia-v1.0",
        ip:        getClientIp(req),
      },
    }));

    if (archivo.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      );
    }

    const nombre  = archivo.name.toLowerCase();
    const isPdf   = nombre.endsWith(".pdf") || archivo.type === "application/pdf";
    const isDocx  = nombre.endsWith(".docx") ||
                    archivo.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: "Formato no soportado. Solo se aceptan archivos PDF (.pdf) o Word (.docx)." },
        { status: 415 },
      );
    }

    // ── Extracción de texto ───────────────────────────────────────────────
    const buf = Buffer.from(await archivo.arrayBuffer());
    let texto: string;
    try {
      texto = isPdf ? await extraerTextoPdf(buf) : await extraerTextoDocx(buf);
    } catch (e) {
      logError("validar-doc/extraccion", e);
      return NextResponse.json(
        { error: "No se pudo extraer texto del archivo. Si es un PDF escaneado (solo imágenes), el texto no es legible directamente." },
        { status: 422 },
      );
    }

    if (texto.length < 100) {
      return NextResponse.json(
        { error: "El documento no contiene texto suficiente para analizar (menos de 100 caracteres extraídos)." },
        { status: 422 },
      );
    }

    // ── Llamada a la IA ───────────────────────────────────────────────────
    if (!iaConfigurada()) {
      return NextResponse.json(
        { error: "Servicio de validación IA no configurado." },
        { status: 503 },
      );
    }

    // Sanitizar antes de truncar: elimina vectores de inyección de prompt
    const textoSanitizado = sanitizarTextoDocumento(texto);

    // Gate FAIL-CLOSED (ADR-0012): el borrador a analizar NO debe contener datos
    // personales. Si detectamos identificadores duros (RUT válido mod-11, email o
    // teléfono), NO se envía a la IA externa — la de-identificación es lo que hace
    // que lo que cruza no sea dato personal. Nombres/direcciones genéricos quedan
    // bajo responsabilidad del corredor (disclaimer del paso), acá atrapamos los duros.
    const pii = detectarPii(textoSanitizado);
    if (!pii.limpio) {
      const tipos = pii.hallazgos
        .map((h) => ({ rut: "RUT", email: "correo", telefono: "teléfono" }[h.tipo]))
        .join(", ");
      return NextResponse.json(
        {
          error:
            `El documento contiene datos personales (${tipos}). Este análisis requiere un ` +
            `borrador SIN información personal: quita RUTs, correos y teléfonos y vuelve a intentarlo.`,
        },
        { status: 422 },
      );
    }

    const textoEnviado = textoSanitizado.length > MAX_TEXT_CHARS
      ? textoSanitizado.slice(0, MAX_TEXT_CHARS) + "\n\n[...texto truncado por longitud máxima...]"
      : textoSanitizado;

    // Cupo diario de IA del plan (Fase B0). Se descuenta acá, lo más tarde
    // posible: si se hiciera al entrar, un archivo rechazado por tamaño, por
    // PII o por formato le habría gastado un token al corredor sin que la IA
    // llegara a ejecutarse nunca. El descuento es atómico (ver plan-limits.ts),
    // así que dos peticiones simultáneas no pueden pasarse del cupo.
    //
    // Es distinto del rate limit de más arriba: ese frena ráfagas por usuario;
    // este hace valer lo que el plan vende, por tenant y por día.
    //
    // El tope diario de la IA (de toda la plataforma) se mira antes: un corte por
    // demanda no debe gastarle una revisión a quien no la pudo usar.
    if (!(await hayCupoDiarioIa("contrato_validar_doc"))) {
      return NextResponse.json(
        { error: "La revisión con IA tiene mucha demanda hoy. Intenta de nuevo mañana." },
        { status: 503 },
      );
    }
    const cupoIa = await withTenant(tenant.id, (tx) =>
      consumirTokenIa(tx, tenant.id, tenant.plan),
    );
    if (!cupoIa.permitido) {
      return NextResponse.json(
        {
          error:
            `Agotaste tus ${cupoIa.max} revisiones de contrato con IA de hoy. ` +
            "El cupo se renueva mañana, o puedes subir de plan para tener más.",
          // El panel refresca su indicador con esto, así queda en 3/3 sin
          // necesidad de recargar la página para enterarse.
          cupoIa: { usado: cupoIa.usado, max: cupoIa.max },
        },
        { status: 429 },
      );
    }

    let respuestaIa: Awaited<ReturnType<typeof revisarContratoConIA>>;
    try {
      respuestaIa = await revisarContratoConIA(textoEnviado, isPdf ? "PDF" : "DOCX");
    } catch (e) {
      logError("validar-doc/ia", e);
      // Tope diario o límite del proveedor: reintentar no sirve hasta mañana.
      if (e instanceof ErrorIa && (e.codigo === "cupo_diario" || e.codigo === "limite_proveedor")) {
        return NextResponse.json(
          { error: "La revisión con IA tiene mucha demanda hoy. Intenta de nuevo mañana." },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Error al consultar el servicio de IA. Intenta nuevamente." },
        { status: 502 },
      );
    }

    let validacion: ValidacionResultado;
    try {
      const parsed = extraerObjetoJson(respuestaIa.texto);
      validacion = validarEsquema(parsed);
    } catch (parseErr) {
      logError("validar-doc/parse", parseErr instanceof Error ? parseErr : new Error(String(parseErr)));
      return NextResponse.json(
        { error: "La IA devolvió una respuesta inesperada. Intenta nuevamente." },
        { status: 500 },
      );
    }

    // El contexto legal lo ponemos nosotros: una ley que el modelo cite y no
    // esté en nuestra lista se reemplaza antes de mostrarla o guardarla.
    const citas = neutralizarCitas(validacion);
    validacion = citas.resultado;
    if (citas.reemplazadas > 0) {
      logError("validar-doc/citas", new Error(`${citas.reemplazadas} cita(s) de ley fuera de la lista`));
    }

    // ── Guardar en DB (sobreescribe validación anterior) ─────────────────
    await withTenant(tenant.id, (tx) => tx.contrato.update({
      where: { id: contratoId, tenantId: tenant.id },
      data:  {
        validacionIa:            validacion as object,
        validacionEstado:        validacion.estado,
        validacionAt:            new Date(),
        validacionConfirmadaAt:  null, // requiere nueva confirmación
      },
    }));

    return NextResponse.json({
      ok: true,
      validacion,
      cupoIa: { usado: cupoIa.usado, max: cupoIa.max },
    });

  } catch (err) {
    const e = err as Error & { cause?: unknown };
    logError("api/contratos/validar-doc", e);
    return NextResponse.json(
      { error: "Error interno al procesar el documento." },
      { status: 500 },
    );
  }
}
