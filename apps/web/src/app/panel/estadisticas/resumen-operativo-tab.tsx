import { getResumenOperativo } from "@/lib/queries";
import { Card, StatCard, SectionTitle } from "@/components/panel/ui";
import { MiniDonut } from "@/components/panel/charts/mini-donut";
import { MiniBarSeries } from "@/components/panel/charts/mini-bar-series";
import { clp, fecha } from "@/lib/format";
import { Home, AlertTriangle, Percent, TrendingDown } from "lucide-react";

const ESTADO_COLOR: Record<string, string> = {
  borrador: "var(--hw-border-2)",
  disponible: "var(--hw-success)",
  reservada: "var(--hw-warning)",
  arrendada: "var(--hw-primary)",
};
const ESTADO_LABEL: Record<string, string> = {
  borrador: "Borrador",
  disponible: "Disponible",
  reservada: "Reservada",
  arrendada: "Arrendada",
};

export async function ResumenOperativoTab({ tenantId }: { tenantId: string }) {
  const data = await getResumenOperativo(tenantId);

  const donutData = data.ocupacionDesglose
    .filter((d) => d.count > 0)
    .map((d) => ({ label: ESTADO_LABEL[d.estado] ?? d.estado, value: d.count, color: ESTADO_COLOR[d.estado] ?? "var(--hw-border-2)" }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ocupación"
          value={`${data.ocupacionPct}%`}
          sub="Reservadas + arrendadas / total"
          tone="blue"
          icon={<Home className="h-4 w-4" />}
        />
        <StatCard
          label="Por cobrar este mes"
          value={clp(data.porCobrarEsteMesClp)}
          sub="Períodos con vencimiento en el mes en curso"
          tone="slate"
          icon={<Percent className="h-4 w-4" />}
        />
        <StatCard
          label="Morosidad"
          value={`${data.tasaMorosidadPct}%`}
          sub="Períodos vencidos que llegaron atrasados"
          tone={data.tasaMorosidadPct > 15 ? "red" : "slate"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Lucro cesante del mes"
          value={clp(data.vacancyLossClp)}
          sub="Estimado sobre las propiedades vacías, según la renta de su último contrato"
          tone={data.vacancyLossClp > 0 ? "amber" : "slate"}
          icon={<TrendingDown className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Propiedades por estado" />
          <div className="flex items-center gap-6">
            <MiniDonut data={donutData} height={140} />
            <div className="space-y-1.5 text-sm">
              {donutData.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                  <span style={{ color: "var(--hw-text-2)" }}>{d.label}</span>
                  <span className="font-semibold" style={{ color: "var(--hw-text-1)" }}>{d.value}</span>
                </div>
              ))}
              {donutData.length === 0 && (
                <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Sin propiedades cargadas aún.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Cobrado vs. facturado" description="Últimos 3 meses" />
          <MiniBarSeries
            data={data.cobradoVsFacturado}
            xKey="mes"
            format="clpCompact"
            series={[
              { key: "facturado", label: "Facturado", color: "var(--hw-border-2)" },
              { key: "cobrado", label: "Cobrado", color: "var(--hw-success)" },
            ]}
          />
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Próximos vencimientos" description="Los 5 más cercanos" />
        {data.proximosVencimientos.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--hw-text-4)" }}>Sin períodos pendientes.</p>
        ) : (
          <div className="space-y-2">
            {data.proximosVencimientos.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <span style={{ color: "var(--hw-text-1)" }}>{p.arrendatario}</span>
                  <span className="ml-2 text-xs" style={{ color: "var(--hw-text-4)" }}>{p.direccion}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs tabular-nums" style={{ color: "var(--hw-text-3)" }}>{fecha(p.fechaVencimiento)}</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--hw-text-1)" }}>{clp(p.montoClp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
