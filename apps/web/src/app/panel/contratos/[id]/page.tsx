import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ShieldCheck, AlertTriangle, Download } from "lucide-react";
import { getActor, getContratoDetalle, getCupoIaInfo } from "@/lib/queries";
import { clp, num, fecha, cantidad } from "@/lib/format";
import { Badge, Card, estadoTone, estadoPulse, estadoLabel, PageTitle } from "@/components/panel/ui";
import { TabNav } from "@/components/panel/tab-nav";
import { FirmaSection } from "./firma-section";
import { CierreSection } from "./cierre-section";
import { RenovarSection } from "./renovar-section";
import { AnexosSection } from "./anexos-section";
import { ComentariosCorredorSection } from "@/components/panel/ComentariosCorredorSection";
import { verificarYExtenderCalendario } from "@/lib/auto-extender";

export const dynamic = "force-dynamic";

const TIPO_LABEL: Record<string, string> = {
  CARGO_ARRIENDO:          "Cargo arriendo",
  CARGO_GASTO_COMUN:       "Cargo gasto común",
  CARGO_INTERES:           "Cargo interés",
  CARGO_MULTA:             "Cargo multa",
  CARGO_AJUSTE:            "Cargo ajuste",
  PAGO_RECIBIDO:           "Pago recibido",
  COMISION_CORREDOR:       "Comisión corredor",
  AJUSTE_LIQUIDACION:      "Ajuste liquidación",
  LIQUIDACION_PROPIETARIO: "Liquidación propietario",
  GARANTIA_RECIBIDA:       "Garantía recibida",
  RETENCION_GARANTIA:      "Retención garantía",
  DEVOLUCION_GARANTIA:     "Devolución garantía",
};

const TIPOS_SALIDA = new Set([
  "COMISION_CORREDOR",
  "AJUSTE_LIQUIDACION",
  "LIQUIDACION_PROPIETARIO",
  "RETENCION_GARANTIA",
  "DEVOLUCION_GARANTIA",
]);

const TIPOS_ENTRADA = new Set([
  "PAGO_RECIBIDO",
  "GARANTIA_RECIBIDA",
]);

export default async function ContratoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const actor  = await getActor();
  const tenant = actor.tenant;

  let detalle;
  try {
    detalle = await getContratoDetalle(tenant.id, id);
  } catch {
    notFound();
  }

  // ADR-0013 (Fase D) — un Colaborador solo ve contratos de propiedades que
  // tiene asignadas; mismo trato que "no existe" (ROL-SEC-2), no un error.
  if (actor.rol !== "manager" && detalle.propiedad.asignadoAId !== actor.usuarioId) {
    notFound();
  }

  // Auto-extensión silenciosa para contratos indefinidos cuyo calendario se acerca al final.
  if (detalle.estado === "vigente" && !detalle.fechaFin && detalle.periodos.length > 0) {
    const extendido = await verificarYExtenderCalendario(tenant.id, id, detalle);
    if (extendido) {
      try { detalle = await getContratoDetalle(tenant.id, id); } catch { notFound(); }
    }
  }

  // Cupo diario de IA — solo se consulta si el contrato está en borrador, que
  // es el único estado donde se puede mandar el documento a la IA. En un
  // contrato vigente sería una consulta a la base para no mostrar nada.
  const cupoIa = detalle.estado === "borrador"
    ? await getCupoIaInfo(tenant.id, tenant.plan)
    : null;

  const alertVencimiento = (() => {
    if (detalle.estado !== "vigente" || !detalle.fechaFin) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dias = Math.floor(
      (new Date(detalle.fechaFin).getTime() - hoy.getTime()) / 86_400_000,
    );
    if (dias < 0 || dias > 90) return null;
    return { dias, urgente: dias <= 30 };
  })();

  const uf = detalle.denominacion === "UF";
  const renta = uf
    ? `${num(detalle.valorArriendo)} UF`
    : clp(detalle.valorArriendo);

  // Renovación y término normal solo disponibles a ≤30 días del vencimiento
  const permitirTerminoNormal = alertVencimiento?.urgente === true;

  const tieneGarantia = detalle.garantiaMontoCLP > 0;
  const tieneDeuda    = detalle.periodos.some((p) => p.estado === "atrasado");

  const estadosCal = detalle.periodos.reduce(
    (acc, p) => { acc[p.estado] = (acc[p.estado] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const tab = ((await searchParams).tab ?? "vigencia") as
    "vigencia" | "periodos" | "documentos" | "ledger" | "mensajes";

  return (
    <>
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link
          href="/panel/contratos"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--hw-text-3)] hover:text-[var(--hw-text-2)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Contratos
        </Link>
      </div>

      <PageTitle
        title={detalle.propiedad.direccion}
        subtitle={[detalle.propiedad.comuna, detalle.propiedad.tipo].filter(Boolean).join(" · ")}
        // Solo antes de activar: "vigente" significa que ya existe un contrato
        // firmado de verdad fuera del sistema (ver FirmaSection — activar exige
        // confirmar que ambas partes ya firmaron). Ofrecer un PDF marcado
        // "BORRADOR" para un contrato ya vigente es confuso en el mejor caso, y
        // en el peor puede no coincidir con lo que realmente se firmó si un
        // abogado ajustó algo entre el borrador y la firma real.
        action={detalle.estado === "borrador" ? (
          <a
            href={`/api/contratos/${detalle.id}/pdf`}
            className="hw-btn inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{
              background: "var(--hw-surface-2)", color: "var(--hw-text-2)",
              border: "1px solid var(--hw-border-2)",
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Descargar borrador (PDF)
          </a>
        ) : (detalle.estado === "terminado" || detalle.estado === "terminado_anticipado") ? (
          // Aviso de término (L-CM2/L-CM3): disponible una vez que el contrato
          // tiene causal y fecha de término.
          <a
            href={`/api/panel/contratos/${detalle.id}/aviso-termino/pdf`}
            className="hw-btn inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{
              background: "var(--hw-surface-2)", color: "var(--hw-text-2)",
              border: "1px solid var(--hw-border-2)",
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Aviso de término (PDF)
          </a>
        ) : undefined}
      />

      {/* ── Header info (siempre visible) ───────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--hw-text-4)] mb-1">Arrendatario</p>
          <p className="font-semibold text-[var(--hw-text-1)]">{detalle.arrendatario.nombre}</p>
          <p className="text-xs text-[var(--hw-text-4)]">{detalle.arrendatario.rut}</p>
          {detalle.arrendatario.email && (
            <p className="text-xs text-[var(--hw-text-4)] truncate">{detalle.arrendatario.email}</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--hw-text-4)] mb-1">Propietario</p>
          <p className="font-semibold text-[var(--hw-text-1)]">{detalle.propietario.nombre}</p>
          <p className="text-xs text-[var(--hw-text-4)]">{detalle.propietario.rut}</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--hw-text-4)] mb-1">Renta mensual</p>
          <p className="text-xl font-bold text-[var(--hw-text-1)]">{renta}</p>
          {detalle.cobraGastoComun && (
            <p className="text-xs text-[var(--hw-text-4)]">+ gasto común</p>
          )}
          <p className="mt-1 text-xs text-[var(--hw-text-4)]">
            Comisión {detalle.comisionCorredorPct}% · Vence día {detalle.diaVencimiento}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--hw-text-4)] mb-1">Vigencia</p>
          <p className="text-sm font-medium text-[var(--hw-text-1)]">{fecha(detalle.fechaInicio)}</p>
          {detalle.fechaFin && (
            <p className="text-xs text-[var(--hw-text-4)]">hasta {fecha(detalle.fechaFin)}</p>
          )}
          <div className="mt-2">
            <Badge tone={estadoTone(detalle.estado)} pulse={estadoPulse(detalle.estado)}>{estadoLabel(detalle.estado)}</Badge>
          </div>
        </Card>
      </div>

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <TabNav
        tabs={[
          { key: "vigencia",   label: "Vigencia" },
          { key: "periodos",   label: "Períodos",   count: estadosCal.atrasado ?? 0 },
          { key: "documentos", label: "Documentos", count: detalle.documentos.length },
          { key: "mensajes",   label: "Mensajes",   count: detalle.comentarios.length },
          { key: "ledger",     label: "Ledger",     count: detalle.asientos.length },
        ]}
        activeTab={tab}
        baseHref={`/panel/contratos/${id}`}
      />

      {/* ── Tab: Vigencia ───────────────────────────────────────────────── */}
      {tab === "vigencia" && (
        <>
            {/* key por contrato en las secciones con estado propio.
                Estas secciones guardan checkbox de confirmación ("ambas partes
                firmaron", "deseo cancelar"); que sobrevivan a un cambio de
                contrato dejaría al usuario a un clic de accionar sobre el
                equivocado.

                VERIFICADO 2026-08-19: hoy Next.js ya remonta al cambiar el
                parámetro [id], así que quitar este key NO reproduce el problema
                — se comprobó en el navegador. El key se mantiene como defensa
                explícita, no porque haya un fallo activo: la garantía de
                remontaje depende del router, no de nuestro código, y el costo
                de equivocarse acá es accionar sobre el contrato equivocado. */}
          {detalle.estado === "borrador" && (
            <FirmaSection
              key={detalle.id}
              contratoId={detalle.id}
              validacionIa={detalle.validacionIa as import("@/app/api/contratos/[id]/validar/route").ValidacionResultado | null}
              validacionEstado={detalle.validacionEstado}
              validacionAt={detalle.validacionAt}
              validacionConfirmadaAt={detalle.validacionConfirmadaAt}
              cupoIa={cupoIa}
            />
          )}

          {alertVencimiento && (alertVencimiento.urgente ? (
            <a
              href="#renovar-section"
              className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-4 no-underline transition-opacity hover:opacity-90"
              style={{ background: "var(--hw-danger-lt)", border: "2px solid var(--hw-danger-bd)" }}
              aria-label={`Contrato vence en ${alertVencimiento.dias} días. Ir a sección de renovación.`}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--hw-danger)" }} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: "var(--hw-danger-dk)" }}>
                  {`Vence en ${alertVencimiento.dias} día${alertVencimiento.dias !== 1 ? "s" : ""} — renovación urgente`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--hw-danger-dk)" }}>
                  Haz clic para ir a la sección de renovación y extender el plazo.
                </p>
              </div>
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: "var(--hw-danger-dk)" }}>
                Renovar →
              </span>
            </a>
          ) : (
            <div
              className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-4"
              style={{ background: "var(--hw-warning-lt)", border: "2px solid var(--hw-warning-bd)" }}
            >
              <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--hw-warning)" }} aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: "var(--hw-warning-dk)" }}>
                  {`Este contrato vence en ${alertVencimiento.dias} día${alertVencimiento.dias !== 1 ? "s" : ""}`}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--hw-warning-dk)" }}>
                  La opción de renovación estará disponible a partir del último mes.
                </p>
              </div>
            </div>
          ))}

          <div id="renovar-section">
            {detalle.estado === "vigente" && detalle.fechaFin !== null && alertVencimiento?.urgente && (
              <RenovarSection
                key={detalle.id}
                contratoId={detalle.id}
                fechaFinActual={detalle.fechaFin}
                valorArriendoActual={detalle.valorArriendo}
                denominacion={detalle.denominacion}
              />
            )}
          </div>

          {detalle.estado === "vigente" && (
            <CierreSection
              key={detalle.id}
              contratoId={detalle.id}
              fechaFin={detalle.fechaFin}
              valorArriendo={detalle.valorArriendo}
              denominacion={detalle.denominacion}
              garantiaDisponibleCLP={detalle.garantiaDisponibleCLP}
              garantiaDenominacion={detalle.garantiaDenominacion}
              garantiaMontoBase={detalle.garantiaMontoBase}
              permitirTerminoNormal={permitirTerminoNormal}
            />
          )}

          {tieneGarantia && (
            <Card className="mb-6 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[var(--hw-primary)] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--hw-text-1)]">
                    Garantía de {cantidad(detalle.garantiaMeses, "mes", "meses")} ·{" "}
                    {detalle.garantiaDenominacion === "UF" && detalle.garantiaMontoBase != null
                      ? <>{detalle.garantiaMontoBase} UF <span className="font-normal text-[var(--hw-text-4)]">(depositado {clp(detalle.garantiaMontoCLP)})</span></>
                      : <>depositado {clp(detalle.garantiaMontoCLP)}</>}
                  </p>
                  <p className="text-xs text-[var(--hw-text-4)]">
                    Saldo retenido actual:{" "}
                    <span className="font-medium text-[var(--hw-text-2)]">{clp(detalle.garantiaRetenidaCLP)}</span>
                  </p>
                </div>
                <p className="text-xs text-[var(--hw-text-4)]">Hasta 2 rentas — práctica de mercado recomendada</p>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Tab: Períodos ───────────────────────────────────────────────── */}
      {tab === "periodos" && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-[var(--hw-text-1)] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--hw-text-4)]" />
              Calendario de períodos
              <span className="text-xs font-normal text-[var(--hw-text-4)]">({detalle.periodos.length} en total)</span>
            </h2>
            <div className="flex gap-3 text-xs text-[var(--hw-text-3)]">
              {Object.entries(estadosCal).map(([e, n]) => (
                <span key={e}><Badge tone={estadoTone(e)} pulse={estadoPulse(e)}>{estadoLabel(e)}</Badge> {n}</span>
              ))}
            </div>
          </div>

          <Card className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--hw-text-4)] border-b border-[var(--hw-border)]">
                  <th scope="col" className="px-4 py-3 font-medium">#</th>
                  <th scope="col" className="px-4 py-3 font-medium">Vencimiento</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Monto base</th>
                  {detalle.cobraGastoComun && (
                    <th scope="col" className="px-4 py-3 text-right font-medium">GC</th>
                  )}
                  <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-3 font-medium">Pago real</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hw-border)]">
                {detalle.periodos.map((p) => (
                  <tr
                    key={p.id}
                    className={`text-[var(--hw-text-2)] ${p.estado === "atrasado" ? "bg-[var(--hw-danger-lt)]" : ""}`}
                  >
                    <td className="px-4 py-2.5 text-[var(--hw-text-4)] tabular-nums">{p.numero}</td>
                    <td className="px-4 py-2.5 tabular-nums">{fecha(p.fechaVencimiento)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                      {uf ? `${num(p.montoBase)} UF` : clp(p.montoBase)}
                    </td>
                    {detalle.cobraGastoComun && (
                      <td className="px-4 py-2.5 text-right text-[var(--hw-text-3)] tabular-nums">
                        {p.montoGastoComun > 0 ? clp(p.montoGastoComun) : "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Badge tone={estadoTone(p.estado)} pulse={estadoPulse(p.estado)}>{estadoLabel(p.estado)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--hw-text-4)] tabular-nums text-sm">
                      {p.fechaPagoReal ? fecha(p.fechaPagoReal) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {/* ── Tab: Documentos ─────────────────────────────────────────────── */}
      {tab === "documentos" && (
        <AnexosSection
          contratoId={detalle.id}
          documentos={detalle.documentos}
          tieneDeuda={tieneDeuda}
        />
      )}

      {/* ── Tab: Mensajes ───────────────────────────────────────────────── */}
      {tab === "mensajes" && (
        <ComentariosCorredorSection
          contratoId={detalle.id}
          comentarios={detalle.comentarios}
        />
      )}

      {/* ── Tab: Ledger ─────────────────────────────────────────────────── */}
      {tab === "ledger" && (
        <>
          <div className="mb-2">
            <h2 className="font-semibold text-[var(--hw-text-1)] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--hw-text-4)]" />
              Ledger inmutable
              <span className="text-xs font-normal text-[var(--hw-text-4)]">({detalle.asientos.length} asientos)</span>
            </h2>
          </div>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--hw-text-4)] border-b border-[var(--hw-border)]">
                  <th scope="col" className="px-4 py-3 font-medium">Fecha</th>
                  <th scope="col" className="px-4 py-3 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-3 font-medium">Descripción</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Monto CLP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hw-border)]">
                {detalle.asientos.map((a) => {
                  const esSalida  = TIPOS_SALIDA.has(a.tipo);
                  const esEntrada = TIPOS_ENTRADA.has(a.tipo);
                  return (
                    <tr key={a.id} className="hw-row-hover text-[var(--hw-text-2)]">
                      <td className="px-4 py-2 tabular-nums text-[var(--hw-text-3)]">{fecha(a.fechaEvento)}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs font-medium">{TIPO_LABEL[a.tipo] ?? a.tipo}</span>
                      </td>
                      <td className="px-4 py-2 text-[var(--hw-text-4)] text-xs max-w-xs truncate">
                        {a.descripcion ?? (a.concepto ?? "—")}
                      </td>
                      <td className={`px-4 py-2 text-right font-medium tabular-nums ${
                        esEntrada ? "text-[var(--hw-success-dk)]" :
                        esSalida  ? "text-[var(--hw-text-4)]"   :
                        a.tipo.startsWith("CARGO") ? "text-[var(--hw-danger)]" : "text-[var(--hw-text-2)]"
                      }`}>
                        {esEntrada ? "+" : esSalida || a.tipo.startsWith("CARGO") ? "−" : ""}
                        {clp(a.montoClp)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
