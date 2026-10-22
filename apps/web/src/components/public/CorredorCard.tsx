import Link from "next/link";
import { Building2, BadgeCheck } from "lucide-react";
import { RatingStars } from "./RatingStars";
import { BorderGlow } from "@/components/ui/border-glow";

export interface CorredorDestacado {
  tenantId:  string;
  nombre:    string;
  promedio:  number;
  total:     number;
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Tarjeta de corredor destacado — avatar de iniciales (Tenant no tiene foto/
 * logo propio en el modelo actual), nombre, rating agregado y contacto. El
 * botón enlaza al marketplace filtrado por ese corredor en vez de abrir un
 * modal — así el mismo flujo de contacto ya construido (ContactoModal, atado
 * a una publicación) sigue siendo la única puerta de contacto real. */
export function CorredorCard({ corredor }: { corredor: CorredorDestacado }) {
  return (
    <BorderGlow radius={20} className="w-64 shrink-0">
    <div className="pgo-auth-card flex w-full flex-col items-center p-3 text-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: "var(--pf-brand-tint)", color: "var(--pf-brand)" }}
        aria-hidden="true"
      >
        {iniciales(corredor.nombre)}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--pf-navy)" }}>
        {corredor.nombre}
        <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pf-brand)" }} aria-label="Corredor verificado" />
      </p>
      <div className="mt-1">
        <RatingStars promedio={corredor.promedio} total={corredor.total} />
      </div>
      <Link
        href={`/marketplace?corredor=${corredor.tenantId}`}
        className="pf-btn-secondary mt-2 w-full"
        style={{ padding: "8px 16px", fontSize: "13px", borderRadius: "10px" }}
      >
        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
        Ver propiedades
      </Link>
    </div>
    </BorderGlow>
  );
}

