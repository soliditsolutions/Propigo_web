import Link from "next/link";
import { Plus } from "lucide-react";
import { getActor, getContratos, propiedadIdsVisibles } from "@/lib/queries";
import { PageTitle } from "@/components/panel/ui";
import { ContratosClient } from "./contratos-client";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const actor = await getActor();
  const propiedadIds = await propiedadIdsVisibles(actor);
  const contratos = await getContratos(actor.tenantId, propiedadIds);

  return (
    <>
      <PageTitle
        title="Contratos"
        subtitle="Arriendos vigentes y su configuración."
        action={
          <Link
            href="/panel/contratos/nuevo"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--pgo-primary)" }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo contrato
          </Link>
        }
      />
      <ContratosClient contratos={contratos} />
    </>
  );
}
