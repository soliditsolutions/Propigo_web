import { Lock, Car, Package, Home } from "lucide-react";
import type { EntradaCuenta, EntradaRolComplementario } from "@/lib/propiedad-datos";

/**
 * Rol de avalúo y cuentas de servicios de una propiedad.
 *
 * Se muestran al corredor en el panel y a las partes del contrato en el portal
 * (propietario y arrendatario). Nunca en el marketplace público: el rol
 * identifica el inmueble ante el SII y los números de cuenta identifican a
 * personas.
 *
 * Vive en un componente compartido a propósito. Si la forma de mostrarlos se
 * duplicara en panel y portal, tarde o temprano una copia mostraría un dato
 * que la otra decidió ocultar.
 */

const ETIQUETA_SERVICIO: Record<string, string> = {
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  gastos_comunes: "Gastos comunes",
  otro: "Otro",
};

const ICONO_COMPLEMENTO: Record<string, React.ReactNode> = {
  estacionamiento: <Car     className="h-3.5 w-3.5" aria-hidden="true" />,
  bodega:          <Package className="h-3.5 w-3.5" aria-hidden="true" />,
  otro:            <Home    className="h-3.5 w-3.5" aria-hidden="true" />,
};

const ETIQUETA_COMPLEMENTO: Record<string, string> = {
  estacionamiento: "Estacionamiento",
  bodega: "Bodega",
  otro: "Unidad adicional",
};

export function DatosPrivadosPropiedad({
  rol,
  cuentas = [],
  complementos = [],
  /** El corredor ve a quién le toca pagar; a las partes eso ya se lo dice el contrato. */
  mostrarPagador = true,
  /** Quién puede ver esta información. Cambia según la superficie. */
  visibilidad = "Solo los ve tu equipo y las partes del contrato.",
}: {
  rol: string;
  cuentas?: EntradaCuenta[];
  complementos?: EntradaRolComplementario[];
  mostrarPagador?: boolean;
  visibilidad?: string;
}) {
  const declaradas = cuentas.filter((c) => c.estado === "registrada");
  const noAplican  = cuentas.filter((c) => c.estado === "no_aplica");

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--hw-text-4)" }}>
          <Lock className="h-3 w-3" aria-hidden="true" />
          Servicios y rol de avalúo
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--hw-text-4)" }}>
          {visibilidad}
        </p>
      </div>

      {/* Rol de avalúo */}
      <div className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Rol de avalúo (SII)
        </p>
        <p className="mt-0.5 text-sm font-semibold hw-num" style={{ color: "var(--hw-text-1)" }}>{rol}</p>

        {complementos.length > 0 && (
          <ul className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: "var(--hw-border)" }}>
            {complementos.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--hw-text-3)" }}>
                {ICONO_COMPLEMENTO[c.tipo]}
                <span className="hw-num font-semibold" style={{ color: "var(--hw-text-2)" }}>{c.rol}</span>
                <span>{c.descripcion || ETIQUETA_COMPLEMENTO[c.tipo]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cuentas de servicios */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Cuentas de servicios
        </p>

        {declaradas.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Sin cuentas registradas.</p>
        ) : (
          <div className="space-y-2">
            {declaradas.map((c, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)" }}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--hw-text-1)" }}>
                    {ETIQUETA_SERVICIO[c.tipo] ?? c.tipo}
                  </span>
                  <span className="hw-num text-sm" style={{ color: "var(--hw-text-2)" }}>{c.numero}</span>
                </div>
                <p className="mt-0.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
                  {[
                    c.empresa,
                    c.titular ? `a nombre de ${c.titular}` : null,
                    mostrarPagador ? `paga el ${c.paga}` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Los "no aplica" se muestran, y no se omiten: que un servicio esté
            declarado como inexistente es información, y su ausencia se leería
            como un dato que falta cargar. */}
        {noAplican.length > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--hw-text-4)" }}>
            {noAplican.length === 1
              ? `La propiedad no tiene ${(ETIQUETA_SERVICIO[noAplican[0].tipo] ?? noAplican[0].tipo).toLowerCase()}.`
              : `La propiedad no tiene ${noAplican
                  .map((c) => (ETIQUETA_SERVICIO[c.tipo] ?? c.tipo).toLowerCase())
                  .join(" ni ")}.`}
          </p>
        )}
      </div>
    </div>
  );
}
