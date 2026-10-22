import { getActor } from "@/lib/queries";
import { getEquipo, getInvitacionesPendientes, getCupoInfo } from "./actions";
import { PageTitle } from "@/components/panel/ui";
import { EquipoClient } from "./equipo-client";

export const dynamic = "force-dynamic";

export default async function EquipoPage() {
  // El proxy ya bloquea /panel/equipo para no-managers vía session.rol; este
  // getActor() (también dentro de cada consulta de abajo) es la defensa en
  // profundidad: redirige antes de lanzar las tres en paralelo.
  await getActor();

  const [colaboradores, invitaciones, cupo] = await Promise.all([
    getEquipo(),
    getInvitacionesPendientes(),
    getCupoInfo(),
  ]);

  return (
    <>
      <PageTitle
        title="Equipo"
        subtitle="Invita colaboradores y gestiona quién tiene acceso a tu cuenta."
      />
      <EquipoClient
        colaboradores={colaboradores.map((c) => ({
          id:                     c.id,
          nombre:                 c.nombre,
          email:                  c.email,
          desactivado:            c.desactivadoEn !== null,
          propiedadesAsignadas:   c._count.propiedadesAsignadas,
        }))}
        invitaciones={invitaciones.map((i) => ({
          id:        i.id,
          nombre:    i.nombre,
          email:     i.email,
          expiresAt: i.expiresAt.toISOString(),
        }))}
        cupo={cupo}
      />
    </>
  );
}
