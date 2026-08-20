import { redirect } from "next/navigation";
import { getActor } from "@/lib/queries";
import { PageTitle } from "@/components/panel/ui";
import { TabNav } from "@/components/panel/tab-nav";
import { getAnalyticsTier, tierIndex, TIER_LABEL, TIER_MIN_PLAN_LABEL, type AnalyticsTier } from "@/lib/plan-tier";
import { Lock } from "lucide-react";
import { ResumenOperativoTab } from "./resumen-operativo-tab";
import { AnaliticaFinancieraTab } from "./analitica-financiera-tab";
import { RendimientoPropiedadesTab } from "./rendimiento-propiedades-tab";
import { ProyeccionesRiesgoTab } from "./proyecciones-riesgo-tab";

export const dynamic = "force-dynamic";

type TabKey = "resumen" | "financiera" | "rendimiento" | "proyecciones";

const TAB_TIER: Record<TabKey, AnalyticsTier> = {
  resumen: "basica",
  financiera: "media",
  rendimiento: "avanzada",
  proyecciones: "avanzada",
};

function LockedTab({ tab }: { tab: AnalyticsTier }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-20 text-center"
      style={{ borderColor: "var(--hw-border-2)", background: "var(--hw-surface)" }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-4)" }}
      >
        <Lock className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold" style={{ color: "var(--hw-text-1)" }}>
          Analítica {TIER_LABEL[tab].toLowerCase()} bloqueada
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--hw-text-4)" }}>
          Disponible desde el plan {TIER_MIN_PLAN_LABEL[tab]}.
        </p>
      </div>
    </div>
  );
}

export default async function EstadisticasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await getActor();
  // ADR-0013 (Fase D) — Estadísticas es exclusiva del Manager (defensa en
  // profundidad; el proxy ya la rechaza para un Colaborador que entre por URL).
  if (actor.rol !== "manager") redirect("/panel");
  const tenant = actor.tenant;
  const tier = getAnalyticsTier(tenant.plan);
  const tab = (((await searchParams).tab) ?? "resumen") as TabKey;
  const validTab: TabKey = tab in TAB_TIER ? tab : "resumen";
  const desbloqueado = tierIndex(tier) >= tierIndex(TAB_TIER[validTab]);

  return (
    <>
      <PageTitle
        title="Estadísticas"
        subtitle="Analítica de tu cartera con datos reales, organizada en pestañas para no saturar la pantalla."
      />

      <TabNav
        ariaLabel="Secciones de estadísticas"
        baseHref="/panel/estadisticas"
        activeTab={validTab}
        tabs={[
          { key: "resumen", label: "Resumen operativo" },
          { key: "financiera", label: "Analítica financiera" },
          { key: "rendimiento", label: "Rendimiento de propiedades" },
          { key: "proyecciones", label: "Proyecciones y riesgo" },
        ]}
      />

      {!desbloqueado ? (
        <LockedTab tab={TAB_TIER[validTab]} />
      ) : validTab === "resumen" ? (
        <ResumenOperativoTab tenantId={tenant.id} />
      ) : validTab === "financiera" ? (
        <AnaliticaFinancieraTab tenantId={tenant.id} />
      ) : validTab === "rendimiento" ? (
        <RendimientoPropiedadesTab tenantId={tenant.id} />
      ) : (
        <ProyeccionesRiesgoTab tenantId={tenant.id} tenantPlan={tenant.plan} />
      )}
    </>
  );
}
