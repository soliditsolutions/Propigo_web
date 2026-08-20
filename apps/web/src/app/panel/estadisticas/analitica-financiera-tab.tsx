import { getAnaliticaFinanciera } from "@/lib/queries";
import { Card, StatCard, SectionTitle } from "@/components/panel/ui";
import { MiniLine } from "@/components/panel/charts/mini-line";
import { MiniBarSeries } from "@/components/panel/charts/mini-bar-series";
import { MiniDonut } from "@/components/panel/charts/mini-donut";
import { clp, cantidad, plural } from "@/lib/format";
import { Coins, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";

export async function AnaliticaFinancieraTab({ tenantId }: { tenantId: string }) {
  const data = await getAnaliticaFinanciera(tenantId);

  const donutCartera = data.carteraPorDenominacion.map((c) => ({
    label: c.denominacion === "UF" ? "Contratos en UF" : "Contratos en CLP",
    value: c.contratos,
    color: c.denominacion === "UF" ? "var(--hw-primary)" : "var(--hw-success)",
  }));

  const totalAtrasados = data.agingMorosidad.reduce((a, b) => a + b.count, 0);
  const totalDeudaAbierta = data.agingMorosidad.reduce((a, b) => a + b.montoClp, 0);
  const bucketLabel: Record<string, string> = { "1-30": "1–30 días", "31-60": "31–60 días", "60+": "60+ días" };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Ticket promedio de arriendo"
          value={clp(data.ticketPromedioClp)}
          sub="Contratos vigentes, normalizado a CLP"
          tone="blue"
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="Comisión del mes en curso"
          value={clp(data.comisionGanadaPorMes.at(-1)?.monto ?? 0)}
          sub="Comisiones activadas este mes"
          tone="green"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="Cobro dentro de plazo"
          value={`${data.collectionRatePct}%`}
          sub="Pagos recibidos hasta 5 días después del vencimiento, últimos 12 meses"
          tone={data.collectionRatePct < 70 ? "amber" : "green"}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Ingresos cobrados" description="Últimos 12 meses" />
          <MiniLine data={data.ingresosCobradosPorMes} xKey="mes" yKey="monto" color="var(--hw-success)" format="clpCompact" />
        </Card>

        <Card className="p-5">
          <SectionTitle title="Comisión ganada" description="Últimos 12 meses" />
          <MiniBarSeries
            data={data.comisionGanadaPorMes}
            xKey="mes"
            format="clpCompact"
            series={[{ key: "monto", label: "Comisión", color: "var(--hw-primary)" }]}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Cartera por denominación" description="Contratos vigentes" />
          <div className="flex items-center gap-6">
            <MiniDonut data={donutCartera} height={140} />
            <div className="space-y-2 text-sm">
              {data.carteraPorDenominacion.map((c) => (
                <div key={c.denominacion}>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ background: c.denominacion === "UF" ? "var(--hw-primary)" : "var(--hw-success)" }}
                    />
                    <span style={{ color: "var(--hw-text-2)" }}>{c.denominacion}</span>
                    <span className="font-semibold" style={{ color: "var(--hw-text-1)" }}>{c.contratos}</span>
                  </div>
                  <p className="ml-4.5 text-xs" style={{ color: "var(--hw-text-4)" }}>{clp(c.montoClp)} en renta mensual</p>
                </div>
              ))}
              {donutCartera.length === 0 && (
                <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Sin contratos vigentes.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Evolución de morosidad" description="Últimos 12 meses" />
          <MiniLine
            data={data.evolucionMorosidad}
            xKey="mes"
            yKey="tasaPct"
            color="var(--hw-danger)"
            format="pct"
          />
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Aging de morosidad"
          description={totalAtrasados > 0
            ? `Hoy hay ${cantidad(totalAtrasados, "período", "períodos")} ${plural(totalAtrasados, "atrasado", "atrasados")}, con ${clp(totalDeudaAbierta)} de deuda abierta.`
            : "Hoy no hay períodos atrasados."}
        />
        <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <MiniBarSeries
            data={data.agingMorosidad.map((b) => ({ bucket: bucketLabel[b.bucket], montoClp: b.montoClp }))}
            xKey="bucket"
            format="clpCompact"
            series={[{ key: "montoClp", label: "Deuda abierta", color: "var(--hw-danger)" }]}
          />
          <div className="flex flex-col gap-2 text-sm sm:min-w-[180px]">
            {data.agingMorosidad.map((b) => (
              <div key={b.bucket} className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--hw-text-3)" }}>{bucketLabel[b.bucket]}</span>
                <span className="tabular-nums font-medium" style={{ color: "var(--hw-text-1)" }}>{b.count}</span>
              </div>
            ))}
            {data.agingMorosidad.some((b) => b.bucket === "60+" && b.count > 0) && (
              <p className="mt-1 flex items-start gap-1.5 text-xs" style={{ color: "var(--hw-warning)" }}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Hay deuda con más de 60 días de atraso.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
