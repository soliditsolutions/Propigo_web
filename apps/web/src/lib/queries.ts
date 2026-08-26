import { redirect } from "next/navigation";
import { prisma } from "./db";
import { getSession } from "./auth";
import { withTenant, type TenantClient } from "./tenant-db";
import type { Tenant } from "@/generated/prisma/client";
import { convertirUfAClp, esPeriodoDeReajuste } from "@housing/core";
import { getCupoPropiedades, getPlanEfectivo } from "./plans";
import { consultarConsumoIaHoy } from "./plan-limits";

export type Actor = {
  usuarioId: string;
  tenantId:  string;
  rol:       "manager" | "colaborador";
  tenant:    Tenant;
};

/**
 * Resuelve el actor autenticado desde el JWT de sesión: valida que el Usuario
 * siga activo (ADR-0013, cuentas multi-usuario — un Collaborator desactivado
 * pierde acceso en su próximo request, ya que el JWT es stateless) y devuelve
 * su Tenant.
 *
 * FIX C1 — Multi-tenancy bypass (IDOR horizontal):
 * La implementación anterior de getTenant() usaba `findFirst({ orderBy: createdAt })`,
 * lo que hacía que todos los usuarios operasen siempre sobre el mismo tenant (el
 * más antiguo). En un escenario multi-tenant cualquier corredor podía leer y
 * modificar datos de otro corredor.
 *
 * La solución correcta es leer el `tenantId` del JWT firmado del usuario activo.
 * El JWT es verificado criptográficamente en cada request → no puede falsificarse.
 * La consulta a `usuario` va dentro de withTenant() porque la tabla está sujeta
 * a RLS (tenant_isolation, setup.sql) — sin `app.current_tenant_id` seteado
 * housing_app vería 0 filas.
 *
 * Uso: Server Actions y API Routes con sesión de usuario autenticado.
 */
export async function getActor(): Promise<Actor> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const usuario = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
    where:  { id: session.sub },
    select: { id: true, tenantId: true, rol: true, desactivadoEn: true, tenant: true },
  }));
  if (!usuario || usuario.desactivadoEn !== null) {
    // ADR-0013 — mismo caso que el guard de panel/layout.tsx (un Collaborator
    // desactivado no debe ver un error crudo), pero Next.js ejecuta el layout
    // y la page en paralelo, así que una page que llega a getActor() primero
    // puede ganarle la carrera al redirect() del layout. Este redirect (en
    // vez de throw) es la garantía real, no solo defensa en profundidad.
    redirect("/api/auth/logout");
  }
  return {
    usuarioId: usuario.id,
    tenantId:  usuario.tenantId,
    rol:       usuario.rol,
    tenant:    usuario.tenant,
  };
}

/** Wrapper delgado sobre getActor() — mantiene compatibles los 17+ call sites existentes. */
export async function getTenant(): Promise<Tenant> {
  return (await getActor()).tenant;
}

/**
 * ADR-0013 (Fase D) — ids de `Propiedad` visibles para el actor.
 *
 * Devuelve `null` si el actor es `manager` (sin filtro — ve el 100% del
 * tenant, comportamiento histórico sin cambios). Para un `colaborador`
 * devuelve la lista de ids con `asignadoAId === actor.usuarioId` (puede ser
 * vacía si no tiene nada asignado).
 *
 * Los call sites deben tratar `null` como "no agregar filtro" y un array
 * (incluso vacío) como "agregar `id: { in: propiedadIds }`" (o el equivalente
 * `contrato: { propiedadId: { in: propiedadIds } }` en modelos que cuelgan de
 * `Contrato`, ya que `PeriodoPago`/`Voucher`/`Notificacion` no tienen FK
 * directa a `Propiedad`).
 */
export async function propiedadIdsVisibles(actor: Actor): Promise<string[] | null> {
  if (actor.rol === "manager") return null;
  const props = await withTenant(actor.tenantId, (tx) => tx.propiedad.findMany({
    where:  { tenantId: actor.tenantId, asignadoAId: actor.usuarioId },
    select: { id: true },
  }));
  return props.map((p) => p.id);
}

/**
 * Devuelve todos los tenants activos ordenados por fecha de creación.
 *
 * Uso EXCLUSIVO para operaciones de sistema sin sesión de usuario:
 * cron jobs, webhooks, procesos de background.
 * NO llamar desde rutas autenticadas por usuario.
 */
export async function getAllTenantsForSystem() {
  return prisma.tenant.findMany({ orderBy: { createdAt: "asc" } });
}

// Los tipos restringen view y col a valores conocidos y de confianza,
// previniendo cualquier inyección SQL a través de esta función.
type SumView = "v_deuda_arrendatario" | "v_billetera_propietario" | "v_gasto_comun_recaudado";
type SumCol  = "saldo_clp" | "recaudado_clp";

async function sumView(tx: TenantClient, view: SumView, col: SumCol, tenantId: string): Promise<number> {
  const rows = await tx.$queryRawUnsafe<{ s: string | null }[]>(
    `SELECT COALESCE(SUM(${col}), 0)::text AS s FROM ${view} WHERE tenant_id = $1::uuid`,
    tenantId,
  );
  return Number(rows[0]?.s ?? 0);
}

export async function getResumen(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    await marcarPeriodosAtrasadosTx(tx, tenantId);

    // Secuencial, no Promise.all: tx comparte una única conexión Postgres
    // dentro de la transacción interactiva — lanzar queries "en paralelo"
    // sobre ella dispara el warning de pg "client already executing a
    // query" y no aporta paralelismo real (una sola conexión física).
    const propiedadesPorEstado = await tx.propiedad.groupBy({
      by: ["estado"],
      where: { tenantId },
      _count: { _all: true },
    });
    const contratosVigentes = await tx.contrato.count({ where: { tenantId, estado: "vigente" } });
    const periodosAtrasados = await tx.periodoPago.count({ where: { tenantId, estado: "atrasado" } });
    const deudaTotal = await sumView(tx, "v_deuda_arrendatario", "saldo_clp", tenantId);
    const billeteraTotal = await sumView(tx, "v_billetera_propietario", "saldo_clp", tenantId);
    const gcRecaudado = await sumView(tx, "v_gasto_comun_recaudado", "recaudado_clp", tenantId);
    const proximos = await tx.periodoPago.findMany({
      where: { tenantId, estado: { in: ["pendiente", "atrasado"] } },
      orderBy: { fechaVencimiento: "asc" },
      take: 50,
      include: {
        contrato: {
          select: {
            denominacion: true,
            arrendatario: { select: { nombre: true } },
            propiedad: { select: { direccion: true, comuna: true } },
          },
        },
      },
    });

    const propiedades = { total: 0, disponible: 0, reservada: 0, arrendada: 0 } as Record<
      string,
      number
    >;
    for (const g of propiedadesPorEstado) {
      propiedades[g.estado] = g._count._all;
      propiedades.total += g._count._all;
    }

    return {
      propiedades,
      contratosVigentes,
      periodosAtrasados,
      deudaTotal,
      billeteraTotal,
      gcRecaudado,
      proximos: proximos.map((p) => ({
        id: p.id,
        fechaVencimiento: p.fechaVencimiento,
        montoBase: Number(p.montoBase),
        montoGastoComun: Number(p.montoGastoComun),
        estado: p.estado,
        contrato: p.contrato,
      })),
    };
  });
}

export async function getContratos(tenantId: string, propiedadIds?: string[] | null) {
  const rows = await withTenant(tenantId, (tx) => tx.contrato.findMany({
    where: { tenantId, ...(propiedadIds ? { propiedadId: { in: propiedadIds } } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      propiedad: { select: { direccion: true, comuna: true } },
      arrendatario: { select: { nombre: true } },
      propietario: { select: { nombre: true } },
      _count: { select: { periodos: true } },
    },
  }));
  return rows.map((c) => ({
    id: c.id,
    estado: c.estado,
    denominacion: c.denominacion,
    valorArriendo: Number(c.valorArriendo),
    diaVencimiento: c.diaVencimiento,
    comisionCorredorPct: Number(c.comisionCorredorPct),
    reajuste: c.reajuste,
    moraTasaPct: Number(c.moraTasaPct),
    cobraGastoComun: c.cobraGastoComun,
    garantiaMeses: Number(c.garantiaMeses),
    garantiaMontoCLP: Number(c.garantiaMontoCLP),
    fechaInicio: c.fechaInicio,
    fechaFin: c.fechaFin,
    propiedad: c.propiedad,
    arrendatario: c.arrendatario,
    propietario: c.propietario,
    _count: c._count,
  }));
}

// ─── Cobros / Asistente de liquidación ──────────────────────────────────────

/** Valor CLP de la UF para una fecha dada (o la más cercana anterior). */
export async function getUfCLP(fecha: Date): Promise<number> {
  const uf = await prisma.serieUf.findFirst({
    where: { fecha: { lte: fecha } },
    orderBy: { fecha: "desc" },
  });
  if (!uf) {
    if (process.env.NODE_ENV === "production") {
      // BL-DATA1: fail-fast en prod — datos ausentes en la tabla son un error operacional,
      // no un caso borde tolerable. Usar 37000 silencioso ocultaría el problema.
      throw new Error(
        "[getUfCLP] Sin datos en SerieUf para la fecha solicitada. " +
        "Carga los valores en la tabla serie_uf antes de procesar arriendos en UF.",
      );
    }
    return 37000; // fallback MVP (solo dev/test)
  }
  return Number(uf.valorClp);
}

/**
 * Variante interna: reutilizable dentro de un `tx` que otra función ya abrió
 * con withTenant. Llamar a `getUfCLP` (cliente global `prisma`) desde dentro
 * de un callback de `withTenant` dispara una query fuera de la transacción
 * mientras esa transacción sigue abierta en la misma conexión — el pg driver
 * lo detecta como "client.query() ya está ejecutando una query" (deprecation
 * warning, futuro error duro en pg@9). Todo uso de la UF dentro de un `tx`
 * debe pasar por aquí, no por `getUfCLP`.
 */
export async function getUfCLPTx(tx: TenantClient, fecha: Date): Promise<number> {
  const uf = await tx.serieUf.findFirst({
    where: { fecha: { lte: fecha } },
    orderBy: { fecha: "desc" },
  });
  if (!uf) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[getUfCLP] Sin datos en SerieUf para la fecha solicitada. " +
        "Carga los valores en la tabla serie_uf antes de procesar arriendos en UF.",
      );
    }
    return 37000; // fallback MVP (solo dev/test)
  }
  return Number(uf.valorClp);
}

/**
 * AUD-09: implementa la Regla 11 del modelo de dominio — "atrasado si vence
 * sin pago" — que hasta ahora no tenía ningún código que la ejecutara. Un
 * período nace `pendiente` (default del schema) y ningún proceso lo pasaba
 * nunca a `atrasado`, por lo que un período vencido sin pago quedaba
 * invisible para siempre: no aparecía en Cobros/Dashboard (que solo filtran
 * `atrasado`/`pagado`) y `simularPago` no podía conciliarlo (su compuerta
 * atómica exige `estado: "atrasado"`). Se invoca de forma perezosa (mismo
 * patrón que `verificarYExtenderCalendario`) en cada lectura relevante:
 * dashboard, cobros y detalle de contrato; y también desde el cron de
 * recordatorios para que el sistema quede correcto sin depender de que
 * alguien abra el panel.
 */
/** Variante interna: reutilizable dentro de un `tx` que otra función ya abrió con withTenant. */
async function marcarPeriodosAtrasadosTx(tx: TenantClient, tenantId: string): Promise<void> {
  // El corte es la medianoche UTC de HOY, no el instante exacto de la
  // ejecución — un período que vence hoy sigue "pendiente" durante todo el
  // día de hoy (el arrendatario aún tiene el día completo para pagar) y
  // recién pasa a "atrasado" cuando vence el día calendario, no una hora
  // arbitraria de la corrida (cron, carga de dashboard, etc.).
  const ahora = new Date();
  const hoy = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  await tx.periodoPago.updateMany({
    where: { tenantId, estado: "pendiente", fechaVencimiento: { lt: hoy } },
    data: { estado: "atrasado" },
  });
}

export async function marcarPeriodosAtrasados(tenantId: string): Promise<void> {
  return withTenant(tenantId, (tx) => marcarPeriodosAtrasadosTx(tx, tenantId));
}

export async function getPeriodosPendientes(tenantId: string, propiedadIds?: string[] | null) {
  return withTenant(tenantId, async (tx) => {
    await marcarPeriodosAtrasadosTx(tx, tenantId);
    const rows = await tx.periodoPago.findMany({
      where: {
        tenantId, estado: { in: ["pendiente", "atrasado", "en_revision"] },
        // PeriodoPago no tiene FK directa a Propiedad — filtra vía Contrato.
        ...(propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {}),
      },
      orderBy: { fechaVencimiento: "asc" },
      include: {
        ajustes: { select: { id: true, tipo: true, montoCLP: true, descripcion: true } },
        contrato: {
          select: {
            denominacion: true,
            comisionCorredorPct: true,
            moraTasaPct: true,
            moraDiasGracia: true,
            cobraGastoComun: true,
            arrendatario: { select: { nombre: true } },
            propiedad: { select: { direccion: true, comuna: true } },
          },
        },
      },
    });

    // arriendoCLP se fija a la UF del día de VENCIMIENTO del período (no la de
    // hoy) — la obligación se congela ese día; el pago tardío suma mora encima,
    // no revalúa la base. Mismo criterio que simularPago en cobros/actions.ts.
    const ufCache = new Map<string, number>();
    async function ufEnFecha(f: Date): Promise<number> {
      const k = f.toISOString().slice(0, 10);
      if (!ufCache.has(k)) ufCache.set(k, await getUfCLPTx(tx, f));
      return ufCache.get(k)!;
    }

    const out: PeriodoPendiente[] = [];
    for (const p of rows) {
      const arriendoCLP = p.contrato.denominacion === "UF"
        ? convertirUfAClp(Number(p.montoBase), await ufEnFecha(p.fechaVencimiento))
        : Math.round(Number(p.montoBase));
      out.push({
        id: p.id,
        fechaVencimiento: p.fechaVencimiento,
        montoBase: Number(p.montoBase),
        montoGastoComun: Number(p.montoGastoComun),
        estado: p.estado,
        moraTasaPct: Number(p.contrato.moraTasaPct),
        moraDiasGracia: p.contrato.moraDiasGracia,
        arriendoCLP,
        comisionPct: Number(p.contrato.comisionCorredorPct),
        ajustes: p.ajustes.map((a) => ({ id: a.id, tipo: a.tipo, montoCLP: Number(a.montoCLP), descripcion: a.descripcion })),
        contrato: {
          denominacion: p.contrato.denominacion,
          cobraGastoComun: p.contrato.cobraGastoComun,
          arrendatario: p.contrato.arrendatario,
          propiedad: p.contrato.propiedad,
        },
      });
    }
    return out;
  });
}

export type PeriodoPendiente = {
  id: string;
  fechaVencimiento: Date;
  montoBase: number;
  montoGastoComun: number;
  estado: string;
  moraTasaPct: number;
  moraDiasGracia: number;
  arriendoCLP: number;
  comisionPct: number;
  ajustes: { id: string; tipo: string; montoCLP: number; descripcion: string }[];
  contrato: {
    denominacion: string;
    cobraGastoComun: boolean;
    arrendatario: { nombre: string };
    propiedad: { direccion: string; comuna: string | null };
  };
};

export async function getContratoDetalle(tenantId: string, contratoId: string) {
  return withTenant(tenantId, (tx) => getContratoDetalleTx(tx, tenantId, contratoId));
}

// Secuencial, no Promise.all: mismo motivo que en getResumen — tx es una
// única conexión física por transacción interactiva. Lanza si no existe —
// el caller (contratos/[id]/page.tsx) lo captura y redirige a notFound().
async function getContratoDetalleTx(tx: TenantClient, tenantId: string, contratoId: string) {
  await marcarPeriodosAtrasadosTx(tx, tenantId);
  const contrato = await tx.contrato.findFirstOrThrow({
    where: { tenantId, id: contratoId },
    include: {
      propiedad: true,
      arrendatario: true,
      propietario: true,
      periodos: { orderBy: { numero: "asc" } },
      documentos: { orderBy: { createdAt: "desc" } },
      comentarios: {
        orderBy: { createdAt: "desc" },
        include: { documentos: { select: { id: true, nombre: true } } },
      },
      asientos: { orderBy: { fechaEvento: "desc" } },
    },
  });

  // Garantía disponible HOY — revalorizada a la UF del día si se pactó en UF
  // (mismo criterio que terminarContrato en actions.ts). v_garantia_retenida
  // no resta aquí: su "retenida_clp" es el saldo vivo en custodia (parte de
  // GARANTIA_RECIBIDA/REAJUSTE_GARANTIA, que suman, menos RETENCION/DEVOLUCION,
  // que restan) — en un contrato aún vigente solo existe el asiento RECIBIDA,
  // así que ese saldo ya ES el disponible; restarlo de garantiaRevaluadaCLP
  // los cancela entre sí y deja 0 siempre, ocultando la UI de retención en
  // CierreSection. garantiaRetenidaCLP se conserva solo para mostrar el saldo
  // en custodia en la tarjeta de "Garantía" (no representa daños retenidos).
  const hoy = new Date();
  const garantiaRevaluadaCLP =
    contrato.garantiaDenominacion === "UF" && contrato.garantiaMontoBase !== null
      ? Math.round(Number(contrato.garantiaMontoBase) * (await getUfCLPTx(tx, hoy)))
      : Number(contrato.garantiaMontoCLP);
  const retenidaRows = await tx.$queryRawUnsafe<{ retenida_clp: string | null }[]>(
    `SELECT retenida_clp FROM v_garantia_retenida WHERE tenant_id = $1::uuid AND contrato_id = $2::uuid`,
    tenantId, contratoId,
  );
  const garantiaRetenidaCLP = Number(retenidaRows[0]?.retenida_clp ?? 0);
  const garantiaDisponibleCLP = contrato.estado === "vigente" ? garantiaRevaluadaCLP : 0;

  return {
    ...contrato,
    valorArriendo: Number(contrato.valorArriendo),
    comisionCorredorPct: Number(contrato.comisionCorredorPct),
    moraTasaPct: Number(contrato.moraTasaPct),
    garantiaMeses: Number(contrato.garantiaMeses),
    garantiaMontoBase: contrato.garantiaMontoBase ? Number(contrato.garantiaMontoBase) : null,
    garantiaMontoCLP: Number(contrato.garantiaMontoCLP),
    garantiaRetenidaCLP,
    garantiaDisponibleCLP,
    validacionEstado: contrato.validacionEstado as import("@/app/api/contratos/[id]/validar/route").ValidacionEstado | null,
    periodos: contrato.periodos.map((p) => ({
      ...p,
      montoBase: Number(p.montoBase),
      montoGastoComun: Number(p.montoGastoComun),
    })),
    asientos: contrato.asientos.map((a) => ({ ...a, montoClp: Number(a.montoClp) })),
  };
}

const NOTIFICACION_TIPO_LABEL: Record<string, string> = {
  cobro: "Cobro",
  voucher_pago: "Voucher de pago",
  recordatorio_vencimiento: "Recordatorio de vencimiento",
  liquidacion_propietario: "Liquidación propietario",
  salida_anticipada: "Salida anticipada",
  termino_contrato: "Término de contrato",
  nuevo_contrato: "Nuevo contrato",
  solicitud_firma: "Solicitud de firma",
  renovacion_contrato: "Renovación de contrato",
  comentario_corredor: "Comentario del corredor",
};

export type NotificacionItem = {
  id: string;
  tipo: string;
  tipoLabel: string;
  estado: string;
  asunto: string;
  createdAt: Date;
  persona: { nombre: string; rut: string | null };
  propiedad: { direccion: string } | null;
};

export async function getNotificaciones(tenantId: string, propiedadIds?: string[] | null): Promise<NotificacionItem[]> {
  const rows = await withTenant(tenantId, (tx) => tx.notificacion.findMany({
    where: {
      tenantId,
      // Notificacion no tiene FK directa a Propiedad y contratoId es opcional
      // (puede ser null) — para un Colaborador, una notificación sin contrato
      // no tiene dueño identificable, así que queda excluida (relation filter
      // sobre un campo nullable ya descarta null de forma implícita).
      ...(propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      persona: { select: { nombre: true, rut: true } },
      contrato: { select: { propiedad: { select: { direccion: true } } } },
    },
  }));
  return rows.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    tipoLabel: NOTIFICACION_TIPO_LABEL[n.tipo] ?? n.tipo,
    estado: n.estado,
    asunto: n.asunto,
    createdAt: n.createdAt,
    persona: n.persona,
    propiedad: n.contrato?.propiedad ?? null,
  }));
}

export async function getNotificacionCount(tenantId: string, propiedadIds?: string[] | null) {
  return withTenant(tenantId, (tx) => tx.notificacion.count({
    where: {
      tenantId, estado: "pendiente",
      ...(propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {}),
    },
  }));
}

type VoucherFiltros = {
  tipo?: "pago" | "liquidacion";
  desde?: string;
  hasta?: string;
  contratoId?: string;
};

export type VoucherItem = {
  id: string;
  fecha: Date;
  tipo: "pago" | "liquidacion";
  montoClp: number;
  contratoId: string;
  arrendatario: { nombre: string };
  propiedad: { direccion: string; comuna: string | null };
};

export async function getVouchers(
  tenantId: string,
  filtros: VoucherFiltros = {},
  propiedadIds?: string[] | null,
): Promise<VoucherItem[]> {
  const rows = await withTenant(tenantId, (tx) => tx.voucher.findMany({
    where: {
      tenantId,
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.contratoId ? { contratoId: filtros.contratoId } : {}),
      // Voucher no tiene FK directa a Propiedad — filtra vía Contrato.
      ...(propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {}),
      ...(filtros.desde || filtros.hasta
        ? {
            fecha: {
              ...(filtros.desde ? { gte: new Date(filtros.desde + "T00:00:00Z") } : {}),
              ...(filtros.hasta ? { lte: new Date(filtros.hasta + "T00:00:00Z") } : {}),
            },
          }
        : {}),
    },
    orderBy: { fecha: "desc" },
    include: {
      arrendatario: { select: { nombre: true } },
      contrato: { select: { propiedad: { select: { direccion: true, comuna: true } } } },
    },
  }));
  return rows.map((v) => ({
    id: v.id,
    fecha: v.fecha,
    tipo: v.tipo,
    montoClp: Number(v.montoClp),
    contratoId: v.contratoId,
    arrendatario: v.arrendatario,
    propiedad: v.contrato.propiedad,
  }));
}

export async function getContratosSelect(tenantId: string, propiedadIds?: string[] | null): Promise<{ id: string; label: string }[]> {
  const rows = await withTenant(tenantId, (tx) => tx.contrato.findMany({
    where: { tenantId, ...(propiedadIds ? { propiedadId: { in: propiedadIds } } : {}) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      arrendatario: { select: { nombre: true } },
      propiedad: { select: { direccion: true } },
    },
  }));
  return rows.map((c) => ({ id: c.id, label: `${c.propiedad.direccion} — ${c.arrendatario.nombre}` }));
}

export async function getPropiedades(tenantId: string, propiedadIds?: string[] | null) {
  const rows = await withTenant(tenantId, (tx) => tx.propiedad.findMany({
    where: { tenantId, ...(propiedadIds ? { id: { in: propiedadIds } } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      propietario: { select: { nombre: true, email: true, rut: true } },
      imagenes: { orderBy: { orden: "asc" } },
      asignadoA: { select: { id: true, nombre: true } },
      // El panel trae TODO, incluida la marca de visibilidad: el corredor ve
      // sus datos completos y además necesita saber cuáles está compartiendo.
      // El filtrado por visibilidad ocurre solo en el portal.
      cuentasServicio: { select: { tipo: true, estado: true, numero: true, empresa: true, titular: true, paga: true, etiqueta: true, visibleEnPortal: true } },
      rolesComplementarios: { select: { tipo: true, rol: true, descripcion: true, visibleEnPortal: true } },
      _count: { select: { contratos: true, publicaciones: true } },
    },
  }));
  return rows.map((p) => ({
    id: p.id,
    tipo: p.tipo,
    estado: p.estado,
    direccion: p.direccion,
    rol: p.rol,
    rolVisibleEnPortal: p.rolVisibleEnPortal,
    cuentasServicio: p.cuentasServicio,
    rolesComplementarios: p.rolesComplementarios,
    comuna: p.comuna,
    region: p.region,
    orientacion: p.orientacion,
    antiguedadAnios: p.antiguedadAnios,
    m2Construidos: p.m2Construidos ? Number(p.m2Construidos) : null,
    m2Totales: p.m2Totales ? Number(p.m2Totales) : null,
    esCondominio: p.esCondominio,
    plantas: p.plantas,
    piezas: p.piezas,
    banos: p.banos,
    estacionamientos: p.estacionamientos,
    pagaGastosComunes: p.pagaGastosComunes,
    valorGastosComunes: p.valorGastosComunes ? Number(p.valorGastosComunes) : null,
    aceptaMascotas: p.aceptaMascotas,
    otrasDescripciones: p.otrasDescripciones,
    latitud: p.latitud ? Number(p.latitud) : null,
    longitud: p.longitud ? Number(p.longitud) : null,
    mostrarUbicacionExacta: p.mostrarUbicacionExacta,
    asignadoAId: p.asignadoAId,
    asignadoA: p.asignadoA,
    propietario: p.propietario,
    imagenes: p.imagenes,
    _count: p._count,
  }));
}

/**
 * Colaboradores activos del tenant, para poblar el selector "Colaborador
 * asignado" del editor de propiedad (ADR-0013, Fase C). Sin gate de rol —
 * el llamador (Server Component) decide si renderiza el selector según
 * `actor.rol`; esta función solo trae datos ya acotados al tenant.
 */
export async function getColaboradoresActivos(tenantId: string) {
  return withTenant(tenantId, (tx) => tx.usuario.findMany({
    where:   { tenantId, rol: "colaborador", desactivadoEn: null },
    select:  { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  }));
}

// ─── Cupos del plan (Fase B0) ───────────────────────────────────────────────

/**
 * Consumo de cupo de propiedades del tenant, para mostrarlo en el panel.
 *
 * Es solo lectura: el límite lo hace valer `verificarCupoPropiedades()` dentro
 * de la transacción que crea la propiedad. Acá se reusa el mismo contador para
 * que lo que ve el corredor y lo que aplica el servidor no puedan divergir.
 */
export async function getCupoPropiedadesInfo(tenantId: string, plan: string | null) {
  const usado = await withTenant(tenantId, (tx) =>
    tx.propiedad.count({ where: { tenantId } }),
  );
  return { usado, max: getCupoPropiedades(plan), planLabel: getPlanEfectivo(plan).name };
}

/** Consumo de IA de hoy, para el indicador previo a mandar un contrato a la IA. */
export async function getCupoIaInfo(tenantId: string, plan: string | null) {
  return withTenant(tenantId, (tx) => consultarConsumoIaHoy(tx, tenantId, plan));
}

// ─── Estadísticas (analítica por tier de plan) ──────────────────────────────
//
// 4 pestañas, 4 funciones independientes — cada una solo se llama si el tab
// activo la necesita (ver /panel/estadisticas). Todas comparten dos reglas:
//
//  1. Dato REALIZADO (ya ocurrió) → se agrega siempre desde asiento_ledger
//     .montoClp, que ya viene normalizado y congelado a la UF del día del
//     evento. Nunca se reconvierte con la UF de hoy.
//  2. Dato PROYECTADO (período futuro, sin asiento todavía) → se convierte
//     "en vivo" con la UF más reciente de serie_uf, vía convertirUfAClp de
//     @housing/core. Se marca esAproximado en el tipo de retorno.
//
// Igual que en getResumen: todo secuencial dentro del mismo `tx` (una sola
// conexión física por transacción interactiva de Prisma) — evita el warning
// de pg por queries concurrentes sobre la misma conexión.

function mesKey(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ultimosNMeses(n: number, desde: Date): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() - i, 1));
    out.push(mesKey(d));
  }
  return out;
}

function proximosNMeses(n: number, desde: Date): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + i, 1));
    out.push(mesKey(d));
  }
  return out;
}

function mediana(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ── Pestaña 1: Resumen Operativo (Bronce+) ──────────────────────────────────

export type ResumenOperativo = {
  ocupacionPct: number;
  ocupacionDesglose: { estado: string; count: number }[];
  porCobrarEsteMesClp: number;
  tasaMorosidadPct: number;
  cobradoVsFacturado: { mes: string; cobrado: number; facturado: number }[];
  proximosVencimientos: {
    id: string;
    fechaVencimiento: Date;
    direccion: string;
    arrendatario: string;
    montoClp: number;
  }[];
  /**
   * Lucro cesante estimado del mes en curso por propiedades vacías —
   * renta de su último contrato conocido × días transcurridos del mes.
   * Simplificación declarada: asume vacante desde el día 1 del mes; no
   * pretende saber la fecha exacta en que quedó libre.
   */
  vacancyLossClp: number;
};

export async function getResumenOperativo(tenantId: string): Promise<ResumenOperativo> {
  return withTenant(tenantId, async (tx) => {
    const hoy = new Date();

    const propiedadesPorEstado = await tx.propiedad.groupBy({
      by: ["estado"],
      where: { tenantId },
      _count: { _all: true },
    });
    let totalProp = 0;
    let ocupadas = 0;
    const ocupacionDesglose = propiedadesPorEstado.map((g) => {
      totalProp += g._count._all;
      if (g.estado === "arrendada" || g.estado === "reservada") ocupadas += g._count._all;
      return { estado: g.estado, count: g._count._all };
    });
    const ocupacionPct = totalProp > 0 ? Math.round((ocupadas / totalProp) * 1000) / 10 : 0;

    const inicioMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const finMes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 1));
    const periodosMes = await tx.periodoPago.findMany({
      where: { tenantId, fechaVencimiento: { gte: inicioMes, lt: finMes }, estado: { in: ["pendiente", "atrasado"] } },
      select: { montoBase: true, contrato: { select: { denominacion: true } } },
    });
    const ufHoyMes = periodosMes.some((p) => p.contrato.denominacion === "UF") ? await getUfCLPTx(tx, hoy) : 0;
    const porCobrarEsteMesClp = periodosMes.reduce(
      (acc, p) => acc + (p.contrato.denominacion === "UF" ? convertirUfAClp(Number(p.montoBase), ufHoyMes) : Number(p.montoBase)),
      0,
    );

    const periodosVencidosPorEstado = await tx.periodoPago.groupBy({
      by: ["estado"],
      where: { tenantId, fechaVencimiento: { lte: hoy }, estado: { in: ["atrasado", "pagado", "liquidado", "en_revision"] } },
      _count: { _all: true },
    });
    let totalVencidos = 0;
    let atrasados = 0;
    for (const g of periodosVencidosPorEstado) {
      totalVencidos += g._count._all;
      if (g.estado === "atrasado") atrasados += g._count._all;
    }
    const tasaMorosidadPct = totalVencidos > 0 ? Math.round((atrasados / totalVencidos) * 1000) / 10 : 0;

    const inicio3m = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 2, 1));
    const meses3 = ultimosNMeses(3, hoy);
    const asientos3m = await tx.asientoLedger.findMany({
      where: { tenantId, tipo: { in: ["PAGO_RECIBIDO", "CARGO_ARRIENDO"] }, fechaEvento: { gte: inicio3m } },
      select: { tipo: true, montoClp: true, fechaEvento: true },
    });
    const cobradoMap = new Map<string, number>();
    const facturadoMap = new Map<string, number>();
    for (const a of asientos3m) {
      const k = mesKey(a.fechaEvento);
      const monto = Number(a.montoClp);
      const map = a.tipo === "PAGO_RECIBIDO" ? cobradoMap : facturadoMap;
      map.set(k, (map.get(k) ?? 0) + monto);
    }
    const cobradoVsFacturado = meses3.map((mes) => ({
      mes,
      cobrado: cobradoMap.get(mes) ?? 0,
      facturado: facturadoMap.get(mes) ?? 0,
    }));

    const proximosRaw = await tx.periodoPago.findMany({
      where: { tenantId, estado: { in: ["pendiente", "atrasado"] } },
      orderBy: { fechaVencimiento: "asc" },
      take: 5,
      select: {
        id: true,
        fechaVencimiento: true,
        montoBase: true,
        contrato: {
          select: {
            denominacion: true,
            arrendatario: { select: { nombre: true } },
            propiedad: { select: { direccion: true } },
          },
        },
      },
    });
    const ufHoyProx = proximosRaw.some((p) => p.contrato.denominacion === "UF") ? await getUfCLPTx(tx, hoy) : 0;
    const proximosVencimientos = proximosRaw.map((p) => ({
      id: p.id,
      fechaVencimiento: p.fechaVencimiento,
      direccion: p.contrato.propiedad.direccion,
      arrendatario: p.contrato.arrendatario.nombre,
      montoClp: p.contrato.denominacion === "UF" ? convertirUfAClp(Number(p.montoBase), ufHoyProx) : Number(p.montoBase),
    }));

    // Vacancy loss: propiedades hoy "disponible", valoradas con la renta de
    // su último contrato conocido (si nunca tuvo contrato, no se estima —
    // no hay base real de la que partir).
    const propsDisponibles = await tx.propiedad.findMany({
      where: { tenantId, estado: "disponible" },
      select: { id: true },
    });
    let vacancyLossClp = 0;
    if (propsDisponibles.length > 0) {
      const idsDisponibles = propsDisponibles.map((p) => p.id);
      const ultimosContratos = await tx.contrato.findMany({
        // estado terminado/terminado_anticipado únicamente — un contrato
        // "cancelado" (borrador que nunca llegó a firmarse) también tiene
        // fecha_termino, pero su renta nunca se cobró de verdad.
        where: { tenantId, propiedadId: { in: idsDisponibles }, estado: { in: ["terminado", "terminado_anticipado"] } },
        orderBy: { fechaTermino: "desc" },
        select: { propiedadId: true, valorArriendo: true, denominacion: true },
      });
      const rentaPorPropiedad = new Map<string, { valorArriendo: number; denominacion: "UF" | "CLP" }>();
      for (const c of ultimosContratos) {
        if (!rentaPorPropiedad.has(c.propiedadId)) {
          rentaPorPropiedad.set(c.propiedadId, { valorArriendo: Number(c.valorArriendo), denominacion: c.denominacion });
        }
      }
      const hayUfVacancy = [...rentaPorPropiedad.values()].some((r) => r.denominacion === "UF");
      const ufHoyVacancy = hayUfVacancy ? await getUfCLPTx(tx, hoy) : 0;
      const diasTranscurridosMes = hoy.getUTCDate();
      for (const r of rentaPorPropiedad.values()) {
        const rentaClp = r.denominacion === "UF" ? convertirUfAClp(r.valorArriendo, ufHoyVacancy) : r.valorArriendo;
        vacancyLossClp += Math.round((rentaClp * diasTranscurridosMes) / 30);
      }
    }

    return { ocupacionPct, ocupacionDesglose, porCobrarEsteMesClp, tasaMorosidadPct, cobradoVsFacturado, proximosVencimientos, vacancyLossClp };
  });
}

// ── Pestaña 2: Analítica Financiera (Silver+) ───────────────────────────────

export type AnaliticaFinanciera = {
  ingresosCobradosPorMes: { mes: string; monto: number }[];
  comisionGanadaPorMes: { mes: string; monto: number }[];
  ticketPromedioClp: number;
  carteraPorDenominacion: { denominacion: "UF" | "CLP"; contratos: number; montoClp: number }[];
  evolucionMorosidad: { mes: string; tasaPct: number }[];
  /** % de obligaciones vencidas (12m) cobradas dentro de los 5 días desde su vencimiento. */
  collectionRatePct: number;
  /** Aging de la morosidad ABIERTA hoy (no histórica), por antigüedad desde el vencimiento. */
  agingMorosidad: { bucket: "1-30" | "31-60" | "60+"; count: number; montoClp: number }[];
};

export async function getAnaliticaFinanciera(tenantId: string): Promise<AnaliticaFinanciera> {
  return withTenant(tenantId, async (tx) => {
    const hoy = new Date();
    const inicio12m = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 11, 1));
    const meses12 = ultimosNMeses(12, hoy);

    const asientos = await tx.asientoLedger.findMany({
      where: { tenantId, tipo: { in: ["PAGO_RECIBIDO", "COMISION_CORREDOR"] }, fechaEvento: { gte: inicio12m } },
      select: { tipo: true, montoClp: true, fechaEvento: true },
    });
    const ingresosMap = new Map<string, number>();
    const comisionMap = new Map<string, number>();
    for (const a of asientos) {
      const k = mesKey(a.fechaEvento);
      const monto = Number(a.montoClp);
      const map = a.tipo === "PAGO_RECIBIDO" ? ingresosMap : comisionMap;
      map.set(k, (map.get(k) ?? 0) + monto);
    }
    const ingresosCobradosPorMes = meses12.map((mes) => ({ mes, monto: ingresosMap.get(mes) ?? 0 }));
    const comisionGanadaPorMes = meses12.map((mes) => ({ mes, monto: comisionMap.get(mes) ?? 0 }));

    const contratosVigentes = await tx.contrato.findMany({
      where: { tenantId, estado: "vigente" },
      select: { valorArriendo: true, denominacion: true },
    });
    const ufHoyVig = contratosVigentes.some((c) => c.denominacion === "UF") ? await getUfCLPTx(tx, hoy) : 0;
    const montosNormalizados = contratosVigentes.map((c) =>
      c.denominacion === "UF" ? convertirUfAClp(Number(c.valorArriendo), ufHoyVig) : Number(c.valorArriendo),
    );
    const ticketPromedioClp = montosNormalizados.length > 0
      ? Math.round(montosNormalizados.reduce((a, b) => a + b, 0) / montosNormalizados.length)
      : 0;

    const carteraGroup = await tx.contrato.groupBy({
      by: ["denominacion"],
      where: { tenantId, estado: "vigente" },
      _count: { _all: true },
      _sum: { valorArriendo: true },
    });
    const carteraPorDenominacion = carteraGroup.map((g) => ({
      denominacion: g.denominacion,
      contratos: g._count._all,
      montoClp: g.denominacion === "UF"
        ? convertirUfAClp(Number(g._sum.valorArriendo ?? 0), ufHoyVig)
        : Number(g._sum.valorArriendo ?? 0),
    }));

    const periodosHist = await tx.periodoPago.findMany({
      where: { tenantId, fechaVencimiento: { gte: inicio12m, lte: hoy }, estado: { in: ["atrasado", "pagado", "liquidado", "en_revision"] } },
      select: { fechaVencimiento: true, estado: true, fechaPagoReal: true },
    });
    const totalPorMes = new Map<string, number>();
    const atrasadosPorMes = new Map<string, number>();
    let dentroDePlazo = 0;
    const COLLECTION_RATE_DIAS_GRACIA = 5;
    for (const p of periodosHist) {
      const k = mesKey(p.fechaVencimiento);
      totalPorMes.set(k, (totalPorMes.get(k) ?? 0) + 1);
      if (p.estado === "atrasado") atrasadosPorMes.set(k, (atrasadosPorMes.get(k) ?? 0) + 1);
      if (p.fechaPagoReal) {
        const diasParaPagar = Math.round((p.fechaPagoReal.getTime() - p.fechaVencimiento.getTime()) / 86_400_000);
        if (diasParaPagar <= COLLECTION_RATE_DIAS_GRACIA) dentroDePlazo += 1;
      }
    }
    const evolucionMorosidad = meses12.map((mes) => {
      const total = totalPorMes.get(mes) ?? 0;
      const atras = atrasadosPorMes.get(mes) ?? 0;
      return { mes, tasaPct: total > 0 ? Math.round((atras / total) * 1000) / 10 : 0 };
    });
    const collectionRatePct = periodosHist.length > 0
      ? Math.round((dentroDePlazo / periodosHist.length) * 1000) / 10
      : 0;

    // Aging de morosidad: solo periodos ATRASADOS hoy (deuda abierta), no el
    // historial de 12m usado arriba — bucketizado por días desde vencimiento.
    // arriendoCLP se congela a la UF del día de vencimiento, mismo criterio
    // que getPeriodosPendientes.
    const periodosAtrasadosHoy = await tx.periodoPago.findMany({
      where: { tenantId, estado: "atrasado" },
      select: { fechaVencimiento: true, montoBase: true, contrato: { select: { denominacion: true } } },
    });
    const ufCacheAging = new Map<string, number>();
    async function ufEnFechaAging(f: Date): Promise<number> {
      const k = f.toISOString().slice(0, 10);
      if (!ufCacheAging.has(k)) ufCacheAging.set(k, await getUfCLPTx(tx, f));
      return ufCacheAging.get(k)!;
    }
    const bucketsAging: Record<"1-30" | "31-60" | "60+", { count: number; montoClp: number }> = {
      "1-30": { count: 0, montoClp: 0 },
      "31-60": { count: 0, montoClp: 0 },
      "60+": { count: 0, montoClp: 0 },
    };
    for (const p of periodosAtrasadosHoy) {
      const dias = Math.round((hoy.getTime() - p.fechaVencimiento.getTime()) / 86_400_000);
      const montoClp = p.contrato.denominacion === "UF"
        ? convertirUfAClp(Number(p.montoBase), await ufEnFechaAging(p.fechaVencimiento))
        : Math.round(Number(p.montoBase));
      const bucket = dias <= 30 ? "1-30" : dias <= 60 ? "31-60" : "60+";
      bucketsAging[bucket].count += 1;
      bucketsAging[bucket].montoClp += montoClp;
    }
    const agingMorosidad = (["1-30", "31-60", "60+"] as const).map((bucket) => ({ bucket, ...bucketsAging[bucket] }));

    return { ingresosCobradosPorMes, comisionGanadaPorMes, ticketPromedioClp, carteraPorDenominacion, evolucionMorosidad, collectionRatePct, agingMorosidad };
  });
}

// ── Pestaña 3: Rendimiento de Propiedades (Gold+) ───────────────────────────

export type RendimientoPropiedades = {
  rankingRentabilidad: { propiedadId: string; direccion: string; ingresoClp: number }[];
  rankingMora: { propiedadId: string; direccion: string; periodosAtrasados: number }[];
  vacanciaPorTipo: { tipo: string; diasPromedio: number | null }[];
  valoracion: {
    promedio: number | null;
    total: number;
    tendencia: "subiendo" | "bajando" | "estable" | null;
    distribucion: { estrellas: number; count: number }[];
  };
  comparablesMercado: {
    propiedadId: string;
    direccion: string;
    rentaActualClp: number;
    medianaMercadoClp: number | null;
    muestraComparables: number;
    posicion: "bajo_mercado" | "en_mercado" | "sobre_mercado" | "sin_datos";
  }[];
  turnoverPct: number;
  retencionPct: number;
  arrendatariosSinAtrasos: { personaId: string; nombre: string; contratosCount: number }[];
  /** Renta vigente / m² totales, solo propiedades con m² cargado. */
  rentaPorM2: { propiedadId: string; direccion: string; clpPorM2: number }[];
  /** Vacío si el tenant no tiene colaboradores activos (ADR-0013, Fase C). */
  rendimientoColaboradores: {
    colaboradorId: string;
    nombre: string;
    propiedadesCount: number;
    ingresoClp: number;
    periodosAtrasados: number;
  }[];
};

export async function getRendimientoPropiedades(tenantId: string): Promise<RendimientoPropiedades> {
  return withTenant(tenantId, async (tx) => {
    const hoy = new Date();
    const inicio12m = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 11, 1));

    const ingresos = await tx.asientoLedger.findMany({
      where: { tenantId, tipo: "PAGO_RECIBIDO", fechaEvento: { gte: inicio12m } },
      select: { montoClp: true, contrato: { select: { propiedadId: true, propiedad: { select: { direccion: true } } } } },
    });
    const ingresoPorPropiedad = new Map<string, { direccion: string; monto: number }>();
    for (const a of ingresos) {
      const id = a.contrato.propiedadId;
      const prev = ingresoPorPropiedad.get(id);
      if (prev) prev.monto += Number(a.montoClp);
      else ingresoPorPropiedad.set(id, { direccion: a.contrato.propiedad.direccion, monto: Number(a.montoClp) });
    }
    const rankingRentabilidad = [...ingresoPorPropiedad.entries()]
      .map(([propiedadId, v]) => ({ propiedadId, direccion: v.direccion, ingresoClp: v.monto }))
      .sort((a, b) => b.ingresoClp - a.ingresoClp)
      .slice(0, 10);

    const periodosAtrasadosHist = await tx.periodoPago.findMany({
      where: { tenantId, estado: "atrasado" },
      select: { contrato: { select: { propiedadId: true, propiedad: { select: { direccion: true } } } } },
    });
    const moraPorPropiedad = new Map<string, { direccion: string; count: number }>();
    for (const p of periodosAtrasadosHist) {
      const id = p.contrato.propiedadId;
      const prev = moraPorPropiedad.get(id);
      if (prev) prev.count += 1;
      else moraPorPropiedad.set(id, { direccion: p.contrato.propiedad.direccion, count: 1 });
    }
    const rankingMora = [...moraPorPropiedad.entries()]
      .map(([propiedadId, v]) => ({ propiedadId, direccion: v.direccion, periodosAtrasados: v.count }))
      .sort((a, b) => b.periodosAtrasados - a.periodosAtrasados)
      .slice(0, 5);

    // Vacancia: brecha entre el término de un contrato y el inicio del
    // siguiente en la misma propiedad, agrupada por tipo de propiedad.
    // Excluye "cancelado" — un borrador nunca firmado no generó vacancia real.
    const contratosTerminados = await tx.contrato.findMany({
      where: { tenantId, estado: { in: ["terminado", "terminado_anticipado"] } },
      select: { propiedadId: true, fechaTermino: true },
    });
    const todosContratos = await tx.contrato.findMany({
      where: { tenantId },
      select: { propiedadId: true, fechaInicio: true },
    });
    const propiedadesTipo = await tx.propiedad.findMany({ where: { tenantId }, select: { id: true, tipo: true } });
    const tipoPorPropiedad = new Map(propiedadesTipo.map((p) => [p.id, p.tipo]));
    const iniciosPorPropiedad = new Map<string, Date[]>();
    for (const c of todosContratos) {
      const arr = iniciosPorPropiedad.get(c.propiedadId) ?? [];
      arr.push(c.fechaInicio);
      iniciosPorPropiedad.set(c.propiedadId, arr);
    }
    const gapsPorTipo = new Map<string, number[]>();
    for (const term of contratosTerminados) {
      if (!term.fechaTermino) continue;
      const siguientes = (iniciosPorPropiedad.get(term.propiedadId) ?? [])
        .filter((f) => f.getTime() > term.fechaTermino!.getTime())
        .sort((a, b) => a.getTime() - b.getTime());
      const proximoInicio = siguientes[0];
      if (proximoInicio) {
        const dias = Math.round((proximoInicio.getTime() - term.fechaTermino.getTime()) / 86_400_000);
        if (dias >= 0) {
          const tipo = tipoPorPropiedad.get(term.propiedadId) ?? "departamento";
          const arr = gapsPorTipo.get(tipo) ?? [];
          arr.push(dias);
          gapsPorTipo.set(tipo, arr);
        }
      }
    }
    const vacanciaPorTipo = (["casa", "departamento", "cabana"] as const).map((tipo) => {
      const gaps = gapsPorTipo.get(tipo) ?? [];
      return { tipo, diasPromedio: gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null };
    });

    const valoraciones = await tx.valoracionCorredor.findMany({
      where: { tenantId, esVisible: true },
      select: { estrellas: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    let promedio: number | null = null;
    let tendencia: "subiendo" | "bajando" | "estable" | null = null;
    if (valoraciones.length > 0) {
      promedio = Math.round((valoraciones.reduce((a, v) => a + v.estrellas, 0) / valoraciones.length) * 10) / 10;
      if (valoraciones.length >= 2) {
        const corte = Math.floor(valoraciones.length / 2);
        const avg = (arr: typeof valoraciones) => arr.reduce((a, v) => a + v.estrellas, 0) / arr.length;
        const diff = avg(valoraciones.slice(corte)) - avg(valoraciones.slice(0, corte));
        tendencia = diff > 0.15 ? "subiendo" : diff < -0.15 ? "bajando" : "estable";
      }
    }
    const distribucion = [1, 2, 3, 4, 5].map((estrellas) => ({
      estrellas,
      count: valoraciones.filter((v) => v.estrellas === estrellas).length,
    }));

    // Comparables de mercado: renta actual de cada contrato vigente vs. la
    // mediana de publicaciones activas del marketplace (todos los tenants,
    // mismo tipo+comuna) — dato real gracias a la política RLS
    // public_read_publicacion, no una estimación inventada.
    const contratosVigentesProp = await tx.contrato.findMany({
      where: { tenantId, estado: "vigente" },
      select: {
        propiedadId: true, valorArriendo: true, denominacion: true,
        propiedad: { select: { direccion: true, tipo: true, comuna: true, m2Totales: true } },
      },
    });
    const publicacionesActivas = await tx.publicacion.findMany({
      where: { estado: "publicada" },
      select: {
        precioReferencia: true, denominacionPrecio: true,
        propiedad: { select: { tipo: true, comuna: true } },
      },
    });
    const hayUfComparables = contratosVigentesProp.some((c) => c.denominacion === "UF")
      || publicacionesActivas.some((p) => p.denominacionPrecio === "UF");
    const ufHoyComparables = hayUfComparables ? await getUfCLPTx(tx, hoy) : 0;
    const preciosPorGrupo = new Map<string, number[]>();
    for (const pub of publicacionesActivas) {
      if (pub.precioReferencia === null || !pub.propiedad.comuna) continue;
      const precioClp = pub.denominacionPrecio === "UF"
        ? convertirUfAClp(Number(pub.precioReferencia), ufHoyComparables)
        : Number(pub.precioReferencia);
      const key = `${pub.propiedad.tipo}|${pub.propiedad.comuna}`;
      const arr = preciosPorGrupo.get(key) ?? [];
      arr.push(precioClp);
      preciosPorGrupo.set(key, arr);
    }
    const comparablesMercado = contratosVigentesProp.map((c) => {
      const rentaActualClp = c.denominacion === "UF"
        ? convertirUfAClp(Number(c.valorArriendo), ufHoyComparables)
        : Number(c.valorArriendo);
      const key = `${c.propiedad.tipo}|${c.propiedad.comuna ?? ""}`;
      const grupo = c.propiedad.comuna ? (preciosPorGrupo.get(key) ?? []) : [];
      const muestraComparables = grupo.length;
      let posicion: "bajo_mercado" | "en_mercado" | "sobre_mercado" | "sin_datos" = "sin_datos";
      let medianaMercadoClp: number | null = null;
      if (muestraComparables >= 3) {
        medianaMercadoClp = Math.round(mediana(grupo));
        if (rentaActualClp < medianaMercadoClp * 0.9) posicion = "bajo_mercado";
        else if (rentaActualClp > medianaMercadoClp * 1.1) posicion = "sobre_mercado";
        else posicion = "en_mercado";
      }
      return { propiedadId: c.propiedadId, direccion: c.propiedad.direccion, rentaActualClp, medianaMercadoClp, muestraComparables, posicion };
    });

    // Renta por m²: mismo rentaActualClp de comparablesMercado, dividido por
    // m2Totales — solo propiedades con m² cargado (campo opcional).
    const m2PorPropiedad = new Map(contratosVigentesProp.map((c) => [
      c.propiedadId, c.propiedad.m2Totales !== null ? Number(c.propiedad.m2Totales) : null,
    ]));
    const rentaPorM2 = comparablesMercado
      .map((c) => ({ propiedadId: c.propiedadId, direccion: c.direccion, m2: m2PorPropiedad.get(c.propiedadId) ?? null, rentaActualClp: c.rentaActualClp }))
      .filter((c): c is typeof c & { m2: number } => c.m2 !== null && c.m2 > 0)
      .map((c) => ({ propiedadId: c.propiedadId, direccion: c.direccion, clpPorM2: Math.round(c.rentaActualClp / c.m2) }))
      .sort((a, b) => b.clpPorM2 - a.clpPorM2)
      .slice(0, 10);

    // Rendimiento por colaborador (ADR-0013, Fase C): reusa ingresoPorPropiedad
    // y moraPorPropiedad ya calculados arriba, agregados vía Propiedad.asignadoAId.
    const colaboradoresActivos = await tx.usuario.findMany({
      where: { tenantId, rol: "colaborador", desactivadoEn: null },
      select: { id: true, nombre: true },
    });
    let rendimientoColaboradores: RendimientoPropiedades["rendimientoColaboradores"] = [];
    if (colaboradoresActivos.length > 0) {
      const propiedadesAsignadas = await tx.propiedad.findMany({
        where: { tenantId, asignadoAId: { not: null } },
        select: { id: true, asignadoAId: true },
      });
      const colaboradorPorPropiedad = new Map(propiedadesAsignadas.map((p) => [p.id, p.asignadoAId as string]));
      const propiedadesCountPorColaborador = new Map<string, number>();
      for (const p of propiedadesAsignadas) {
        propiedadesCountPorColaborador.set(p.asignadoAId!, (propiedadesCountPorColaborador.get(p.asignadoAId!) ?? 0) + 1);
      }
      const ingresoPorColaborador = new Map<string, number>();
      for (const [propiedadId, v] of ingresoPorPropiedad) {
        const colabId = colaboradorPorPropiedad.get(propiedadId);
        if (colabId) ingresoPorColaborador.set(colabId, (ingresoPorColaborador.get(colabId) ?? 0) + v.monto);
      }
      const moraPorColaborador = new Map<string, number>();
      for (const [propiedadId, v] of moraPorPropiedad) {
        const colabId = colaboradorPorPropiedad.get(propiedadId);
        if (colabId) moraPorColaborador.set(colabId, (moraPorColaborador.get(colabId) ?? 0) + v.count);
      }
      rendimientoColaboradores = colaboradoresActivos
        .map((c) => ({
          colaboradorId: c.id,
          nombre: c.nombre,
          propiedadesCount: propiedadesCountPorColaborador.get(c.id) ?? 0,
          ingresoClp: ingresoPorColaborador.get(c.id) ?? 0,
          periodosAtrasados: moraPorColaborador.get(c.id) ?? 0,
        }))
        .sort((a, b) => b.ingresoClp - a.ingresoClp);
    }

    // Turnover: contratos que terminaron en los últimos 12 meses / propiedades totales.
    // Excluye "cancelado" — mismo motivo que en vacancia.
    const contratosTerminados12m = await tx.contrato.count({
      where: { tenantId, estado: { in: ["terminado", "terminado_anticipado"] }, fechaTermino: { gte: inicio12m, lte: hoy } },
    });
    const totalPropiedades = await tx.propiedad.count({ where: { tenantId } });
    const turnoverPct = totalPropiedades > 0 ? Math.round((contratosTerminados12m / totalPropiedades) * 1000) / 10 : 0;

    // Retención: de los contratos que llegaron a un punto de decisión (ya
    // terminaron naturalmente, o siguen vigentes tras haber sido
    // renovados), ¿cuántos se renovaron al menos una vez? Se excluye
    // terminado_anticipado — el arrendatario se fue antes de tiempo, no es
    // una decisión de "no renovar".
    const contratosBaseRetencion = await tx.contrato.findMany({
      where: { tenantId, estado: { in: ["terminado", "vigente"] } },
      select: { id: true },
    });
    let retencionPct = 0;
    if (contratosBaseRetencion.length > 0) {
      const idsBase = contratosBaseRetencion.map((c) => c.id);
      const notifRenovacion = await tx.notificacion.findMany({
        where: { tenantId, contratoId: { in: idsBase }, tipo: "renovacion_contrato" },
        select: { contratoId: true },
        distinct: ["contratoId"],
      });
      retencionPct = Math.round((notifRenovacion.length / contratosBaseRetencion.length) * 1000) / 10;
    }

    // Fidelización: arrendatarios con contratos en esta cartera y cero
    // períodos atrasados históricos, ordenados por cantidad de contratos.
    const arrendatariosConContrato = await tx.contrato.findMany({
      where: { tenantId },
      select: { arrendatarioId: true, arrendatario: { select: { nombre: true } } },
    });
    const contratosPorArrendatario = new Map<string, { nombre: string; count: number }>();
    for (const c of arrendatariosConContrato) {
      const prev = contratosPorArrendatario.get(c.arrendatarioId);
      if (prev) prev.count += 1;
      else contratosPorArrendatario.set(c.arrendatarioId, { nombre: c.arrendatario.nombre, count: 1 });
    }
    const periodosConAtraso = await tx.periodoPago.findMany({
      where: { tenantId, estado: "atrasado" },
      select: { contrato: { select: { arrendatarioId: true } } },
    });
    const idsConAtraso = new Set(periodosConAtraso.map((p) => p.contrato.arrendatarioId));
    const arrendatariosSinAtrasos = [...contratosPorArrendatario.entries()]
      .filter(([personaId]) => !idsConAtraso.has(personaId))
      .map(([personaId, v]) => ({ personaId, nombre: v.nombre, contratosCount: v.count }))
      .sort((a, b) => b.contratosCount - a.contratosCount)
      .slice(0, 5);

    return {
      rankingRentabilidad,
      rankingMora,
      vacanciaPorTipo,
      valoracion: { promedio, total: valoraciones.length, tendencia, distribucion },
      comparablesMercado,
      turnoverPct,
      retencionPct,
      arrendatariosSinAtrasos,
      rentaPorM2,
      rendimientoColaboradores,
    };
  });
}

// ── Pestaña 4: Proyecciones y Riesgo (Gold/Diamond) ─────────────────────────

export type ProyeccionesRiesgo = {
  proyeccionIngresos: { mes: string; realizadoClp: number; proyectadoClp: number; esAproximado: boolean }[];
  riesgoMora: { tasaActualPct: number; tasaProyectadaPct: number; tendencia: "subiendo" | "bajando" | "estable" };
  alertasRenovacion: {
    contratoId: string;
    propiedadId: string;
    direccion: string;
    arrendatario: string;
    fechaFin: Date;
    diasRestantes: number;
    /** Heurística por reglas (proximidad de vencimiento + historial de mora), no un modelo de churn real. */
    riesgoChurn: "bajo" | "medio" | "alto";
  }[];
  /** Simulación simple: ingreso de los próximos 6 meses si un % adicional de arrendatarios cae en mora. */
  stressTest: { escenarioPctMora: number; ingresoResultanteClp: number }[];
  /**
   * Score de riesgo por arrendatario basado en su propio historial de
   * atrasos (regla determinística, no un modelo de credit scoring real).
   */
  riesgoPorArrendatario: {
    personaId: string;
    nombre: string;
    periodosVencidos: number;
    periodosAtrasados: number;
    tasaAtrasoPct: number;
    nivel: "bajo" | "medio" | "alto";
  }[];
  /** Concentración de ingreso (12m) por propietario — top 5, para detectar dependencia excesiva de una sola cartera. */
  concentracionPropietarios: { propietarioId: string; nombre: string; ingresoClp: number; pctDelTotal: number }[];
};

export async function getProyeccionesRiesgo(tenantId: string): Promise<ProyeccionesRiesgo> {
  return withTenant(tenantId, async (tx) => {
    const hoy = new Date();
    const inicioMesActual = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    const finMesActual = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 1));
    const limite6m = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 6, 1));
    const meses6 = proximosNMeses(6, hoy);

    const realizadoMesActual = await tx.asientoLedger.findMany({
      where: { tenantId, tipo: "PAGO_RECIBIDO", fechaEvento: { gte: inicioMesActual, lt: finMesActual } },
      select: { montoClp: true },
    });
    const realizadoMesActualClp = realizadoMesActual.reduce((a, r) => a + Number(r.montoClp), 0);

    const periodosFuturos = await tx.periodoPago.findMany({
      // contrato.estado: "vigente" — un período atrasado que quedó huérfano
      // en un contrato ya terminado es una cuenta por cobrar puntual (se ve
      // en Cobros), no ingreso proyectado de un arriendo en curso.
      where: {
        tenantId, estado: { in: ["pendiente", "atrasado"] }, fechaVencimiento: { gte: inicioMesActual, lt: limite6m },
        contrato: { estado: "vigente" },
      },
      select: {
        numero: true, fechaVencimiento: true, montoBase: true,
        contrato: { select: { denominacion: true, reajuste: true } },
      },
    });
    const ufHoy = periodosFuturos.some((p) => p.contrato.denominacion === "UF") ? await getUfCLPTx(tx, hoy) : 0;

    // Estimación de reajuste IPC: para contratos en CLP cuyo período de
    // aniversario cae dentro de la ventana de proyección, se aplica la
    // última variación de 12 meses conocida en serie_ipc — nunca el IPC
    // "futuro" real, porque ese dato todavía no existe. Si no hay 13 meses
    // de historial de IPC cargados, se omite el ajuste en vez de inventarlo.
    const ipcRows = await tx.serieIpc.findMany({ orderBy: { periodo: "desc" }, take: 13 });
    const factorIpc12m = ipcRows.length >= 13 ? Number(ipcRows[0].indice) / Number(ipcRows[12].indice) : null;

    const proyectadoPorMes = new Map<string, number>();
    for (const p of periodosFuturos) {
      let monto = p.contrato.denominacion === "UF" ? convertirUfAClp(Number(p.montoBase), ufHoy) : Number(p.montoBase);
      if (p.contrato.denominacion === "CLP" && p.contrato.reajuste !== "ninguna" && factorIpc12m !== null) {
        const ciclo = p.contrato.reajuste === "semestral" ? 6 : 12;
        if (esPeriodoDeReajuste(p.numero, ciclo)) monto = Math.round(monto * factorIpc12m);
      }
      const k = mesKey(p.fechaVencimiento);
      proyectadoPorMes.set(k, (proyectadoPorMes.get(k) ?? 0) + monto);
    }

    const mesActualKey = mesKey(hoy);
    const proyeccionIngresos = meses6.map((mes) => {
      const esMesActual = mes === mesActualKey;
      const proyectadoClp = proyectadoPorMes.get(mes) ?? 0;
      return {
        mes,
        realizadoClp: esMesActual ? realizadoMesActualClp : 0,
        proyectadoClp,
        esAproximado: !esMesActual || proyectadoClp > 0,
      };
    });

    // Riesgo de mora proyectado — tendencia lineal simple: compara la tasa de
    // morosidad de los últimos 3 meses vencidos contra los 3 anteriores, y
    // proyecta el mismo delta hacia adelante. Es una estimación declarada
    // como tal, no un modelo predictivo — coherente con "Regla de oro" de
    // no representar con falsa precisión un número incierto.
    const inicio6mPasados = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 5, 1));
    const periodosPasados = await tx.periodoPago.findMany({
      where: { tenantId, fechaVencimiento: { gte: inicio6mPasados, lte: hoy }, estado: { in: ["atrasado", "pagado", "liquidado", "en_revision"] } },
      select: { fechaVencimiento: true, estado: true },
    });
    const meses6Pasados = ultimosNMeses(6, hoy);
    const totalPM = new Map<string, number>();
    const atrasPM = new Map<string, number>();
    for (const p of periodosPasados) {
      const k = mesKey(p.fechaVencimiento);
      totalPM.set(k, (totalPM.get(k) ?? 0) + 1);
      if (p.estado === "atrasado") atrasPM.set(k, (atrasPM.get(k) ?? 0) + 1);
    }
    const tasasPorMes = meses6Pasados
      .map((mes) => {
        const total = totalPM.get(mes) ?? 0;
        return total > 0 ? ((atrasPM.get(mes) ?? 0) / total) * 100 : null;
      })
      .filter((t): t is number => t !== null);

    let tasaActualPct = 0;
    let tasaProyectadaPct = 0;
    let tendenciaMora: "subiendo" | "bajando" | "estable" = "estable";
    if (tasasPorMes.length > 0) {
      tasaActualPct = Math.round(tasasPorMes[tasasPorMes.length - 1] * 10) / 10;
      if (tasasPorMes.length >= 2) {
        const mitad = Math.floor(tasasPorMes.length / 2);
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const avgAnterior = avg(tasasPorMes.slice(0, mitad));
        const avgReciente = avg(tasasPorMes.slice(mitad));
        const delta = avgReciente - avgAnterior;
        tasaProyectadaPct = Math.max(0, Math.min(100, Math.round((avgReciente + delta) * 10) / 10));
        tendenciaMora = delta > 1 ? "subiendo" : delta < -1 ? "bajando" : "estable";
      } else {
        tasaProyectadaPct = tasaActualPct;
      }
    }

    // Alertas de renovación: contrato vigente con fecha_fin ≤ 90 días y sin
    // un contrato sucesor ya creado en la misma propiedad.
    const limite90 = new Date(hoy.getTime() + 90 * 86_400_000);
    const contratosPorVencer = await tx.contrato.findMany({
      where: { tenantId, estado: "vigente", fechaFin: { not: null, lte: limite90, gte: hoy } },
      select: {
        id: true,
        propiedadId: true,
        arrendatarioId: true,
        fechaFin: true,
        propiedad: { select: { direccion: true } },
        arrendatario: { select: { nombre: true } },
      },
    });
    const todosInicios = await tx.contrato.findMany({ where: { tenantId }, select: { propiedadId: true, fechaInicio: true } });
    const iniciosMap = new Map<string, Date[]>();
    for (const c of todosInicios) {
      const arr = iniciosMap.get(c.propiedadId) ?? [];
      arr.push(c.fechaInicio);
      iniciosMap.set(c.propiedadId, arr);
    }
    // Riesgo por arrendatario — regla determinística sobre historial propio
    // de atrasos, NO un modelo de credit scoring real. Se usa también para
    // etiquetar el riesgo de churn en las alertas de renovación de abajo.
    const periodosVencidosPorPersona = await tx.periodoPago.findMany({
      where: { tenantId, fechaVencimiento: { lte: hoy }, estado: { in: ["atrasado", "pagado", "liquidado", "en_revision"] } },
      select: { estado: true, contrato: { select: { arrendatarioId: true, arrendatario: { select: { nombre: true } } } } },
    });
    const statsPorPersona = new Map<string, { nombre: string; vencidos: number; atrasados: number }>();
    for (const p of periodosVencidosPorPersona) {
      const id = p.contrato.arrendatarioId;
      const prev = statsPorPersona.get(id) ?? { nombre: p.contrato.arrendatario.nombre, vencidos: 0, atrasados: 0 };
      prev.vencidos += 1;
      if (p.estado === "atrasado") prev.atrasados += 1;
      statsPorPersona.set(id, prev);
    }
    function nivelRiesgo(tasaPct: number): "bajo" | "medio" | "alto" {
      return tasaPct >= 30 ? "alto" : tasaPct >= 10 ? "medio" : "bajo";
    }
    const riesgoPorArrendatario = [...statsPorPersona.entries()]
      .map(([personaId, v]) => {
        const tasaAtrasoPct = Math.round((v.atrasados / v.vencidos) * 1000) / 10;
        return {
          personaId, nombre: v.nombre, periodosVencidos: v.vencidos, periodosAtrasados: v.atrasados,
          tasaAtrasoPct, nivel: nivelRiesgo(tasaAtrasoPct),
        };
      })
      .filter((r) => r.periodosVencidos >= 2)
      .sort((a, b) => b.tasaAtrasoPct - a.tasaAtrasoPct)
      .slice(0, 5);

    const alertasRenovacion = contratosPorVencer
      .filter((c) => {
        if (!c.fechaFin) return false;
        const tieneSucesor = (iniciosMap.get(c.propiedadId) ?? []).some((f) => f.getTime() > c.fechaFin!.getTime());
        return !tieneSucesor;
      })
      .map((c) => {
        const diasRestantes = Math.round((c.fechaFin!.getTime() - hoy.getTime()) / 86_400_000);
        const personaStats = statsPorPersona.get(c.arrendatarioId);
        const tieneAtrasos = (personaStats?.atrasados ?? 0) > 0;
        const proximo = diasRestantes <= 30;
        const riesgoChurn: "bajo" | "medio" | "alto" =
          tieneAtrasos && proximo ? "alto" : (tieneAtrasos || proximo) ? "medio" : "bajo";
        return {
          contratoId: c.id,
          propiedadId: c.propiedadId,
          direccion: c.propiedad.direccion,
          arrendatario: c.arrendatario.nombre,
          fechaFin: c.fechaFin!,
          diasRestantes,
          riesgoChurn,
        };
      })
      .sort((a, b) => a.diasRestantes - b.diasRestantes);

    // Stress-test simple: ingreso de los próximos 6 meses (realizado del mes
    // en curso + proyectado) si un % adicional de arrendatarios cae en mora.
    const ingresoBase6mClp = proyeccionIngresos.reduce((a, m) => a + m.realizadoClp + m.proyectadoClp, 0);
    const stressTest = [10, 25, 40].map((escenarioPctMora) => ({
      escenarioPctMora,
      ingresoResultanteClp: Math.round(ingresoBase6mClp * (1 - escenarioPctMora / 100)),
    }));

    // Concentración de riesgo por propietario: ingreso realizado (12m) desde
    // asiento_ledger.propietarioId — campo directo del asiento, no requiere
    // join contra Contrato. Top 5 por % del ingreso total de la cartera.
    const inicio12mConcentracion = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 11, 1));
    const ingresosPorPropietarioRows = await tx.asientoLedger.findMany({
      where: { tenantId, tipo: "PAGO_RECIBIDO", fechaEvento: { gte: inicio12mConcentracion } },
      select: { montoClp: true, propietarioId: true, propietario: { select: { nombre: true } } },
    });
    const montoPorPropietario = new Map<string, { nombre: string; monto: number }>();
    let totalIngreso12mPropietarios = 0;
    for (const a of ingresosPorPropietarioRows) {
      const monto = Number(a.montoClp);
      totalIngreso12mPropietarios += monto;
      const prev = montoPorPropietario.get(a.propietarioId);
      if (prev) prev.monto += monto;
      else montoPorPropietario.set(a.propietarioId, { nombre: a.propietario.nombre, monto });
    }
    const concentracionPropietarios = [...montoPorPropietario.entries()]
      .map(([propietarioId, v]) => ({
        propietarioId, nombre: v.nombre, ingresoClp: v.monto,
        pctDelTotal: totalIngreso12mPropietarios > 0 ? Math.round((v.monto / totalIngreso12mPropietarios) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.pctDelTotal - a.pctDelTotal)
      .slice(0, 5);

    return {
      proyeccionIngresos,
      riesgoMora: { tasaActualPct, tasaProyectadaPct, tendencia: tendenciaMora },
      alertasRenovacion,
      stressTest,
      riesgoPorArrendatario,
      concentracionPropietarios,
    };
  });
}
