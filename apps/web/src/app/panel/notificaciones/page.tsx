import { getActor, getNotificaciones, propiedadIdsVisibles } from "@/lib/queries";
import { tieneEmailReal } from "@/lib/email";
import { PageTitle } from "@/components/panel/ui";
import { NotificacionesClient } from "./notificaciones-client";
import { AlertasSection } from "./alertas-section";
import { listarAlertas } from "./alertas-actions";
import { withTenant } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export default async function NotificacionesPage() {
  const actor = await getActor();
  const propiedadIds = await propiedadIdsVisibles(actor);
  const notificaciones = await getNotificaciones(actor.tenantId, propiedadIds);
  const alertas = await listarAlertas();

  // Contratos sobre los que se puede enviar una alerta. Respeta la visibilidad
  // del actor (ADR-0013): un Colaborador solo ve los de sus propiedades.
  const contratos = await withTenant(actor.tenantId, (tx) => tx.contrato.findMany({
    where: {
      tenantId: actor.tenantId,
      estado: "vigente",
      ...(propiedadIds ? { propiedadId: { in: propiedadIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      propiedad:    { select: { direccion: true } },
      arrendatario: { select: { nombre: true } },
    },
  }));

  return (
    <>
      <PageTitle
        title="Notificaciones"
        subtitle="Recordatorios y avisos automáticos enviados a arrendatarios y propietarios."
      />
      <div className="mb-6">
        <AlertasSection
          alertas={alertas.map((a) => ({ ...a, creadaPor: a.creadaPor ?? { nombre: "—" } }))}
          contratos={contratos.map((c) => ({
            id: c.id,
            etiqueta: `${c.propiedad.direccion} — ${c.arrendatario.nombre}`,
          }))}
          esManager={actor.rol === "manager"}
        />
      </div>

      <NotificacionesClient
        notificaciones={notificaciones}
        emailRealActivo={tieneEmailReal()}
      />
    </>
  );
}
