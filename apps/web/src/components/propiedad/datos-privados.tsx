"use client";

import { useState } from "react";
import { Lock, Car, Package, Home, Eye, EyeOff } from "lucide-react";
import type { EntradaCuenta, EntradaRolComplementario } from "@/lib/propiedad-datos";
import { nombreCuenta, esCuentaObligatoria } from "@/lib/propiedad-datos";

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

/**
 * Sustituye el valor por puntos conservando el largo aproximado.
 *
 * Se mantiene el ancho para que al mostrar y volver a ocultar la lista no
 * cambie de tamaño; un bloque que salta delata tanto como el dato mismo.
 */
function tapado(valor: string): string {
  return "•".repeat(Math.min(Math.max(valor.length, 6), 14));
}

/**
 * Marca de que algo no se comparte con las partes del contrato.
 *
 * Solo la ve el corredor en el panel. Sin ella, el interruptor de visibilidad
 * sería a ciegas: habría que abrir el formulario de edición para saber qué se
 * está compartiendo y qué no.
 */
function ChipOculto() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: "var(--hw-surface-3, var(--hw-surface))", color: "var(--hw-text-4)", border: "1px solid var(--hw-border-2)" }}
      title="No se comparte en el portal del propietario ni del arrendatario"
    >
      <EyeOff className="h-2.5 w-2.5" aria-hidden="true" />
      Oculto
    </span>
  );
}

/** Un dato que se tapa cuando el bloque está oculto. */
function Dato({ valor, oculto, className, style }: {
  valor: string; oculto: boolean; className?: string; style?: React.CSSProperties;
}) {
  return (
    <span className={className} style={style}>
      {oculto ? tapado(valor) : valor}
    </span>
  );
}

export function DatosPrivadosPropiedad({
  rol,
  cuentas = [],
  complementos = [],
  /** El corredor ve a quién le toca pagar; a las partes eso ya se lo dice el contrato. */
  mostrarPagador = true,
  /** Quién puede ver esta información. Cambia según la superficie. */
  visibilidad = "Solo los ve tu equipo y las partes del contrato.",
  /**
   * Tapa los datos hasta que la persona los descubre con un botón.
   *
   * Se usa en el portal: alguien puede estar mirando la pantalla por encima del
   * hombro, y estos números identifican a personas. El panel no lo activa
   * porque ahí el corredor está trabajando sobre estos valores.
   */
  enmascarar = false,
  /**
   * Marca los datos que no se comparten en el portal. Se activa en el panel:
   * el corredor tiene que poder ver el efecto del interruptor sin entrar a
   * editar. El portal no lo usa porque ahí lo oculto directamente no llega.
   */
  marcarOcultos = false,
  /** Si el rol se comparte en el portal. Solo se usa junto a marcarOcultos. */
  rolCompartido,
}: {
  /** Null cuando el corredor decidió no compartirlo con las partes. */
  rol?: string | null;
  cuentas?: EntradaCuenta[];
  complementos?: EntradaRolComplementario[];
  mostrarPagador?: boolean;
  visibilidad?: string;
  enmascarar?: boolean;
  marcarOcultos?: boolean;
  rolCompartido?: boolean;
}) {
  const [visible, setVisible] = useState(!enmascarar);
  const oculto = enmascarar && !visible;

  const declaradas = cuentas.filter((c) => c.estado === "registrada");
  // Solo los cuatro básicos pueden estar en "no aplica": una cuenta adicional
  // que no aplica simplemente no se agrega.
  const noAplican  = cuentas.filter((c) => c.estado === "no_aplica" && esCuentaObligatoria(c.tipo));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--hw-text-4)" }}>
            <Lock className="h-3 w-3" aria-hidden="true" />
            Servicios y rol de avalúo
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--hw-text-4)" }}>
            {visibilidad}
          </p>
        </div>

        {enmascarar && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            className="hw-btn flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
            style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-2)", border: "1px solid var(--hw-border)" }}
          >
            {visible
              ? <><EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Ocultar</>
              : <><Eye    className="h-3.5 w-3.5" aria-hidden="true" /> Mostrar</>}
          </button>
        )}
      </div>

      {oculto && (
        <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
          Los datos están ocultos por si alguien más está mirando la pantalla.
        </p>
      )}

      {/* Rol de avalúo. Se omite entero si el corredor no lo comparte: no se
          anuncia que existe algo oculto, simplemente no está. */}
      {(rol || complementos.length > 0) && (
      <div className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)" }}>
        {rol && <>
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
            Rol de avalúo (SII)
            {marcarOcultos && rolCompartido === false && <ChipOculto />}
          </p>
          <Dato
            valor={rol} oculto={oculto}
            className="mt-0.5 block text-sm font-semibold hw-num"
            style={{ color: "var(--hw-text-1)" }}
          />
        </>}

        {complementos.length > 0 && (
          <ul className="mt-2 space-y-1 border-t pt-2" style={{ borderColor: "var(--hw-border)" }}>
            {complementos.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--hw-text-3)" }}>
                {ICONO_COMPLEMENTO[c.tipo]}
                <Dato valor={c.rol} oculto={oculto} className="hw-num font-semibold" style={{ color: "var(--hw-text-2)" }} />
                <span>{c.descripcion || ETIQUETA_COMPLEMENTO[c.tipo]}</span>
                {marcarOcultos && c.visibleEnPortal === false && <ChipOculto />}
              </li>
            ))}
          </ul>
        )}
      </div>
      )}

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
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--hw-text-1)" }}>
                    {nombreCuenta(c)}
                    {marcarOcultos && c.visibleEnPortal === false && <ChipOculto />}
                  </span>
                  <Dato valor={c.numero ?? ""} oculto={oculto} className="hw-num text-sm" style={{ color: "var(--hw-text-2)" }} />
                </div>
                <p className="mt-0.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
                  {[
                    c.empresa,
                    // El titular es el nombre de una persona: se tapa igual que
                    // los números, no es solo una etiqueta descriptiva.
                    c.titular ? `a nombre de ${oculto ? tapado(c.titular) : c.titular}` : null,
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
              ? `La propiedad no tiene ${nombreCuenta(noAplican[0]).toLowerCase()}.`
              : `La propiedad no tiene ${noAplican
                  .map((c) => nombreCuenta(c).toLowerCase())
                  .join(" ni ")}.`}
          </p>
        )}
      </div>
    </div>
  );
}
