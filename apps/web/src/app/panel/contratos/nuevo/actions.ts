"use server";

import { revalidatePath } from "next/cache";
import { getTenant, getActor, getUfCLP } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { generarCalendario, validarRut } from "@housing/core";
import { canonicalRut } from "@/lib/rut";
import { logError } from "@/lib/logger";
import { cantidad } from "@/lib/format";

/** Error de dominio controlado: el mensaje se devuelve al cliente tal cual. */
class DomainError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "DomainError";
  }
}

/* ─── Búsqueda de personas ─────────────────────────────────────── */

export type PersonaBusqueda = {
  id: string;
  nombre: string;
  rut: string;
  email: string | null;
};

export async function buscarPersonas(query: string): Promise<PersonaBusqueda[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  try {
    const tenant = await getTenant();
    const personas = await withTenant(tenant.id, (tx) => tx.persona.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { nombre: { contains: q, mode: "insensitive" } },
          { rut:    { contains: q } },
        ],
      },
      take: 8,
      select: { id: true, nombre: true, rut: true, email: true },
      orderBy: { nombre: "asc" },
    }));
    return personas;
  } catch {
    return [];
  }
}

/* ─── Crear contrato (wizard completo) ────────────────────────── */

export type ResultadoContrato =
  | { ok: true;  contratoId: string }
  | { ok: false; error: string };

export interface DatosContrato {
  propiedadId:   string;
  propietarioId: string;
  /** ID de persona existente. Vacío si se crea nueva. */
  arrendatarioId: string;
  /** Datos para crear arrendatario nuevo (si arrendatarioId está vacío). */
  arrendatarioNuevo?: { nombre: string; rut: string; email?: string };
  denominacion:      "UF" | "CLP";
  valorArriendo:     number;
  diaVencimiento:    number;
  comisionCorredorPct: number;
  reajuste:          "anual" | "ninguna";
  moraTasaPct:       number;
  moraDiasGracia:    number;
  cobraGastoComun:   boolean;
  montoGastoComun:   number;
  garantiaMeses:        number;    // 0–2
  garantiaDenominacion: "UF" | "CLP";
  /** Monto de garantía en su denominación (nº de UF, o pesos). El asiento
   * contable se registra en CLP: si es UF se convierte con la UF del inicio. */
  garantiaMonto:        number;
  fechaInicio:       string;    // "YYYY-MM-DD"
  /** Omitir para indefinido (se generan 12 períodos). */
  fechaFin?:         string;    // "YYYY-MM-DD"
}

export async function crearContrato(data: DatosContrato): Promise<ResultadoContrato> {
  /* ── Validaciones server-side ──────────────────────────────── */
  if (!data.propiedadId)
    return { ok: false, error: "Propiedad requerida." };

  // Arrendatario: o bien un ID existente, o bien datos para crear nuevo
  const tieneIdExistente = !!data.arrendatarioId;
  const tieneNuevo       = !!(data.arrendatarioNuevo?.nombre?.trim() && data.arrendatarioNuevo?.rut?.trim());
  if (!tieneIdExistente && !tieneNuevo)
    return { ok: false, error: "Arrendatario requerido." };

  if (!Number.isFinite(data.valorArriendo) || data.valorArriendo <= 0)
    return { ok: false, error: "Valor de arriendo inválido: debe ser mayor que cero." };
  if (!Number.isInteger(data.diaVencimiento) || data.diaVencimiento < 1 || data.diaVencimiento > 28)
    return { ok: false, error: "Día de vencimiento debe estar entre 1 y 28." };
  if (!Number.isFinite(data.comisionCorredorPct) || data.comisionCorredorPct < 0 || data.comisionCorredorPct > 100)
    return { ok: false, error: "Comisión del corredor fuera de rango (0–100 %)." };
  if (!Number.isFinite(data.moraTasaPct) || data.moraTasaPct < 0)
    return { ok: false, error: "Tasa de mora inválida." };
  // V5: moraDiasGracia requiere entero (faltaba por completo)
  if (!Number.isInteger(data.moraDiasGracia) || data.moraDiasGracia < 0 || data.moraDiasGracia > 30)
    return { ok: false, error: "Días de gracia deben ser un entero entre 0 y 30." };
  // V1: garantiaMeses requiere entero (flotante 1.5 pasaba el check anterior)
  if (!Number.isInteger(data.garantiaMeses) || data.garantiaMeses < 0 || data.garantiaMeses > 2)
    return { ok: false, error: "Garantía debe ser 0, 1 o 2 meses." };
  // V3: montoGastoComun cuando se cobra
  if (data.cobraGastoComun && (!Number.isFinite(data.montoGastoComun) || data.montoGastoComun <= 0))
    return { ok: false, error: "El monto de gasto común debe ser mayor que cero." };
  // V4: monto de garantía cuando hay garantía
  if (data.garantiaMeses > 0 && (!Number.isFinite(data.garantiaMonto) || data.garantiaMonto <= 0))
    return { ok: false, error: "El monto de garantía debe ser mayor que cero." };
  if (data.garantiaMeses > 0 && data.garantiaDenominacion !== "UF" && data.garantiaDenominacion !== "CLP")
    return { ok: false, error: "Denominación de garantía inválida." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fechaInicio) || isNaN(new Date(data.fechaInicio).getTime()))
    return { ok: false, error: "Fecha de inicio inválida." };
  if (data.fechaFin !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.fechaFin) || isNaN(new Date(data.fechaFin).getTime()))
      return { ok: false, error: "Fecha de fin inválida." };
  }

  try {
    const actor  = await getActor();
    const tenant = actor.tenant;

    const fechaInicio = new Date(data.fechaInicio + "T00:00:00Z");

    /* Calcular fechaFin del calendario (puede diferir de la BD) */
    let fechaFinCalendario: Date;
    let fechaFinDB: Date | null;

    if (data.fechaFin) {
      fechaFinCalendario = new Date(data.fechaFin + "T00:00:00Z");
      fechaFinDB         = fechaFinCalendario;
      if (fechaFinCalendario < fechaInicio)
        return { ok: false, error: "La fecha de fin no puede ser anterior a la de inicio." };
    } else {
      // Indefinido → 12 períodos: último día del mes M + 11
      fechaFinCalendario = new Date(
        Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth() + 12, 0),
      );
      fechaFinDB = null; // indefinido en la BD
    }

    /* Generar el calendario de períodos */
    const periodos = generarCalendario({
      fechaInicio,
      fechaFin:       fechaFinCalendario,
      diaVencimiento: data.diaVencimiento,
      montoArriendo:  data.valorArriendo,
      denominacion:   data.denominacion,
      montoGastoComun: data.cobraGastoComun ? data.montoGastoComun : 0,
    });

    if (periodos.length === 0)
      return { ok: false, error: "No se generó ningún período con esas fechas." };

    /* Snapshot CLP de la garantía a la UF del día de inicio. Es lo que el
       corredor RECIBE en pesos y lo que registra el asiento GARANTIA_RECIBIDA
       (inmutable). Para garantía CLP el monto base ya está en pesos; para UF
       se convierte una sola vez. La devolución revaloriza el monto base a la
       UF del día de término, no este snapshot (ver cierre de contrato). */
    let garantiaMontoCLP = 0;
    if (data.garantiaMeses > 0) {
      garantiaMontoCLP =
        data.garantiaDenominacion === "UF"
          ? Math.round(data.garantiaMonto * (await getUfCLP(fechaInicio)))
          : Math.round(data.garantiaMonto);
    }

    const contrato = await withTenant(tenant.id, async (tx) => {
      /* 0a. SC-CRIT-1 + BL1: verificar que la propiedad pertenece al tenant
             Y que aún está en estado disponible/reservada (evita race condition
             donde dos requests crean contratos simultáneos para la misma propiedad) */
      const propVerif = await tx.propiedad.findFirst({
        where: {
          id:       data.propiedadId,
          tenantId: tenant.id,
          estado:   { in: ["disponible", "reservada"] },
        },
      });
      if (!propVerif)
        throw new DomainError(
          "La propiedad no está disponible o no pertenece a este corredor.",
        );
      // ADR-0013 (Fase D) — un Colaborador solo crea contratos sobre lo que tiene asignado.
      if (actor.rol !== "manager" && propVerif.asignadoAId !== actor.usuarioId)
        throw new DomainError("No tienes acceso a esta propiedad.");

      /* 0b. SC-CRIT-2: verificar que el propietario pertenece al tenant */
      const propietarioVerif = await tx.persona.findFirst({
        where: { id: data.propietarioId, tenantId: tenant.id },
      });
      if (!propietarioVerif)
        throw new DomainError(
          "El propietario indicado no pertenece a este corredor.",
        );

      /* 0c. SC-CRIT-4 + Resolver arrendatario (verificar, buscar o crear) */
      let arrendatarioId = data.arrendatarioId;
      if (arrendatarioId) {
        /* Verificar que el arrendatario existente pertenece al tenant */
        const arrVerif = await tx.persona.findFirst({
          where: { id: arrendatarioId, tenantId: tenant.id },
        });
        if (!arrVerif)
          throw new DomainError(
            "El arrendatario indicado no pertenece a este corredor.",
          );
      } else if (data.arrendatarioNuevo) {
        const { nombre, rut, email } = data.arrendatarioNuevo;
        // RUT-2: validar dígito verificador antes de crear persona
        if (!validarRut(rut.trim()))
          throw new DomainError("El RUT del arrendatario no es válido (verifique el dígito verificador).");
        // Forma canónica (sin puntos) — debe coincidir con la búsqueda del portal OTP.
        const rutCanon = canonicalRut(rut.trim());
        const existente = await tx.persona.findFirst({
          where: { tenantId: tenant.id, rut: rutCanon },
        });
        if (existente) {
          // RUT-3: no reemplazar en silencio el nombre/email de una persona ya
          // registrada con otro distinto — obliga a usar "Buscar existente" a propósito.
          if (existente.nombre.trim().toLowerCase() !== nombre.trim().toLowerCase())
            throw new DomainError(
              `Ya existe una persona registrada con este RUT: "${existente.nombre}". ` +
              `Usa "Buscar existente" para seleccionarla, o verifica el RUT si se trata de otra persona.`,
            );
          arrendatarioId = existente.id;
        } else {
          const nuevo = await tx.persona.create({
            data: {
              tenantId: tenant.id,
              nombre:   nombre.trim(),
              rut:      rutCanon,
              email:    email?.trim() || null,
            },
          });
          arrendatarioId = nuevo.id;
        }
      }

      /* 1. Contrato */
      const c = await tx.contrato.create({
        data: {
          tenantId:       tenant.id,
          propiedadId:    data.propiedadId,
          arrendatarioId,
          propietarioId:  data.propietarioId,
          estado:         "borrador",   // pendiente de firma — el corredor debe activar
          denominacion:   data.denominacion,
          valorArriendo:  data.valorArriendo,
          diaVencimiento: data.diaVencimiento,
          comisionCorredorPct: data.comisionCorredorPct,
          reajuste:       data.reajuste,
          moraTasaPct:    data.moraTasaPct,
          moraDiasGracia: data.moraDiasGracia,
          cobraGastoComun: data.cobraGastoComun,
          garantiaMeses:  data.garantiaMeses,
          garantiaDenominacion: data.garantiaMeses > 0 ? data.garantiaDenominacion : null,
          garantiaMontoBase:    data.garantiaMeses > 0 ? data.garantiaMonto : null,
          garantiaMontoCLP,
          fechaInicio,
          fechaFin:       fechaFinDB,
        },
      });

      /* 2. Períodos de pago */
      await tx.periodoPago.createMany({
        data: periodos.map((p) => ({
          tenantId:         tenant.id,
          contratoId:       c.id,
          numero:           p.numero,
          fechaInicio:      p.fechaInicio,
          fechaVencimiento: p.fechaVencimiento,
          montoBase:        p.montoBase,
          montoGastoComun:  p.montoGastoComun,
          estado:           "pendiente",
        })),
      });

      /* 3. Asiento de garantía recibida (si aplica) */
      if (garantiaMontoCLP > 0) {
        const detalleGarantia =
          data.garantiaDenominacion === "UF"
            ? `${data.garantiaMonto} UF`
            : `$${Math.round(data.garantiaMonto).toLocaleString("es-CL")}`;
        await tx.asientoLedger.create({
          data: {
            tenantId:       tenant.id,
            contratoId:     c.id,
            arrendatarioId,
            propietarioId:  data.propietarioId,
            tipo:           "GARANTIA_RECIBIDA",
            concepto:       "garantia",
            signo:          1,
            montoClp:       garantiaMontoCLP,
            monedaOrigen:   data.garantiaDenominacion,
            fechaEvento:    fechaInicio,
            descripcion:    `Garantía recibida: ${cantidad(data.garantiaMeses, "mes", "meses")} · ${detalleGarantia}`,
          },
        });
      }

      /* 4. Propiedad → reservada (no arrendada aún; se confirma al firmar el contrato) */
      await tx.propiedad.update({
        where: { id: data.propiedadId, tenantId: tenant.id },
        data:  { estado: "reservada" },
      });

      /* 5. Notificación: solicitud de firma al arrendatario */
      await tx.notificacion.create({
        data: {
          tenantId:   tenant.id,
          personaId:  arrendatarioId,
          contratoId: c.id,
          tipo:       "solicitud_firma",
          canal:      "email",
          // "pendiente", no "simulada": el despachador solo toma las pendientes,
          // así que marcarla simulada equivale a no avisarle nunca al arrendatario.
          estado:     "pendiente",
          asunto:     "Contrato de arriendo pendiente de firma",
          cuerpo:     `Tu contrato de arriendo (inicio ${data.fechaInicio}) está listo para firma. Coordina con tu corredor.`,
        },
      });

      return c;
    });

    revalidatePath("/panel/contratos");
    revalidatePath("/panel");
    revalidatePath("/panel/propiedades");

    return { ok: true, contratoId: contrato.id };
  } catch (e) {
    logError("crearContrato", e);
    // SC-CRIT-3: solo devolver al cliente errores de dominio controlados;
    // los errores de Prisma/DB se loguean server-side y NO se filtran al cliente.
    if (e instanceof DomainError) return { ok: false, error: e.message };
    return { ok: false, error: "Error al crear el contrato. Por favor intenta nuevamente." };
  }
}
