import { Suspense } from "react";
import { getActor, getPeriodosPendientes, propiedadIdsVisibles } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { PageTitle, StatCard } from "@/components/panel/ui";
import { clp } from "@/lib/format";
import { CobrosClient } from "./cobros-client";
import { CheckCircle2, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CobrosPage() {
  const actor    = await getActor();
  const tenant   = actor.tenant;
  const propiedadIds = await propiedadIdsVisibles(actor);
  const periodos = await getPeriodosPendientes(tenant.id, propiedadIds);

  const atrasados    = periodos.filter((p) => p.estado === "atrasado").length;
  const porCerrar    = periodos.filter((p) => p.estado === "pagado").length;
  const enRecaudacion = periodos
    .filter((p) => p.estado === "pagado")
    .reduce((sum, p) => sum + p.arriendoCLP, 0);

  // Progreso global: liquidados / total vencidos (todos los períodos pasados).
  // Secuencial, no Promise.all: tx comparte una única conexión Postgres.
  const [liquidadosTotal, totalVencidos] = await withTenant(tenant.id, async (tx) => {
    const filtroPropiedad = propiedadIds ? { contrato: { propiedadId: { in: propiedadIds } } } : {};
    const liquidadosTotal = await tx.periodoPago.count({
      where: { tenantId: tenant.id, estado: "liquidado", ...filtroPropiedad },
    });
    const totalVencidos = await tx.periodoPago.count({
      where: { tenantId: tenant.id, estado: { in: ["liquidado", "pagado", "atrasado"] }, ...filtroPropiedad },
    });
    return [liquidadosTotal, totalVencidos] as const;
  });
  const liquidadosMes = liquidadosTotal;
  const totalMes      = totalVencidos;
  const progresoPct   = totalMes > 0 ? Math.round((liquidadosMes / totalMes) * 100) : 0;

  return (
    <>
      <PageTitle
        title="Cobros y Liquidaciones"
        subtitle="Gestiona los pagos recibidos y cierra las liquidaciones del mes."
      />

      {/* KPIs */}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Por conciliar"
          value={String(atrasados)}
          sub="Períodos sin pago declarado"
          tone={atrasados > 0 ? "red" : "slate"}
        />
        <StatCard
          label="Por cerrar"
          value={String(porCerrar)}
          sub="Pagados, pendientes de liquidar"
          tone={porCerrar > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="En recaudación"
          value={clp(enRecaudacion)}
          sub="Listo para liquidar a propietarios"
          tone="blue"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Barra de progreso del mes */}
      {totalMes > 0 && (
        <div
          className="pgo-card mb-6 px-5 py-4"
          role="region"
          aria-label="Progreso de liquidaciones del mes"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className="h-4 w-4"
                aria-hidden="true"
                style={{ color: progresoPct === 100 ? "var(--pgo-success)" : "var(--pgo-text-4)" }}
              />
              <span className="text-sm font-medium" style={{ color: "var(--pgo-text-2)" }}>
                Progreso total de liquidaciones
              </span>
            </div>
            <span
              className="text-sm font-bold pgo-num"
              style={{ color: progresoPct === 100 ? "var(--pgo-success)" : "var(--pgo-primary)" }}
            >
              {liquidadosMes} / {totalMes} liquidados ({progresoPct}%)
            </span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full"
            style={{ background: "var(--pgo-border)" }}
            role="progressbar"
            aria-valuenow={progresoPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progresoPct}% de liquidaciones completadas`}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progresoPct}%`,
                background: progresoPct === 100
                  ? "var(--pgo-success)"
                  : `linear-gradient(90deg, var(--pgo-primary) 0%, var(--pgo-primary-dk) 100%)`,
                boxShadow: progresoPct === 100
                  ? "0 0 10px rgba(52,211,153,0.6)"
                  : "0 0 10px color-mix(in srgb, var(--pgo-primary) 60%, transparent)",
              }}
            />
          </div>
        </div>
      )}

      <Suspense>
        <CobrosClient periodos={periodos} />
      </Suspense>
    </>
  );
}
