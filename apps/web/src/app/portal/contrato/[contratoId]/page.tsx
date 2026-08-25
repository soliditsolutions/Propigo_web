/**
 * Portal de autoconsulta — vista del contrato (ADR-0007).
 * Solo lectura · Acceso por JWT portal (hw_portal cookie) · 30 min.
 * Arrendatario: ve contrato, períodos, documentos, mensajes del corredor. NO ve comisión.
 * Propietario:  ve contrato, liquidaciones recibidas, estado de la propiedad.
 */
import { redirect, notFound } from "next/navigation";
import { withTenant } from "@/lib/tenant-db";
import { getPortalSession } from "@/lib/portal-auth";
import { PreferenciasAvisos } from "./preferencias-avisos";
import { puedeRecibir, describirPreferencia } from "@/lib/notificacion-preferencias";
import { marcarPeriodosAtrasados } from "@/lib/queries";
import {
  Building2, Calendar, CreditCard, Download, FileText,
  Home, LogOut, ShieldCheck, Star, User,
} from "lucide-react";
import { ValoracionButton } from "@/components/portal/ValoracionButton";
import { UbicacionSection } from "@/components/portal/UbicacionSection";
import { PagosSection } from "@/components/portal/PagosSection";
import { ComentariosSection } from "@/components/portal/ComentariosSection";

async function registrarAccesoVista(tenantId: string, personaId: string, ip: string | null) {
  await withTenant(tenantId, (tx) => tx.accesoLog.create({
    data: { tenantId, personaId, accion: "portal_vista_contrato", ip },
  })).catch(() => {});
}

function clp(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });
}

function fecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-CL", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" });
}

function diasHasta(d: Date | string | null): number | null {
  if (!d) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const dif = Math.floor((new Date(d).getTime() - hoy.getTime()) / 86_400_000);
  return dif;
}

const TIPO_DOC_LABEL: Record<string, string> = {
  contrato:             "Contrato",
  anexo:                "Anexo",
  comprobante_pago:     "Comprobante",
  certificado_reserva:  "Reserva",
  reconocimiento_deuda: "Reconocimiento",
  otro:                 "Documento",
};

export default async function PortalContratoPage({
  params,
}: {
  params: Promise<{ contratoId: string }>;
}) {
  const { contratoId } = await params;
  const session = await getPortalSession();
  if (!session) redirect("/portal");

  const { personaId, tenantId, rol } = session;

  // AUD-09: promover a "atrasado" antes de leer, para que el arrendatario vea
  // el estado real (no "Pendiente" indefinidamente).
  await marcarPeriodosAtrasados(tenantId);

  const whereContrato = rol === "arrendatario"
    ? { id: contratoId, tenantId, arrendatarioId: personaId }
    : { id: contratoId, tenantId, propietarioId: personaId };

  const contrato = await withTenant(tenantId, (tx) => tx.contrato.findFirst({
    where: whereContrato,
    include: {
      propiedad: {
        // latitud/longitud alimentan el mapa del portal (UbicacionSection).
        // `mostrarUbicacionExacta` NO se consulta a propósito: ese flag
        // protege una propiedad publicada frente a desconocidos del
        // marketplace, y aquí quien mira es quien vive en ella.
        select: { direccion: true, tipo: true, comuna: true, region: true, estado: true, m2Construidos: true, piezas: true, banos: true, latitud: true, longitud: true },
      },
      arrendatario: { select: { nombre: true, rut: true, email: true, telefono: true } },
      propietario:  { select: { nombre: true, rut: true, email: true } },
      periodos: {
        where: rol === "arrendatario"
          ? { estado: { in: ["pendiente", "atrasado", "pagado", "liquidado", "en_revision"] } }
          : { estado: { in: ["liquidado", "pagado"] } },
        orderBy: { numero: "desc" },
        select: { id: true, numero: true, fechaVencimiento: true, fechaPagoReal: true, estado: true, montoBase: true },
      },
      documentos: {
        where: { tipo: { in: ["contrato", "certificado_reserva", "comprobante_pago", "reconocimiento_deuda", "anexo", "otro"] } },
        orderBy: { createdAt: "desc" },
        select:  { id: true, tipo: true, nombre: true, createdAt: true },
      },
      comentarios: {
        orderBy:  { createdAt: "desc" },
        select: {
          id: true, texto: true, usuarioNombre: true, createdAt: true,
          documentos: { select: { id: true, nombre: true, tipo: true } },
        },
      },
      vouchers: rol === "propietario"
        ? { where: { tipo: "liquidacion" }, orderBy: { fecha: "desc" }, take: 12, select: { id: true, tipo: true, montoClp: true, fecha: true } }
        : false,
    },
  }));

  if (!contrato) notFound();

  registrarAccesoVista(tenantId, personaId, null);

  // Preferencia de avisos. La ausencia de fila significa suscrito, así que
  // quien nunca tocó nada ve el control en "activado" sin datos previos.
  const prefRow = await withTenant(tenantId, (tx) => tx.preferenciaNotificacion.findUnique({
    where:  { tenantId_personaId: { tenantId, personaId } },
    select: { suscrito: true, bajaHasta: true, alcance: true },
  }));

  const p              = contrato.propiedad;
  const esArrendatario = rol === "arrendatario";
  const persona        = esArrendatario ? contrato.arrendatario : contrato.propietario;

  // Datos de contrato
  const renta = contrato.denominacion === "UF"
    ? `UF ${Number(contrato.valorArriendo).toLocaleString("es-CL", { minimumFractionDigits: 2 })}`
    : clp(Number(contrato.valorArriendo));

  // Próximo pago (para arrendatarios)
  const proximoPendiente = esArrendatario
    ? [...contrato.periodos]
        .sort((a, b) => new Date(a.fechaVencimiento).getTime() - new Date(b.fechaVencimiento).getTime())
        .find(p => p.estado === "pendiente" || p.estado === "atrasado")
    : null;
  const diasProximo = proximoPendiente ? diasHasta(proximoPendiente.fechaVencimiento) : null;

  // Periodos para el componente cliente
  const periodosCliente = contrato.periodos.map(p => ({
    ...p,
    fechaVencimiento: p.fechaVencimiento.toISOString(),
    fechaPagoReal:    p.fechaPagoReal?.toISOString() ?? null,
    montoBase:        p.montoBase.toString(),
  }));

  // Comentarios para el componente cliente
  const comentariosCliente = contrato.comentarios.map(c => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    documentos: c.documentos,
  }));

  // Estadísticas de periodos
  const totalPeriodos   = contrato.periodos.length;
  const pagadosCount    = contrato.periodos.filter(p => p.estado === "pagado" || p.estado === "liquidado").length;
  const atrasadosCount  = contrato.periodos.filter(p => p.estado === "atrasado").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--hw-page)" }}>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 sm:px-6"
        style={{ background: "var(--hw-surface)", borderBottom: "1px solid var(--hw-border)", boxShadow: "0 1px 4px rgba(15,31,53,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--hw-primary)" }}
            aria-hidden
          >H</div>
          <div>
            <span className="text-sm font-bold" style={{ color: "var(--hw-text-1)" }}>Housing</span>
            <span className="ml-1 text-[9px] font-semibold uppercase tracking-widest" style={{ color: "var(--hw-text-4)" }}>SOLIDIT</span>
            <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Portal de autoconsulta</p>
          </div>
        </div>
        <a
          href="/api/portal/logout"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--hw-danger-lt)]"
          style={{ color: "var(--hw-danger)" }}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Cerrar sesión
        </a>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">

        {/* ── Hero — propiedad ── */}
        <div
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{ background: "var(--hw-sidebar)", color: "var(--hw-sidebar-text)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(255,255,255,0.12)" }}
            >
              {p.tipo === "departamento"
                ? <Building2 className="h-5 w-5" style={{ color: "var(--hw-primary-bd)" }} aria-hidden />
                : <Home      className="h-5 w-5" style={{ color: "var(--hw-primary-bd)" }} aria-hidden />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-base leading-tight" style={{ color: "var(--hw-sidebar-text)" }}>
                {p.direccion}
              </p>
              {(p.comuna || p.region) && (
                <p className="text-sm mt-0.5" style={{ color: "var(--hw-sidebar-muted)" }}>
                  {[p.comuna, p.region].filter(Boolean).join(", ")}
                </p>
              )}
              <div className="mt-2.5 flex flex-wrap gap-2">
                <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" }}>
                  {p.tipo}
                </span>
                <span className="rounded-full px-2 py-0.5 text-xs font-medium capitalize" style={{ background: "var(--hw-success-lt)", color: "var(--hw-success)" }}>
                  {contrato.estado.replace(/_/g, " ")}
                </span>
                {p.m2Construidos && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" }}>
                    {Number(p.m2Construidos).toFixed(0)} m²
                  </span>
                )}
                {p.piezas && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" }}>
                    {p.piezas} dorm.
                  </span>
                )}
                {p.banos && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)" }}>
                    {p.banos} baño{p.banos !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Alerta próximo pago ── */}
        {proximoPendiente && diasProximo !== null && diasProximo <= 10 && (
          <div
            className="rounded-2xl px-5 py-4 flex items-start gap-3"
            style={{
              background: diasProximo < 0 ? "rgba(239,68,68,0.06)" : "rgba(245,158,11,0.06)",
              border:     `1px solid ${diasProximo < 0 ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
            }}
          >
            <Calendar className="h-5 w-5 shrink-0 mt-0.5" style={{ color: diasProximo < 0 ? "var(--hw-danger)" : "var(--hw-warning)" }} aria-hidden />
            <div>
              <p className="text-sm font-semibold" style={{ color: diasProximo < 0 ? "var(--hw-danger-dk)" : "var(--hw-warning-dk)" }}>
                {diasProximo < 0
                  ? `Pago #${proximoPendiente.numero} vencido hace ${Math.abs(diasProximo)} día${Math.abs(diasProximo) !== 1 ? "s" : ""}`
                  : diasProximo === 0
                    ? `Pago #${proximoPendiente.numero} vence hoy`
                    : `Pago #${proximoPendiente.numero} vence en ${diasProximo} día${diasProximo !== 1 ? "s" : ""}`}
              </p>
              <p className="text-xs mt-0.5" style={{ color: diasProximo < 0 ? "var(--hw-danger-dk)" : "var(--hw-warning-dk)" }}>
                {renta} · {fecha(proximoPendiente.fechaVencimiento)}
              </p>
            </div>
          </div>
        )}

        {/* ── Ubicación de la propiedad ──
            Va después de la alerta de pago a propósito: el mapa es contexto
            útil, pero un vencimiento próximo es información urgente y no
            debe quedar empujada hacia abajo por él. */}
        <UbicacionSection
          latitud={p.latitud  === null ? null : Number(p.latitud)}
          longitud={p.longitud === null ? null : Number(p.longitud)}
          direccion={[p.direccion, p.comuna, p.region].filter(Boolean).join(", ")}
        />

        {/* ── Resumen del contrato ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
            <FileText className="h-4 w-4" aria-hidden />
            Mi contrato
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <div>
              <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>{esArrendatario ? "Arrendatario" : "Propietario"}</p>
              <p className="mt-0.5 font-semibold text-sm" style={{ color: "var(--hw-text-1)" }}>{persona.nombre}</p>
              <p className="text-xs" style={{ color: "var(--hw-text-3)" }}>{persona.rut}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Renta mensual</p>
              <p className="mt-0.5 font-bold hw-num" style={{ color: "var(--hw-text-1)", fontSize: "17px" }}>{renta}</p>
              {contrato.denominacion === "UF" && (
                <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>+ conv. al día de pago</p>
              )}
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Inicio contrato</p>
              <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--hw-text-2)" }}>{fecha(contrato.fechaInicio)}</p>
            </div>
            {contrato.fechaFin && (
              <div>
                <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Vencimiento</p>
                <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--hw-text-2)" }}>{fecha(contrato.fechaFin)}</p>
              </div>
            )}
            <div>
              <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Pago mensual</p>
              <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--hw-text-2)" }}>Día {contrato.diaVencimiento}</p>
            </div>
            {contrato.reajuste !== "ninguna" && (
              <div>
                <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Reajuste</p>
                <p className="mt-0.5 text-sm font-medium capitalize" style={{ color: "var(--hw-text-2)" }}>{contrato.reajuste}</p>
              </div>
            )}
          </div>

          {/* Estadísticas rápidas de pagos */}
          {esArrendatario && totalPeriodos > 0 && (
            <div
              className="mt-4 pt-4 grid grid-cols-3 gap-3"
              style={{ borderTop: "1px solid var(--hw-border)" }}
            >
              <div className="rounded-xl p-3 text-center" style={{ background: "var(--hw-surface-2)" }}>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--hw-text-1)" }}>{totalPeriodos}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--hw-text-4)" }}>Períodos</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(5,150,105,0.06)" }}>
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--hw-success)" }}>{pagadosCount}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--hw-text-4)" }}>Pagados</p>
              </div>
              {atrasadosCount > 0
                ? (
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(239,68,68,0.06)" }}>
                    <p className="text-lg font-bold tabular-nums" style={{ color: "var(--hw-danger)" }}>{atrasadosCount}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--hw-text-4)" }}>Atrasados</p>
                  </div>
                ) : (
                  <div className="rounded-xl p-3 text-center" style={{ background: "rgba(37,99,235,0.06)" }}>
                    <p className="text-lg font-bold tabular-nums" style={{ color: "var(--hw-primary)" }}>{totalPeriodos - pagadosCount}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--hw-text-4)" }}>Pendientes</p>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* ── Documentos ── */}
        {contrato.documentos.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
          >
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--hw-border)" }}>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                <Download className="h-4 w-4" aria-hidden />
                Mis documentos
              </h2>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--hw-border)" }}>
              {contrato.documentos.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--pf-surface)]">
                  <FileText className="h-4 w-4 shrink-0" style={{ color: "var(--hw-text-4)" }} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium" style={{ color: "var(--hw-text-1)" }}>{doc.nombre}</p>
                    <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
                      {TIPO_DOC_LABEL[doc.tipo] ?? doc.tipo} · {fecha(doc.createdAt)}
                    </p>
                  </div>
                  <a
                    href={`/api/portal/documento/${doc.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:opacity-80"
                    style={{ background: "var(--hw-surface-2)", color: "var(--hw-primary)", border: "1px solid var(--hw-border)" }}
                    download
                    aria-label={`Descargar ${doc.nombre}`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden />
                    Descargar
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Períodos de pago (componente cliente con filtro por año) ── */}
        {periodosCliente.length > 0 && (
          <PagosSection
            periodos={periodosCliente}
            denominacion={contrato.denominacion}
            valorArriendo={contrato.valorArriendo.toString()}
          />
        )}

        {/* ── Vouchers / liquidaciones (propietario) ── */}
        {!esArrendatario && contrato.vouchers && contrato.vouchers.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
          >
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--hw-border)" }}>
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
                <CreditCard className="h-4 w-4" aria-hidden />
                Liquidaciones recibidas
              </h2>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--hw-border)" }}>
              {contrato.vouchers.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-sm" style={{ color: "var(--hw-text-3)" }}>{fecha(v.fecha)}</span>
                  <span className="hw-num font-semibold" style={{ color: "var(--hw-text-1)" }}>
                    {clp(Number(v.montoClp))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Mensajes del corredor ── */}
        {esArrendatario && (
          <ComentariosSection comentarios={comentariosCliente} />
        )}

        {/* ── Mis datos registrados ── */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
        >
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
            <User className="h-4 w-4" aria-hidden />
            Mis datos registrados
          </h2>
          <div className="space-y-1">
            <p className="font-semibold" style={{ color: "var(--hw-text-1)" }}>{persona.nombre}</p>
            <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>{persona.rut}</p>
            {persona.email && <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>{persona.email}</p>}
            {esArrendatario && contrato.arrendatario.telefono && (
              <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>{contrato.arrendatario.telefono}</p>
            )}
          </div>
        </div>

        {/* ── Valoración del corredor ── */}
        {/* Ya valoró: se muestra el estado en vez de esconder la sección. Antes
            el bloque simplemente desaparecía cuando `valoracionDada` pasaba a
            true, y desde el lado del arrendatario eso es indistinguible de
            "la función está rota" — de hecho así se reportó. */}
        {esArrendatario && contrato.tokenValoracion && contrato.valoracionDada && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4" style={{ color: "var(--hw-warning-dk)" }} aria-hidden />
              <h2 className="text-sm font-semibold" style={{ color: "var(--hw-text-1)" }}>
                Ya evaluaste a este corredor
              </h2>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--hw-text-3)" }}>
              Gracias por tu opinión. Cada contrato permite una sola evaluación,
              así que no es posible modificarla ni enviar otra.
            </p>
          </div>
        )}

        {esArrendatario && contrato.tokenValoracion && !contrato.valoracionDada && (
          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--hw-surface)", border: "1px solid rgba(245,158,11,0.3)", boxShadow: "var(--hw-shadow)" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Star className="h-4 w-4" style={{ color: "var(--hw-warning-dk)" }} aria-hidden />
              <h2 className="text-sm font-semibold" style={{ color: "var(--hw-text-1)" }}>
                ¿Cómo fue tu experiencia con el corredor?
              </h2>
            </div>
            <p className="mb-3 text-xs" style={{ color: "var(--hw-text-3)" }}>
              Tu opinión ayuda a otros arrendatarios. Puedes dejar tu valoración una sola vez.
            </p>
            <ValoracionButton token={contrato.tokenValoracion} />
          </div>
        )}

        <div className="pb-4">
          <PreferenciasAvisos
            suscrito={puedeRecibir(prefRow)}
            descripcion={describirPreferencia(prefRow)}
          />
        </div>

        {/* ── Footer ── */}
        <div className="pb-4 flex flex-col items-center gap-1 text-center text-xs" style={{ color: "var(--hw-text-4)" }}>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--hw-success)" }} aria-hidden />
            Información confidencial — Acceso personal y no transferible
          </div>
          <p>Sesión válida por 30 minutos · Housing SOLIDIT · Ley 21.719</p>
        </div>

      </main>
    </div>
  );
}
