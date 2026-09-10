import { getActor } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { PageTitle } from "@/components/panel/ui";
import { CorredoraClient } from "./corredora-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Datos de la corredora — Housing" };

export default async function CorredoraPage() {
  // El proxy ya bloquea /panel/corredora para no-managers vía session.rol; este
  // getActor() es la defensa en profundidad.
  const actor = await getActor();

  const [tenant, cuenta] = await withTenant(actor.tenantId, async (tx) => {
    const t = await tx.tenant.findUnique({
      where: { id: actor.tenantId },
      select: { nombre: true, rut: true, esPersonaJuridica: true, giro: true, direccion: true },
    });
    const c = await tx.cuentaBancaria.findFirst({
      where: { tenantId: actor.tenantId, personaId: null },
      select: { banco: true, tipo: true, numero: true, titular: true, rutTitular: true, email: true },
    });
    return [t, c] as const;
  });

  return (
    <>
      <PageTitle
        title="Datos de la corredora"
        subtitle="La información que aparece en cada comprobante, liquidación y recordatorio que emites."
      />
      <CorredoraClient
        datos={{
          nombre:            tenant?.nombre ?? "",
          rut:               tenant?.rut ?? "",
          esPersonaJuridica: tenant?.esPersonaJuridica ?? true,
          giro:              tenant?.giro ?? "",
          direccion:         tenant?.direccion ?? "",
        }}
        cuenta={cuenta}
      />
    </>
  );
}
