import { getProyeccionesRiesgo } from "@/lib/queries";
import { Card, SectionTitle, Badge, type BadgeTone } from "@/components/panel/ui";
import { ProyeccionChart } from "@/components/panel/charts/proyeccion-chart";
import { clp, fecha } from "@/lib/format";
import { puedeExportar } from "@/lib/plans";
import { Download, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

const TENDENCIA_ICON = { subiendo: TrendingUp, bajando: TrendingDown, estable: Minus };
const TENDENCIA_COLOR = { subiendo: "var(--hw-danger)", bajando: "var(--hw-success)", estable: "var(--hw-text-4)" };
const TENDENCIA_LABEL = { subiendo: "Subiendo", bajando: "Bajando", estable: "Estable" };
const NIVEL_TONE: Record<string, BadgeTone> = { bajo: "green", medio: "amber", alto: "red" };
const NIVEL_LABEL: Record<string, string> = { bajo: "Riesgo bajo", medio: "Riesgo medio", alto: "Riesgo alto" };

export async function ProyeccionesRiesgoTab({ tenantId, tenantPlan }: { tenantId: string; tenantPlan: string | null }) {
  const data = await getProyeccionesRiesgo(tenantId);
  // La capacidad la define el plan (lib/plans.ts), no una comparación de
  // strings acá. La API que sirve el CSV valida lo mismo por su cuenta:
  // ocultar el botón es cortesía, el límite real está en el servidor.
  const habilitaExportar = puedeExportar(tenantPlan);
  const TendenciaIcon = TENDENCIA_ICON[data.riesgoMora.tendencia];

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between">
          <SectionTitle title="Proyección de ingresos" description="Próximos 6 meses. Son cifras estimadas, no un compromiso de cobro." />
          {habilitaExportar && (
            <a
              href="/api/panel/estadisticas/exportar"
              className="hw-btn flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
              style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-2)" }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Exportar CSV
            </a>
          )}
        </div>
        <ProyeccionChart data={data.proyeccionIngresos} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Riesgo de mora proyectado" description="Tendencia de los últimos 6 meses" />
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hw-text-3)" }}>Actual</p>
              <p className="text-2xl font-bold hw-num" style={{ color: "var(--hw-text-1)" }}>{data.riesgoMora.tasaActualPct}%</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--hw-text-3)" }}>Proyectada</p>
              <p className="flex items-center gap-1.5 text-2xl font-bold hw-num" style={{ color: TENDENCIA_COLOR[data.riesgoMora.tendencia] }}>
                {data.riesgoMora.tasaProyectadaPct}%
                <TendenciaIcon className="h-4 w-4" aria-label={`Tendencia: ${TENDENCIA_LABEL[data.riesgoMora.tendencia]}`} />
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--hw-text-4)" }}>
            Es una estimación por tendencia reciente, no un modelo predictivo. Úsala como alerta temprana, no como cifra exacta.
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Contratos por vencer sin renovación" description="≤ 90 días, sin contrato sucesor agendado" />
          {data.alertasRenovacion.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--hw-text-4)" }}>Sin alertas — todo lo que vence pronto ya tiene sucesor o vence lejos.</p>
          ) : (
            <div className="space-y-2">
              {data.alertasRenovacion.map((a) => (
                <div key={a.contratoId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: a.diasRestantes <= 30 ? "var(--hw-danger)" : "var(--hw-warning)" }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: "var(--hw-text-1)" }}>{a.direccion}</p>
                      <p className="truncate text-xs" style={{ color: "var(--hw-text-4)" }}>{a.arrendatario}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums" style={{ color: "var(--hw-text-3)" }}>{fecha(a.fechaFin)}</span>
                    <Badge tone={NIVEL_TONE[a.riesgoChurn]}>{a.diasRestantes}d</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Escenarios de estrés" description="Cuánto ingreso quedaría en los próximos 6 meses si un porcentaje adicional de arrendatarios cayera en mora." />
          <div className="space-y-2">
            {data.stressTest.map((s) => (
              <div key={s.escenarioPctMora} className="flex items-center justify-between text-sm">
                <span style={{ color: "var(--hw-text-2)" }}>+{s.escenarioPctMora}% de mora</span>
                <span className="font-semibold tabular-nums" style={{ color: "var(--hw-text-1)" }}>{clp(s.ingresoResultanteClp)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--hw-text-4)" }}>
            Es una simulación simple sobre la proyección actual, no un modelo financiero de estrés real.
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Riesgo por arrendatario" description="Se calcula con el historial de pagos de cada arrendatario en tu cartera. No es una evaluación crediticia." />
          {data.riesgoPorArrendatario.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--hw-text-4)" }}>Sin suficiente historial de pagos para estimar riesgo.</p>
          ) : (
            <div className="space-y-2">
              {data.riesgoPorArrendatario.map((r) => (
                <div key={r.personaId} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="truncate" style={{ color: "var(--hw-text-1)" }}>{r.nombre}</p>
                    <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>{r.periodosAtrasados} de {r.periodosVencidos} períodos atrasados</p>
                  </div>
                  <Badge tone={NIVEL_TONE[r.nivel]}>{NIVEL_LABEL[r.nivel]}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle title="Concentración de riesgo por propietario" description="% del ingreso cobrado (12m) que depende de cada propietario" />
        {data.concentracionPropietarios.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--hw-text-4)" }}>Sin ingresos cobrados en los últimos 12 meses.</p>
        ) : (
          <div className="space-y-2.5">
            {data.concentracionPropietarios.map((p) => (
              <div key={p.propietarioId} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate sm:w-48" style={{ color: "var(--hw-text-1)" }}>{p.nombre}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--hw-border)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(p.pctDelTotal, 100)}%`, background: p.pctDelTotal >= 30 ? "var(--hw-danger)" : "var(--hw-primary)" }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums font-semibold" style={{ color: "var(--hw-text-1)" }}>{p.pctDelTotal}%</span>
                <span className="hidden w-28 shrink-0 text-right tabular-nums sm:inline" style={{ color: "var(--hw-text-4)" }}>{clp(p.ingresoClp)}</span>
              </div>
            ))}
            {data.concentracionPropietarios[0].pctDelTotal >= 30 && (
              <p className="mt-1 flex items-start gap-1.5 text-xs" style={{ color: "var(--hw-warning)" }}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Más del 30 % del ingreso depende de un solo propietario. Evalúa diversificar la cartera.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
