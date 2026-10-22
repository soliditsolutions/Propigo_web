import { redirect }            from "next/navigation";
import { getSession }          from "@/lib/auth";
import { withTenant }          from "@/lib/tenant-db";
import { getActor, getUfCLP }  from "@/lib/queries";
import { getPlanEfectivo, getCupoPropiedades, getCupoUsuarios } from "@/lib/plans";
import { periodosDemo, diaFacturacionDemo } from "@/lib/billing-demo";
import { SetupDialog }         from "./setup-dialog";
import { PerfilForm }          from "./perfil-form";
import { DispositivosSection } from "./dispositivos-section";
import { MiPlanSection }       from "./mi-plan-section";
import { TabNav }              from "@/components/panel/tab-nav";
import { titulo } from "@/lib/marca";

export const metadata = { title: titulo("Mi perfil") };

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const actor = await getActor();
  const esManager = actor.rol === "manager";

  const usuario = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
    where:  { id: session.sub },
    select: {
      nombre:          true,
      email:           true,
      rut:             true,
      telefono:        true,
      fechaNacimiento: true,
      direccion:       true,
      ciudad:          true,
      region:          true,
      fotoPerfil:      true,
      perfilCompleto:  true,
    },
  }));

  if (!usuario) redirect("/login");

  const perfil = {
    nombre:          usuario.nombre,
    email:           usuario.email,
    rut:             usuario.rut,
    telefono:        usuario.telefono,
    fechaNacimiento: usuario.fechaNacimiento,
    direccion:       usuario.direccion,
    ciudad:          usuario.ciudad,
    region:          usuario.region,
    fotoPerfil:      usuario.fotoPerfil,
    perfilCompleto:  usuario.perfilCompleto,
  };

  const tabPedida = (sp.tab ?? "datos") as "datos" | "seguridad" | "dispositivos" | "plan";
  // "Mi Plan" es información de la cuenta (facturación) — mismo criterio que
  // Equipo/Estadísticas: exclusivo del Manager, un Colaborador que fuerce la
  // URL cae a la pestaña por defecto en vez de ver una sección rota.
  const tab = tabPedida === "plan" && !esManager ? "datos" : tabPedida;

  let datosPlan: {
    plan: ReturnType<typeof getPlanEfectivo>;
    usoPropiedades: number;
    maxPropiedades: number;
    usoUsuarios: number;
    maxUsuarios: number;
    valorUfClp: number;
    diaFacturacion: number;
    historial: Awaited<ReturnType<typeof periodosDemo>>;
  } | null = null;

  if (tab === "plan") {
    const plan = getPlanEfectivo(actor.tenant.plan);
    // Conteos reales, con RLS (van en su propia transacción). El valor de la
    // UF y los períodos de ejemplo NO van acá adentro: `getUfCLP` usa el
    // cliente `prisma` global, y llamarlo dentro del callback de withTenant
    // mientras corren las otras queries dispara el warning de pg "client
    // already executing a query" (ver la nota en getUfCLP/getUfCLPTx).
    const [usoPropiedades, usoUsuarios] = await withTenant(actor.tenantId, (tx) =>
      Promise.all([
        tx.propiedad.count({ where: { tenantId: actor.tenantId } }),
        tx.usuario.count({ where: { tenantId: actor.tenantId, desactivadoEn: null } }),
      ]),
    );
    const [valorUfClp, historial] = await Promise.all([
      getUfCLP(new Date()),
      periodosDemo(plan, 6, getUfCLP),
    ]);
    datosPlan = {
      plan, usoPropiedades, maxPropiedades: getCupoPropiedades(actor.tenant.plan),
      usoUsuarios, maxUsuarios: getCupoUsuarios(actor.tenant.plan),
      valorUfClp, diaFacturacion: diaFacturacionDemo(actor.tenant.createdAt), historial,
    };
  }

  return (
    <>
      {sp.setup === "1" && <SetupDialog />}

      <div className={`mx-auto px-4 py-8 sm:px-6 ${tab === "plan" ? "max-w-4xl" : "max-w-2xl"}`}>
        {/* Encabezado */}
        <div className="mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--pgo-text-1)" }}
          >
            Mi perfil
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>
            Configura tus datos personales y de seguridad.
          </p>
        </div>

        {/* ── Tab nav ───────────────────────────────────────────────────── */}
        <TabNav
          tabs={[
            { key: "datos",        label: "Datos personales" },
            { key: "seguridad",    label: "Seguridad" },
            { key: "dispositivos", label: "Dispositivos" },
            ...(esManager ? [{ key: "plan", label: "Mi Plan" }] : []),
          ]}
          activeTab={tab}
          baseHref="/panel/perfil"
        />

        {/* ── Contenido por tab ─────────────────────────────────────────── */}
        {(tab === "datos" || tab === "seguridad") && (
          <PerfilForm perfil={perfil} section={tab} />
        )}
        {tab === "dispositivos" && <DispositivosSection />}
        {tab === "plan" && datosPlan && (
          <MiPlanSection
            tenantNombre={actor.tenant.nombre}
            plan={datosPlan.plan}
            usoPropiedades={datosPlan.usoPropiedades}
            maxPropiedades={datosPlan.maxPropiedades}
            usoUsuarios={datosPlan.usoUsuarios}
            maxUsuarios={datosPlan.maxUsuarios}
            valorUfClp={datosPlan.valorUfClp}
            diaFacturacion={datosPlan.diaFacturacion}
            historial={datosPlan.historial}
          />
        )}
      </div>
    </>
  );
}
