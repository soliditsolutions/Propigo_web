import Link from "next/link";
import { getTenant, getResumen } from "@/lib/queries";
import { Card, StatCard, Badge, estadoTone, estadoPulse, PageTitle } from "@/components/panel/ui";
import { AnimatedNumber } from "@/components/panel/animated-number";
import { cantidad, plural } from "@/lib/format";
import { AlertTriangle, Banknote, FileText, ArrowLeftRight, ArrowRight } from "lucide-react";
import { ProximosClient } from "./proximos-client";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const tenant = await getTenant();
  const r = await getResumen(tenant.id);

  return (
    <>
      <div className="hw-aurora-bg">
        <PageTitle
          title="Resumen"
          subtitle="Estado de cobros y cartera de la corredora."
        />
      </div>

      {/* ── KPIs ─────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Por cobrar"
          value={<AnimatedNumber value={r.deudaTotal} format="clp" />}
          sub={`${cantidad(r.periodosAtrasados, "período", "períodos")} ${plural(r.periodosAtrasados, "atrasado", "atrasados")}`}
          tone={r.periodosAtrasados > 0 ? "red" : "slate"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="En recaudación"
          value={<AnimatedNumber value={r.billeteraTotal} format="clp" />}
          sub="Listo para liquidar"
          tone="blue"
          icon={<Banknote className="h-4 w-4" />}
        />
        <StatCard
          label="Contratos vigentes"
          value={<AnimatedNumber value={r.contratosVigentes} format="int" />}
          sub={cantidad(r.propiedades.total, "propiedad", "propiedades")}
          tone="green"
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Gasto común"
          value={<AnimatedNumber value={r.gcRecaudado} format="clp" />}
          sub="Se traspasa completo, no es ingreso"
          tone="slate"
          icon={<ArrowLeftRight className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* ── Vencimientos con búsqueda/filtros ─────────── */}
        <div className="lg:col-span-2 min-w-0 overflow-x-hidden">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--hw-text-1)" }}>Próximos vencimientos</h2>
            <Link
              href="/panel/cobros"
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-70"
              style={{ color: "var(--hw-primary)" }}
            >
              Ir a cobros <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ProximosClient periodos={r.proximos} />
        </div>

        {/* ── Propiedades por estado ─────────────────────── */}
        <Card className="p-5 self-start">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: "var(--hw-text-1)" }}>Propiedades</h2>
            <Link
              href="/panel/propiedades"
              className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-70"
              style={{ color: "var(--hw-primary)" }}
            >
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {(["borrador", "disponible", "reservada", "arrendada"] as const).map((e) => (
              <div key={e} className="flex items-center justify-between py-1">
                <Badge tone={estadoTone(e)} pulse={estadoPulse(e)}>{e}</Badge>
                <span className="text-xl font-bold" style={{ color: "var(--hw-text-1)" }}>{r.propiedades[e] ?? 0}</span>
              </div>
            ))}
            <div
              className="flex items-center justify-between pt-3"
              style={{ borderTop: "1px solid var(--hw-border)" }}
            >
              <span className="text-sm font-medium" style={{ color: "var(--hw-text-3)" }}>Total</span>
              <span className="text-xl font-bold" style={{ color: "var(--hw-text-1)" }}>{r.propiedades.total}</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
