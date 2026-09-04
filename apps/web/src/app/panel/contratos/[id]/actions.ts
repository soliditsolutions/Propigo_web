"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { getActor, getUfCLPTx, type Actor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { generarCalendario, type PeriodoCalendario } from "@housing/core";
import { CausalTermino } from "@/generated/prisma/enums";
import { esc } from "@/lib/html";
import { logError } from "@/lib/logger";
import { DOCUMENTOS_DIR } from "@/lib/uploads";
import { cantidad, plural } from "@/lib/format";

export type ResultadoOk =
  | { ok: true }
  | { ok: false; error: string };

/** Error de dominio controlado — el mensaje llega al cliente tal cual. */
class DomainError extends Error {
  constructor(msg: string) { super(msg); this.name = "DomainError"; }
}

/** ADR-0013 (Fase D) — un Colaborador solo actúa sobre contratos de propiedades que tiene asignadas. */
function verificarOwnershipContrato(actor: Actor, asignadoAId: string | null): void {
  if (actor.rol !== "manager" && asignadoAId !== actor.usuarioId)
    throw new DomainError("No tienes acceso a este contrato.");
}

/**
 * Activa un contrato borrador → vigente.
 * Verifica tenant, estado y actualiza tanto el contrato como la propiedad.
 */
export async function activarContrato(contratoId: string): Promise<ResultadoOk> {
  if (!contratoId)
    return { ok: false, error: "ID de contrato requerido." };
  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    await withTenant(tenant.id, async (tx) => {
      /* Verificar que el contrato pertenece al tenant y está en borrador */
      const contrato = await tx.contrato.findFirst({
        where: { id: contratoId, tenantId: tenant.id, estado: "borrador" },
        select: { propiedadId: true, arrendatarioId: true, propiedad: { select: { asignadoAId: true } } },
      });
      if (!contrato)
        throw new DomainError(
          "El contrato no existe, no pertenece a este corredor, o ya fue activado.",
        );
      verificarOwnershipContrato(actor, contrato.propiedad.asignadoAId);

      /* Contrato → vigente + token de valoración (único, para uso posterior del arrendatario) */
      await tx.contrato.update({
        where: { id: contratoId, tenantId: tenant.id },
        data:  { estado: "vigente", tokenValoracion: randomUUID() },
      });

      /* Propiedad → arrendada (defensa en profundidad con tenantId) */
      await tx.propiedad.update({
        where: { id: contrato.propiedadId, tenantId: tenant.id },
        data:  { estado: "arrendada" },
      });

      /* Notificación: contrato activado */
      await tx.notificacion.create({
        data: {
          tenantId:   tenant.id,
          personaId:  contrato.arrendatarioId,
          contratoId,
          tipo:       "nuevo_contrato",
          canal:      "email",
          estado:     "pendiente",
          asunto:     "Contrato de arriendo activado",
          cuerpo:     "Tu contrato de arriendo quedó firmado y vigente.",
        },
      });
    });

    revalidatePath(`/panel/contratos/${contratoId}`);
    revalidatePath("/panel/contratos");
    revalidatePath("/panel/propiedades");
    revalidatePath("/panel");
    return { ok: true };
  } catch (e) {
    logError("activarContrato", e);
    if (e instanceof DomainError) return { ok: false, error: e.message };
    return { ok: false, error: "Error al activar el contrato. Por favor intenta nuevamente." };
  }
}

/**
 * Termina un contrato vigente (normal o anticipado).
 * La propiedad vuelve a estado "disponible".
 * Registra asientos RETENCION_GARANTIA / DEVOLUCION_GARANTIA en el ledger.
 */
export async function terminarContrato(
  contratoId: string,
  opts: {
    tipo: "normal" | "anticipado";
    montoRetencion: number; // 0 = devuelve todo; > 0 = retiene parte o todo
    /** Por qué termina. Fija el plazo de restitución y qué procedimiento
     *  procede; queda en el contrato como parte del registro del cierre. */
    causal: CausalTermino;
    /** Solo para las causales de desahucio: cuándo se notificó. La Ley 18.101
     *  cuenta los plazos de restitución desde acá, no desde la fecha de término. */
    fechaNotificacionDesahucio?: string; // "YYYY-MM-DD"
  },
): Promise<ResultadoOk> {
  if (!contratoId)
    return { ok: false, error: "ID de contrato requerido." };

  const montoRetencion = Math.round(Math.max(0, opts.montoRetencion));

  // La causal no puede venir vacía ni inventada: de ella dependen el plazo de
  // restitución y el procedimiento, así que no se acepta un valor fuera del enum.
  if (!opts.causal || !Object.values(CausalTermino).includes(opts.causal))
    return { ok: false, error: "Indica la causal de término." };

  const esDesahucio =
    opts.causal === "desahucio_arrendador" || opts.causal === "desahucio_arrendatario";
  let fechaDesahucio: Date | null = null;
  if (opts.fechaNotificacionDesahucio) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.fechaNotificacionDesahucio) ||
        isNaN(new Date(opts.fechaNotificacionDesahucio).getTime()))
      return { ok: false, error: "La fecha de notificación del desahucio no es válida." };
    fechaDesahucio = new Date(opts.fechaNotificacionDesahucio + "T00:00:00Z");
  }
  // El desahucio se cuenta desde su notificación: sin esa fecha, el plazo de
  // restitución de la Ley 18.101 no se puede calcular.
  if (esDesahucio && fechaDesahucio === null)
    return { ok: false, error: "Un desahucio necesita la fecha en que se notificó." };

  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    await withTenant(tenant.id, async (tx) => {
      /* Verificar que existe, pertenece al tenant y está vigente */
      const contrato = await tx.contrato.findFirst({
        where: { id: contratoId, tenantId: tenant.id, estado: "vigente" },
        select: {
          propiedadId: true, arrendatarioId: true, propietarioId: true,
          garantiaDenominacion: true, garantiaMontoBase: true, garantiaMontoCLP: true,
          propiedad: { select: { asignadoAId: true } },
        },
      });
      if (!contrato)
        throw new DomainError(
          "El contrato no existe, no pertenece a este corredor, o no está vigente.",
        );
      verificarOwnershipContrato(actor, contrato.propiedad.asignadoAId);

      // BL-DATE1: Date.UTC evita que hoy difiera según el timezone del servidor.
      const _ahora = new Date();
      const hoy = new Date(Date.UTC(_ahora.getUTCFullYear(), _ahora.getUTCMonth(), _ahora.getUTCDate()));

      // Snapshot en pesos de lo recibido al inicio (asiento GARANTIA_RECIBIDA).
      const garantiaSnapshotCLP = Number(contrato.garantiaMontoCLP);
      // Monto disponible a liquidar HOY. Si la garantía se pactó en UF, se
      // revaloriza a la UF del día de término (práctica legal chilena y
      // coherente con cómo el arriendo UF se valoriza a la UF del vencimiento);
      // si es CLP (o legacy), es el mismo snapshot. Se calcula en el servidor,
      // nunca se confía el máximo enviado por el cliente.
      const garantiaCLP =
        contrato.garantiaDenominacion === "UF" && contrato.garantiaMontoBase !== null
          ? Math.round(Number(contrato.garantiaMontoBase) * (await getUfCLPTx(tx, hoy)))
          : garantiaSnapshotCLP;
      const retencionFinal = Math.min(montoRetencion, garantiaCLP);
      const devolucionFinal = garantiaCLP - retencionFinal;
      // Diferencia UF entre lo recibido y lo que se restituye hoy. La aporta
      // (o descuenta) el propietario. Sin este asiento, v_garantia_retenida no
      // cerraría a cero para una garantía UF (recibida ≠ retención+devolución).
      // Base legal: Art. 21, Ley 18.101 — exige reajustar por UF los pagos y
      // devoluciones en mora entre las partes de todo contrato de arriendo
      // (verificado contra el texto vigente de la ley, revisión 2026-07-30).
      const reajusteCLP = garantiaCLP - garantiaSnapshotCLP;

      const nuevoEstado = opts.tipo === "anticipado" ? "terminado_anticipado" : "terminado";

      /* Contrato → terminado / terminado_anticipado */
      await tx.contrato.update({
        where: { id: contratoId, tenantId: tenant.id },
        data:  {
          estado: nuevoEstado,
          fechaTermino: hoy,
          causalTermino: opts.causal,
          fechaNotificacionDesahucio: fechaDesahucio,
        },
      });

      /* Cancelar períodos futuros pendientes/atrasados */
      await tx.periodoPago.updateMany({
        where: {
          contratoId,
          tenantId: tenant.id,
          estado:   { in: ["pendiente", "atrasado"] },
          fechaVencimiento: { gt: hoy },
        },
        data: { estado: "cancelado" },
      });

      /* Propiedad → disponible */
      await tx.propiedad.update({
        where: { id: contrato.propiedadId, tenantId: tenant.id },
        data:  { estado: "disponible" },
      });

      /* Asientos de garantía en el ledger (solo si había garantía) */
      if (garantiaCLP > 0) {
        /* Reajuste UF: cierra el desfase entre lo recibido y lo restituido hoy,
           para que la garantía liquide a cero en v_garantia_retenida. Solo
           existe cuando la garantía es UF y la UF cambió. Magnitud + signo,
           igual que el resto de los asientos. */
        if (reajusteCLP !== 0) {
          await tx.asientoLedger.create({
            data: {
              tenantId:       tenant.id,
              contratoId,
              arrendatarioId: contrato.arrendatarioId,
              propietarioId:  contrato.propietarioId,
              tipo:           "REAJUSTE_GARANTIA",
              concepto:       "garantia",
              signo:          reajusteCLP > 0 ? 1 : -1,
              montoClp:       Math.abs(reajusteCLP),
              fechaEvento:    hoy,
              descripcion:    reajusteCLP > 0
                ? "Reajuste UF de la garantía (mayor valor a restituir)"
                : "Reajuste UF de la garantía (menor valor a restituir)",
            },
          });
        }
        if (retencionFinal > 0) {
          await tx.asientoLedger.create({
            data: {
              tenantId:       tenant.id,
              contratoId,
              arrendatarioId: contrato.arrendatarioId,
              propietarioId:  contrato.propietarioId,
              tipo:           "RETENCION_GARANTIA",
              // Magnitud (como GARANTIA_RECIBIDA) — la dirección la aplica v_garantia_retenida.
              signo:          1,
              montoClp:       retencionFinal,
              fechaEvento:    hoy,
              descripcion:    `Retención por término ${opts.tipo} (daños/descuentos)`,
            },
          });
        }
        if (devolucionFinal > 0) {
          await tx.asientoLedger.create({
            data: {
              tenantId:       tenant.id,
              contratoId,
              arrendatarioId: contrato.arrendatarioId,
              propietarioId:  contrato.propietarioId,
              tipo:           "DEVOLUCION_GARANTIA",
              // Magnitud (como GARANTIA_RECIBIDA) — la dirección la aplica v_garantia_retenida.
              signo:          1,
              montoClp:       devolucionFinal,
              fechaEvento:    hoy,
              descripcion:    `Devolución de garantía al arrendatario`,
            },
          });
        }
      }

      /* Notificación al arrendatario */
      const tipoNotif = opts.tipo === "anticipado" ? "salida_anticipada" : "termino_contrato";
      const garantiaInfo = garantiaCLP > 0
        ? devolucionFinal > 0
          ? `Se devuelven ${devolucionFinal.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 })} de garantía.`
          : "La garantía fue retenida íntegramente por daños."
        : "";
      await tx.notificacion.create({
        data: {
          tenantId:  tenant.id,
          personaId: contrato.arrendatarioId,
          contratoId,
          tipo:      tipoNotif,
          canal:     "email",
          estado:    "pendiente",
          asunto:    opts.tipo === "anticipado"
            ? "Término anticipado de contrato de arriendo"
            : "Término de contrato de arriendo",
          cuerpo: `Tu contrato de arriendo ha sido dado por terminado. ${garantiaInfo}`,
        },
      });
    });

    revalidatePath(`/panel/contratos/${contratoId}`);
    revalidatePath("/panel/contratos");
    revalidatePath("/panel/propiedades");
    revalidatePath("/panel");
    return { ok: true };
  } catch (e) {
    logError("terminarContrato", e);
    if (e instanceof DomainError) return { ok: false, error: e.message };
    return { ok: false, error: "Error al terminar el contrato. Por favor intenta nuevamente." };
  }
}

/**
 * Adjunta un documento (tipo "anexo") a un contrato vigente.
 * El archivo ya debe haber sido subido a /api/upload?type=documentos.
 */
type ResultadoAnexo =
  | { ok: true;  documentoId: string }
  | { ok: false; error: string };

export async function adjuntarAnexo(
  contratoId: string,
  data: { nombre: string; storageKey: string },
): Promise<ResultadoAnexo> {
  if (!contratoId || !data.nombre?.trim() || !data.storageKey?.trim())
    return { ok: false, error: "Faltan datos del anexo." };

  // Validar que storageKey es un path conocido (evita path traversal)
  if (!/^\/uploads\/documentos\/[a-f0-9-]{36}\.(pdf)$/.test(data.storageKey))
    return { ok: false, error: "Archivo no válido." };

  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    const doc = await withTenant(tenant.id, async (tx) => {
      const contrato = await tx.contrato.findFirst({
        where: { id: contratoId, tenantId: tenant.id },
        select: { id: true, propiedad: { select: { asignadoAId: true } } },
      });
      if (!contrato) throw new DomainError("Contrato no encontrado.");
      verificarOwnershipContrato(actor, contrato.propiedad.asignadoAId);

      return tx.documento.create({
        data: {
          tenantId:   tenant.id,
          contratoId,
          tipo:       "anexo",
          nombre:     data.nombre.trim().slice(0, 120),
          storageKey: data.storageKey,
        },
      });
    });

    revalidatePath(`/panel/contratos/${contratoId}`);
    return { ok: true, documentoId: doc.id };
  } catch (e) {
    logError("adjuntarAnexo", e);
    if (e instanceof DomainError) return { ok: false, error: e.message };
    return { ok: false, error: "Error al adjuntar el anexo." } as ResultadoAnexo;
  }
}

/**
 * Genera un reconocimiento de deuda para períodos atrasados del contrato.
 * Crea un archivo HTML en /uploads/documentos/ y un registro Documento.
 */
type ResultadoDeuda =
  | { ok: true;  url: string; documentoId?: string }
  | { ok: false; error: string };

export async function generarReconocimientoDeuda(
  contratoId: string,
): Promise<ResultadoDeuda> {
  if (!contratoId) return { ok: false, error: "ID de contrato requerido." };

  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    const contrato = await withTenant(tenant.id, (tx) => tx.contrato.findFirst({
      where: { id: contratoId, tenantId: tenant.id },
      select: {
        id: true, denominacion: true, valorArriendo: true,
        arrendatario: { select: { nombre: true, rut: true, email: true } },
        propietario:  { select: { nombre: true, rut: true } },
        propiedad:    { select: { direccion: true, comuna: true, asignadoAId: true } },
        arrendatarioId: true, propietarioId: true,
        periodos: {
          where: { estado: { in: ["atrasado", "pendiente"] } },
          orderBy: { numero: "asc" },
          select: {
            numero: true, fechaVencimiento: true,
            montoBase: true, montoGastoComun: true, estado: true,
          },
        },
      },
    }));

    if (!contrato) return { ok: false, error: "Contrato no encontrado." };
    if (actor.rol !== "manager" && contrato.propiedad.asignadoAId !== actor.usuarioId)
      return { ok: false, error: "No tienes acceso a este contrato." };

    const periodosDeuda = contrato.periodos.filter(
      (p) => p.estado === "atrasado" || (p.estado === "pendiente" && p.fechaVencimiento < new Date()),
    );

    if (periodosDeuda.length === 0)
      return { ok: false, error: "El contrato no tiene deuda pendiente." };

    const totalDeuda = periodosDeuda.reduce(
      (s, p) => s + Number(p.montoBase) + Number(p.montoGastoComun), 0,
    );

    const fechaDoc = new Date().toLocaleDateString("es-CL", {
      day: "2-digit", month: "long", year: "numeric",
    });

    // FIX A1 — HTML Injection (CWE-79): todos los datos de BD se escapan con esc()
    // antes de interpolarse en el HTML. Un nombre como "<script>…</script>"
    // en un arrendatario se rendererizaría como texto, no como código.
    const filas = periodosDeuda.map((p) => {
      const monto = Number(p.montoBase) + Number(p.montoGastoComun);
      const venc  = new Date(p.fechaVencimiento).toLocaleDateString("es-CL", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
      });
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">#${esc(String(p.numero))}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${esc(venc)}</td><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right">${esc(monto.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }))}</td></tr>`;
    }).join("");

    const totalStr = totalDeuda.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reconocimiento de Deuda — Housing SOLIDIT</title>
<style>
  body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#1e293b;font-size:14px;line-height:1.6}
  h1{font-size:20px;color:#0f1f35;border-bottom:2px solid #0f1f35;padding-bottom:8px}
  h2{font-size:15px;color:#334155;margin-top:24px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#f1f5f9;padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#64748b}
  .total{background:#0f1f35;color:#fff;font-weight:bold;padding:10px 12px;text-align:right;font-size:16px}
  .footer{margin-top:40px;font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px}
</style>
</head>
<body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
  <div>
    <p style="margin:0;font-size:18px;font-weight:bold;color:#0f1f35">Housing</p>
    <p style="margin:0;font-size:10px;color:#64748b;letter-spacing:.1em">SOLIDIT</p>
  </div>
  <p style="margin:0;font-size:12px;color:#64748b">${fechaDoc}</p>
</div>
<h1>Reconocimiento de Deuda</h1>
<h2>Partes</h2>
<table>
  <tr><th>Rol</th><th>Nombre</th><th>RUT</th></tr>
  <tr><td style="padding:6px 12px">Deudor (arrendatario)</td><td style="padding:6px 12px">${esc(contrato.arrendatario.nombre)}</td><td style="padding:6px 12px">${esc(contrato.arrendatario.rut)}</td></tr>
  <tr><td style="padding:6px 12px">Acreedor (propietario)</td><td style="padding:6px 12px">${esc(contrato.propietario.nombre)}</td><td style="padding:6px 12px">${esc(contrato.propietario.rut)}</td></tr>
</table>
<p style="margin-top:12px"><strong>Propiedad:</strong> ${esc(contrato.propiedad.direccion)}${contrato.propiedad.comuna ? `, ${esc(contrato.propiedad.comuna)}` : ""}</p>
<h2>Detalle de la Deuda</h2>
<table>
  <tr><th>#Período</th><th>Vencimiento</th><th style="text-align:right">Monto</th></tr>
  ${filas}
</table>
<div class="total">Total adeudado: ${esc(totalStr)}</div>
<h2>Declaración</h2>
<p>
  Por medio del presente documento, <strong>${esc(contrato.arrendatario.nombre)}</strong> (RUT ${esc(contrato.arrendatario.rut)}),
  en adelante "el deudor", reconoce adeudar a <strong>${esc(contrato.propietario.nombre)}</strong> (RUT ${esc(contrato.propietario.rut)}),
  la suma de <strong>${esc(totalStr)}</strong> (${esc(String(totalDeuda).replace(/\B(?=(\d{3})+(?!\d))/g, "."))} pesos chilenos),
  correspondiente a arriendo${contrato.propiedad.comuna ? ` de la propiedad ubicada en ${esc(contrato.propiedad.direccion)}, ${esc(contrato.propiedad.comuna)}` : ""},
  según el detalle indicado anteriormente.
</p>
<p>
  El deudor reconoce este saldo como líquido, indiscutido y actualmente exigible,
  comprometiéndose a su pago inmediato. En caso de no cumplir con el pago, el acreedor
  podrá ejercer las acciones legales correspondientes, incluyendo el procedimiento
  monitorio de arrendamiento conforme a la Ley N° 18.101 y la Ley N° 21.461.
</p>
<p style="margin-top:24px">__________________________________<br>Firma deudor: ${esc(contrato.arrendatario.nombre)}</p>
<div class="footer">
  <p>Documento generado el ${fechaDoc} por Housing SOLIDIT | Gestión de Arriendos</p>
  <p>Los datos personales son tratados conforme a la Ley N° 21.719 sobre Protección de Datos Personales.</p>
</div>
</body>
</html>`;

    const uuid     = randomUUID();
    const fileName = `${uuid}.html`;
    // SEC: fuera de public/ — un reconocimiento de deuda contiene datos
    // personales y financieros del arrendatario; nunca debe quedar servible
    // sin autenticación (ver src/lib/uploads.ts).
    await mkdir(DOCUMENTOS_DIR, { recursive: true });
    await writeFile(join(DOCUMENTOS_DIR, fileName), html, "utf-8");

    const storageKey = `/uploads/documentos/${fileName}`;

    const doc = await withTenant(tenant.id, (tx) => tx.documento.create({
      data: {
        tenantId:   tenant.id,
        contratoId,
        tipo:       "reconocimiento_deuda",
        nombre:     `Reconocimiento de deuda — ${fechaDoc}`,
        storageKey,
      },
    }));

    revalidatePath(`/panel/contratos/${contratoId}`);
    return { ok: true, url: storageKey, documentoId: doc.id };
  } catch (e) {
    logError("generarReconocimientoDeuda", e);
    return { ok: false, error: "Error al generar el documento." };
  }
}

/**
 * Renueva un contrato vigente de plazo fijo.
 * Extiende la fechaFin y genera los períodos de pago adicionales.
 * Opcionalmente actualiza el valor de arriendo para los nuevos períodos.
 */
export async function renovarContrato(
  contratoId: string,
  opts: {
    nuevaFechaFin: string;       // "YYYY-MM-DD"
    nuevoValorArriendo?: number; // si se modifica la renta
  },
): Promise<ResultadoOk> {
  if (!contratoId)
    return { ok: false, error: "ID de contrato requerido." };

  // Validar que la fecha es parseable
  const nuevaFechaFinDate = new Date(opts.nuevaFechaFin + "T00:00:00Z");
  if (isNaN(nuevaFechaFinDate.getTime()))
    return { ok: false, error: "La nueva fecha de término no es válida." };

  if (opts.nuevoValorArriendo !== undefined && opts.nuevoValorArriendo <= 0)
    return { ok: false, error: "El nuevo valor de arriendo debe ser mayor a 0." };

  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    await withTenant(tenant.id, async (tx) => {
      /* 1. Verificar contrato: vigente, con fechaFin, pertenece al tenant */
      const contrato = await tx.contrato.findFirst({
        where: { id: contratoId, tenantId: tenant.id, estado: "vigente" },
        select: {
          fechaFin:        true,
          fechaInicio:     true,
          diaVencimiento:  true,
          valorArriendo:   true,
          denominacion:    true,
          cobraGastoComun: true,
          arrendatarioId:  true,
          propiedad:       { select: { asignadoAId: true } },
        },
      });
      if (!contrato)
        throw new DomainError(
          "El contrato no existe, no está vigente o no pertenece a este corredor.",
        );
      verificarOwnershipContrato(actor, contrato.propiedad.asignadoAId);
      if (!contrato.fechaFin)
        throw new DomainError(
          "Solo se pueden renovar contratos a plazo fijo (con fecha de término definida).",
        );
      if (nuevaFechaFinDate <= contrato.fechaFin)
        throw new DomainError(
          "La nueva fecha de término debe ser posterior a la fecha de término actual.",
        );

      /* 2. Obtener el último período para continuar numeración, mes y montoGastoComun */
      const ultimoPeriodo = await tx.periodoPago.findFirst({
        where: { contratoId, tenantId: tenant.id },
        orderBy: { numero: "desc" },
        select: { numero: true, fechaVencimiento: true, montoGastoComun: true },
      });

      // Inicio del primer período nuevo: mes siguiente al último existente
      let inicioPrimeroNuevo: Date;
      if (ultimoPeriodo) {
        const y = ultimoPeriodo.fechaVencimiento.getUTCFullYear();
        const m = ultimoPeriodo.fechaVencimiento.getUTCMonth();
        // Date.UTC con mes 12 desborda correctamente a enero del año siguiente
        inicioPrimeroNuevo = new Date(Date.UTC(y, m + 1, 1));
      } else {
        // Contrato vigente sin períodos — generamos desde el mes siguiente a fechaFin actual
        const y = contrato.fechaFin.getUTCFullYear();
        const m = contrato.fechaFin.getUTCMonth();
        inicioPrimeroNuevo = new Date(Date.UTC(y, m + 1, 1));
      }

      if (inicioPrimeroNuevo > nuevaFechaFinDate)
        throw new DomainError(
          "La nueva fecha de término no genera períodos adicionales.",
        );

      /* 3. Generar el calendario de nuevos períodos */
      const nuevoValor = opts.nuevoValorArriendo ?? Number(contrato.valorArriendo);

      // montoGastoComun se propaga desde el último período existente
      const montoGastoComun = contrato.cobraGastoComun
        ? Number(ultimoPeriodo?.montoGastoComun ?? 0)
        : 0;

      const nuevosCalendario = generarCalendario({
        fechaInicio:     inicioPrimeroNuevo,
        fechaFin:        nuevaFechaFinDate,
        diaVencimiento:  contrato.diaVencimiento,
        montoArriendo:   nuevoValor,
        denominacion:    contrato.denominacion as "UF" | "CLP",
        montoGastoComun,
      });

      if (nuevosCalendario.length === 0)
        throw new DomainError(
          "No se generó ningún período con la nueva fecha de término.",
        );

      /* 4. Insertar nuevos períodos (con número offset) */
      const offsetNumero = ultimoPeriodo?.numero ?? 0;
      await tx.periodoPago.createMany({
        data: nuevosCalendario.map((p: PeriodoCalendario) => ({
          tenantId:        tenant.id,
          contratoId,
          numero:          p.numero + offsetNumero,
          fechaInicio:     p.fechaInicio,
          fechaVencimiento: p.fechaVencimiento,
          montoBase:       p.montoBase,
          montoGastoComun: p.montoGastoComun,
          // estado: "pendiente" (default del schema)
        })),
      });

      /* 5. Actualizar contrato: nueva fechaFin (y valor si cambió) */
      await tx.contrato.update({
        where: { id: contratoId, tenantId: tenant.id },
        data: {
          fechaFin: nuevaFechaFinDate,
          ...(opts.nuevoValorArriendo !== undefined
            ? { valorArriendo: opts.nuevoValorArriendo }
            : {}),
        },
      });

      /* 6. Notificación al arrendatario */
      await tx.notificacion.create({
        data: {
          tenantId:  tenant.id,
          personaId: contrato.arrendatarioId,
          contratoId,
          tipo:   "renovacion_contrato",
          canal:  "email",
          estado: "pendiente",
          asunto: "Renovación de contrato de arriendo",
          cuerpo: `Tu contrato de arriendo ha sido renovado hasta el ${opts.nuevaFechaFin}. `
            + `Generamos ${cantidad(nuevosCalendario.length, "período", "períodos")} ${plural(nuevosCalendario.length, "adicional", "adicionales")} de pago.`,
        },
      });
    });

    revalidatePath(`/panel/contratos/${contratoId}`);
    revalidatePath("/panel/contratos");
    return { ok: true };
  } catch (e) {
    logError("renovarContrato", e);
    if (e instanceof DomainError) return { ok: false, error: e.message };
    return { ok: false, error: "Error al renovar el contrato. Por favor intenta nuevamente." };
  }
}

/**
 * Cancela un contrato que está en borrador (nunca fue firmado).
 * La propiedad vuelve de "reservada" a "disponible".
 */
export async function cancelarContratoBorrador(contratoId: string): Promise<ResultadoOk> {
  if (!contratoId)
    return { ok: false, error: "ID de contrato requerido." };
  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    await withTenant(tenant.id, async (tx) => {
      /* Verificar que existe, pertenece al tenant y está en borrador */
      const contrato = await tx.contrato.findFirst({
        where: { id: contratoId, tenantId: tenant.id, estado: "borrador" },
        select: { propiedadId: true, propiedad: { select: { asignadoAId: true } } },
      });
      if (!contrato)
        throw new DomainError(
          "El contrato no existe, no pertenece a este corredor, o ya fue activado/terminado.",
        );
      verificarOwnershipContrato(actor, contrato.propiedad.asignadoAId);

      // BL-DATE1: Date.UTC evita que hoy difiera según el timezone del servidor.
      const _ahora = new Date();
      const hoy = new Date(Date.UTC(_ahora.getUTCFullYear(), _ahora.getUTCMonth(), _ahora.getUTCDate()));

      // BL-ST1: "cancelado" diferencia borradores anulados de contratos que llegaron a estar vigentes.
      await tx.contrato.update({
        where: { id: contratoId, tenantId: tenant.id },
        data:  { estado: "cancelado", fechaTermino: hoy },
      });

      /* Cancelar todos los períodos pendientes (el contrato nunca llegó a activarse) */
      await tx.periodoPago.updateMany({
        where: {
          contratoId,
          tenantId: tenant.id,
          estado:   { in: ["pendiente", "atrasado"] },
        },
        data: { estado: "cancelado" },
      });

      /* Propiedad → disponible (estaba reservada por este contrato) */
      await tx.propiedad.update({
        where: { id: contrato.propiedadId, tenantId: tenant.id },
        data:  { estado: "disponible" },
      });
    });

    revalidatePath(`/panel/contratos/${contratoId}`);
    revalidatePath("/panel/contratos");
    revalidatePath("/panel/propiedades");
    revalidatePath("/panel");
    return { ok: true };
  } catch (e) {
    logError("cancelarContratoBorrador", e);
    if (e instanceof DomainError) return { ok: false, error: e.message };
    return { ok: false, error: "Error al cancelar el contrato. Por favor intenta nuevamente." };
  }
}
