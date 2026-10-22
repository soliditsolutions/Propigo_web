import { getRendimientoPropiedades } from "@/lib/queries";
import { Card, StatCard, SectionTitle, Badge, type BadgeTone } from "@/components/panel/ui";
import { MiniBarSeries } from "@/components/panel/charts/mini-bar-series";
import { clp, cantidad } from "@/lib/format";
import { Star, TrendingUp, TrendingDown, Minus, Repeat, Heart, ShieldCheck, Users } from "lucide-react";

const TIPO_LABEL: Record<string, string> = { casa: "Casa", departamento: "Departamento", cabana: "Cabaña" };
const TENDENCIA_ICON = { subiendo: TrendingUp, bajando: TrendingDown, estable: Minus };
const TENDENCIA_COLOR = { subiendo: "var(--pgo-success)", bajando: "var(--pgo-danger)", estable: "var(--pgo-text-4)" };
const TENDENCIA_LABEL = { subiendo: "En alza", bajando: "En baja", estable: "Estable" };
const POSICION_LABEL: Record<string, string> = {
  bajo_mercado: "Bajo mercado", en_mercado: "En línea", sobre_mercado: "Sobre mercado", sin_datos: "Sin comparables",
};
const POSICION_TONE: Record<string, BadgeTone> = {
  bajo_mercado: "amber", en_mercado: "green", sobre_mercado: "blue", sin_datos: "slate",
};

export async function RendimientoPropiedadesTab({ tenantId }: { tenantId: string }) {
  const data = await getRendimientoPropiedades(tenantId);

  const vacanciaData = data.vacanciaPorTipo.map((v) => ({
    tipo: TIPO_LABEL[v.tipo] ?? v.tipo,
    dias: v.diasPromedio ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Rotación de arrendatarios"
          value={`${data.turnoverPct}%`}
          sub="Contratos terminados en 12m / propiedades totales"
          tone="slate"
          icon={<Repeat className="h-4 w-4" />}
        />
        <StatCard
          label="Retención"
          value={`${data.retencionPct}%`}
          sub="Contratos que se renovaron al menos una vez"
          tone={data.retencionPct >= 50 ? "green" : "amber"}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <Card className="p-5">
        <SectionTitle title="Comparables de mercado" description="Renta actual vs. mediana de publicaciones activas del marketplace, mismo tipo y comuna" />
        {data.comparablesMercado.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>Sin contratos vigentes para comparar.</p>
        ) : (
          <div className="space-y-2">
            {data.comparablesMercado.map((c) => (
              <div key={c.propiedadId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate" style={{ color: "var(--pgo-text-1)" }}>{c.direccion}</span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums" style={{ color: "var(--pgo-text-3)" }}>
                    {clp(c.rentaActualClp)}
                    {c.medianaMercadoClp !== null && (
                      <span style={{ color: "var(--pgo-text-4)" }}> / mediana {clp(c.medianaMercadoClp)}</span>
                    )}
                  </span>
                  <Badge tone={POSICION_TONE[c.posicion]}>{POSICION_LABEL[c.posicion]}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Renta por m²" description="Renta mensual dividida por los metros cuadrados totales. Solo aparecen las propiedades con superficie registrada." />
          {data.rentaPorM2.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>Ninguna propiedad con contrato vigente tiene m² cargados.</p>
          ) : (
            <div className="space-y-2">
              {data.rentaPorM2.map((r, i) => (
                <div key={r.propiedadId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 shrink-0 text-xs font-semibold" style={{ color: "var(--pgo-text-4)" }}>{i + 1}</span>
                    <span className="truncate" style={{ color: "var(--pgo-text-1)" }}>{r.direccion}</span>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0" style={{ color: "var(--pgo-text-1)" }}>{clp(r.clpPorM2)}/m²</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Rendimiento por colaborador" description="Cartera asignada, ingreso acumulado 12 meses" />
          {data.rendimientoColaboradores.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>Sin colaboradores activos en el equipo.</p>
          ) : (
            <div className="space-y-3">
              {data.rendimientoColaboradores.map((c) => (
                <div key={c.colaboradorId} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pgo-text-4)" }} aria-hidden="true" />
                    <span className="truncate" style={{ color: "var(--pgo-text-1)" }}>{c.nombre}</span>
                    <span className="shrink-0 text-xs" style={{ color: "var(--pgo-text-4)" }}>{c.propiedadesCount} prop.</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {c.periodosAtrasados > 0 && (
                      <span className="text-xs" style={{ color: "var(--pgo-danger)" }}>{cantidad(c.periodosAtrasados, "atraso", "atrasos")}</span>
                    )}
                    <span className="font-semibold tabular-nums" style={{ color: "var(--pgo-success)" }}>{clp(c.ingresoClp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Ranking de rentabilidad" description="Ingreso acumulado, 12 meses" />
          {data.rankingRentabilidad.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>Sin pagos registrados aún en la ventana de 12 meses.</p>
          ) : (
            <div className="space-y-2">
              {data.rankingRentabilidad.map((r, i) => (
                <div key={r.propiedadId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 shrink-0 text-xs font-semibold" style={{ color: "var(--pgo-text-4)" }}>{i + 1}</span>
                    <span className="truncate" style={{ color: "var(--pgo-text-1)" }}>{r.direccion}</span>
                  </div>
                  <span className="font-semibold tabular-nums shrink-0" style={{ color: "var(--pgo-success)" }}>{clp(r.ingresoClp)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle title="Propiedades con más mora" description="Histórico de períodos atrasados" />
          {data.rankingMora.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>Sin atrasos registrados. </p>
          ) : (
            <div className="space-y-2">
              {data.rankingMora.map((r) => (
                <div key={r.propiedadId} className="flex items-center justify-between text-sm">
                  <span className="truncate" style={{ color: "var(--pgo-text-1)" }}>{r.direccion}</span>
                  <span className="font-semibold shrink-0" style={{ color: "var(--pgo-danger)" }}>{cantidad(r.periodosAtrasados, "atraso", "atrasos")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Vacancia promedio por tipo" description="Días entre el fin de un contrato y el siguiente arriendo" />
          <MiniBarSeries
            data={vacanciaData}
            xKey="tipo"
            format="dias"
            series={[{ key: "dias", label: "Días", color: "var(--pgo-warning)" }]}
          />
        </Card>

        <Card className="p-5">
          <SectionTitle title="Valoración del corredor" description="De arrendatarios, sobre 5 estrellas" />
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Star className="h-6 w-6" style={{ color: "var(--pgo-warning)" }} fill="var(--pgo-warning)" />
              <span className="text-3xl font-bold pgo-num" style={{ color: "var(--pgo-text-1)" }}>
                {data.valoracion.promedio ?? "—"}
              </span>
              {data.valoracion.tendencia && (() => {
                const Icon = TENDENCIA_ICON[data.valoracion.tendencia];
                return (
                  <span
                    className="ml-1 flex items-center gap-1 text-xs font-medium"
                    style={{ color: TENDENCIA_COLOR[data.valoracion.tendencia] }}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {TENDENCIA_LABEL[data.valoracion.tendencia]}
                  </span>
                );
              })()}
            </div>
            <div className="flex-1 space-y-1">
              {data.valoracion.distribucion.slice().reverse().map((d) => {
                const pct = data.valoracion.total > 0 ? (d.count / data.valoracion.total) * 100 : 0;
                return (
                  <div key={d.estrellas} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-right" style={{ color: "var(--pgo-text-4)" }}>{d.estrellas}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--pgo-border)" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--pgo-warning)" }} />
                    </div>
                    <span className="w-5 text-right tabular-nums" style={{ color: "var(--pgo-text-4)" }}>{d.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {data.valoracion.total === 0 && (
            <p className="mt-2 text-xs" style={{ color: "var(--pgo-text-4)" }}>Aún no hay valoraciones de arrendatarios.</p>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Arrendatarios de mayor fidelidad" description="Cero atrasos históricos en esta cartera" />
        {data.arrendatariosSinAtrasos.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>Aún no hay arrendatarios sin atrasos que destacar.</p>
        ) : (
          <div className="space-y-2">
            {data.arrendatariosSinAtrasos.map((a) => (
              <div key={a.personaId} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2" style={{ color: "var(--pgo-text-1)" }}>
                  <Heart className="h-3.5 w-3.5" style={{ color: "var(--pgo-danger)" }} aria-hidden="true" />
                  {a.nombre}
                </span>
                <span className="text-xs" style={{ color: "var(--pgo-text-4)" }}>{cantidad(a.contratosCount, "contrato", "contratos")}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
