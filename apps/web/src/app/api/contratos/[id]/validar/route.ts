import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getTenant } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { evaluarReglasContrato } from "@/lib/contract-rules";
import { idFiltro } from "@/lib/busqueda";
import { logError } from "@/lib/logger";

export type ValidacionEstado = "aprobado" | "con_alertas" | "requiere_revision";

export interface ValidacionResultado {
  estado: ValidacionEstado;
  resumen: string;
  categorias: {
    estructura:         { ok: boolean; alertas: string[] };
    cumplimiento_legal: { ok: boolean; alertas: string[] };
    montos:             { ok: boolean; alertas: string[] };
    informacion_partes: { ok: boolean; alertas: string[] };
  };
  alertas_criticas: string[];
  recomendaciones:  string[];
}

const ESTADOS_PERMITIDOS: ValidacionEstado[] = ["aprobado", "con_alertas", "requiere_revision"];
const MAX_STRING_LEN = 2000;
const MAX_ARRAY_LEN  = 20;

/** Garantiza que la respuesta del LLM cumple el esquema antes de persistirla. */
export function validarEsquema(raw: unknown): ValidacionResultado {
  if (typeof raw !== "object" || raw === null) throw new Error("Respuesta IA no es un objeto.");
  const r = raw as Record<string, unknown>;

  if (!ESTADOS_PERMITIDOS.includes(r.estado as ValidacionEstado))
    throw new Error(`estado inválido: "${r.estado}"`);
  if (typeof r.resumen !== "string")
    throw new Error("resumen no es string");

  const cats = r.categorias;
  if (typeof cats !== "object" || cats === null) throw new Error("categorias inválidas");
  for (const key of ["estructura", "cumplimiento_legal", "montos", "informacion_partes"] as const) {
    const c = (cats as Record<string, unknown>)[key];
    if (typeof c !== "object" || c === null) throw new Error(`categoría ${key} inválida`);
    const { ok, alertas } = c as Record<string, unknown>;
    if (typeof ok !== "boolean") throw new Error(`${key}.ok no es boolean`);
    if (!Array.isArray(alertas) || alertas.length > MAX_ARRAY_LEN)
      throw new Error(`${key}.alertas inválidas`);
    if (!alertas.every((a) => typeof a === "string"))
      throw new Error(`${key}.alertas contiene no-strings`);
  }

  if (!Array.isArray(r.alertas_criticas) || r.alertas_criticas.length > MAX_ARRAY_LEN
      || !r.alertas_criticas.every((a) => typeof a === "string"))
    throw new Error("alertas_criticas inválidas");
  if (!Array.isArray(r.recomendaciones) || r.recomendaciones.length > MAX_ARRAY_LEN
      || !r.recomendaciones.every((a) => typeof a === "string"))
    throw new Error("recomendaciones inválidas");

  // Truncar strings para prevenir payloads exagerados
  r.resumen = (r.resumen as string).slice(0, MAX_STRING_LEN);

  return r as unknown as ValidacionResultado;
}

/**
 * Elimina caracteres de control que permiten inyección de prompt en campos de texto.
 * Los datos de nombres/direcciones son ingresados por el corredor (usuario autenticado),
 * pero sanitizamos igual para prevenir manipulación del output de la IA.
 *
 * Filtro por código de carácter (evita literales invisibles en el fuente):
 *  - Elimina control chars (salvo \t \n \r), DEL, overrides bidi (U+202A–U+202E)
 *    e isolates (U+2066–U+2069) — vectores clásicos de prompt injection.
 *  - Reemplaza separadores de línea/párrafo Unicode (U+2028/U+2029) por espacio.
 */
export function sanitizarCampo(valor: string | null): string {
  if (!valor) return "";
  let out = "";
  for (const ch of valor) {
    const c = ch.codePointAt(0) ?? 0;
    if (
      c <= 0x08 || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f) ||
      c === 0x7f || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)
    ) continue;
    if (c === 0x2028 || c === 0x2029) { out += " "; continue; }
    out += ch;
  }
  return out.slice(0, 500);
}

/**
 * POST — Validación de los datos ESTRUCTURADOS del contrato (ADR-0012).
 * Motor de reglas determinístico y LOCAL (`@/lib/contract-rules`) — sin IA, sin
 * enviar nada afuera. Reproduce el checklist legal (garantía, mora, plazo,
 * día, RUTs, coherencia) sobre datos que ya están en la BD. El análisis de
 * IA sobre el texto de cláusulas de un documento subido vive en `validar-doc`.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    let tenant;
    try { tenant = await getTenant(); }
    catch { return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 }); }

    const { id: contratoId } = await params;
    if (!idFiltro(contratoId)) {
      return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
    }

    const contrato = await withTenant(tenant.id, (tx) => tx.contrato.findFirst({
      where: { id: contratoId, tenantId: tenant.id },
      include: {
        propietario:  { select: { rut: true } },
        arrendatario: { select: { rut: true } },
      },
    }));

    if (!contrato) {
      return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
    }

    const validacion = evaluarReglasContrato({
      propietarioRut:   contrato.propietario.rut,
      arrendatarioRut:  contrato.arrendatario.rut,
      valorArriendo:    Number(contrato.valorArriendo),
      denominacion:     contrato.denominacion,
      diaVencimiento:   contrato.diaVencimiento,
      garantiaMeses:    Number(contrato.garantiaMeses),
      garantiaMontoCLP: Number(contrato.garantiaMontoCLP),
      moraTasaPct:      Number(contrato.moraTasaPct),
      moraDiasGracia:   contrato.moraDiasGracia,
      fechaInicio:      contrato.fechaInicio,
      fechaFin:         contrato.fechaFin,
    });

    // Guardar resultado en DB
    await withTenant(tenant.id, (tx) => tx.contrato.update({
      where: { id: contratoId, tenantId: tenant.id },
      data: {
        validacionIa:     validacion as object,
        validacionEstado: validacion.estado,
        validacionAt:     new Date(),
      },
    }));

    return NextResponse.json({ ok: true, validacion });
  } catch (err) {
    const e = err as Error & { cause?: unknown; status?: number; code?: string };
    logError("api/contratos/validar", e);
    return NextResponse.json(
      { error: "Error interno al procesar la validación." },
      { status: 500 },
    );
  }
}

/**
 * PUT — El corredor confirma que revisó las observaciones y procede de todas formas.
 * Queda registrado en DB con timestamp para trazabilidad.
 */
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    let tenant;
    try { tenant = await getTenant(); }
    catch { return NextResponse.json({ error: "Servicio no disponible." }, { status: 503 }); }

    const { id: contratoId } = await params;
    if (!idFiltro(contratoId)) {
      return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
    }

    const confirmado = await withTenant(tenant.id, async (tx) => {
      const contrato = await tx.contrato.findFirst({
        where: { id: contratoId, tenantId: tenant.id },
        select: { id: true },
      });
      if (!contrato) return false;

      await tx.contrato.update({
        where: { id: contratoId, tenantId: tenant.id },
        data:  { validacionConfirmadaAt: new Date() },
      });
      return true;
    });

    if (!confirmado) {
      return NextResponse.json({ error: "Contrato no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logError("api/contratos/validar PUT", err);
    return NextResponse.json({ error: "Error al confirmar." }, { status: 500 });
  }
}
