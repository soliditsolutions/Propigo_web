import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getActor, propiedadIdsVisibles } from "@/lib/queries";
import { withTenant } from "@/lib/tenant-db";
import { PageTitle } from "@/components/panel/ui";
import { NuevoContratoClient } from "./nuevo-contrato-client";

export const dynamic = "force-dynamic";

export default async function NuevoContratoPage() {
  const actor = await getActor();
  const propiedadIds = await propiedadIdsVisibles(actor);

  // Solo propiedades disponibles o reservadas (no arrendadas ni archivadas);
  // ADR-0013 (Fase D) — un Colaborador solo puede crear un contrato sobre una
  // propiedad que tiene asignada.
  const propiedadesRaw = await withTenant(actor.tenantId, (tx) => tx.propiedad.findMany({
    where: {
      tenantId: actor.tenantId,
      estado: { in: ["disponible", "reservada"] },
      ...(propiedadIds ? { id: { in: propiedadIds } } : {}),
    },
    include: {
      propietario: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: "asc" },
  }));

  const propiedades = propiedadesRaw.map((p) => ({
    id:                p.id,
    tipo:              p.tipo,
    estado:            p.estado,
    direccion:         p.direccion,
    comuna:            p.comuna,
    avaluoFiscal:      p.avaluoFiscal ? Number(p.avaluoFiscal) : null,
    propietarioId:     p.propietarioId,
    propietarioNombre: p.propietario.nombre,
  }));

  return (
    <>
      <div className="mb-4">
        <Link
          href="/panel/contratos"
          className="pgo-btn inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium"
          style={{ color: "var(--pgo-text-3)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Volver a contratos
        </Link>
      </div>
      <PageTitle
        title="Nuevo contrato"
        subtitle="Completa los 4 pasos para registrar un nuevo arriendo."
      />
      <NuevoContratoClient propiedades={propiedades} />
    </>
  );
}
