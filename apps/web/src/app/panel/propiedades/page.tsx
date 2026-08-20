import { getActor, getPropiedades, getColaboradoresActivos, propiedadIdsVisibles, getCupoPropiedadesInfo } from "@/lib/queries";
import { PageTitle } from "@/components/panel/ui";
import { PropiedadesClient } from "./propiedades-client";

export const dynamic = "force-dynamic";

export default async function PropiedadesPage() {
  const actor = await getActor();
  const esManager = actor.rol === "manager";
  const propiedadIds = await propiedadIdsVisibles(actor);
  const [propiedades, colaboradores, cupo] = await Promise.all([
    getPropiedades(actor.tenantId, propiedadIds),
    // ROL-UI-5 (ADR-0013): el selector de colaborador es exclusivo del Manager
    // — ni siquiera se cargan los datos para un Colaborador.
    esManager ? getColaboradoresActivos(actor.tenantId) : Promise.resolve([]),
    // El cupo se muestra solo al Manager porque solo él crea propiedades
    // (Fase D): a un Colaborador el número no le sirve para decidir nada.
    esManager ? getCupoPropiedadesInfo(actor.tenantId, actor.tenant.plan) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageTitle
        title="Propiedades"
        subtitle="Inventario de la corredora. Abre cualquier propiedad para ver su detalle."
      />
      <PropiedadesClient propiedades={propiedades} esManager={esManager} colaboradores={colaboradores} cupo={cupo} />
    </>
  );
}
