"use client";

import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import {
  SERVICIOS_OBLIGATORIOS,
  type EntradaCuenta,
  type EntradaRolComplementario,
} from "@/lib/propiedad-datos";

const INPUT =
  "w-full rounded-xl border bg-[var(--hw-surface)] text-[var(--hw-text-1)] py-2 px-3 text-sm outline-none focus:border-[var(--hw-primary)] focus:ring-2 focus:ring-[var(--hw-primary-bd)]";
const BORDE = { borderColor: "var(--hw-border)", background: "var(--hw-surface)" };

const ETIQUETA: Record<string, string> = Object.fromEntries(
  SERVICIOS_OBLIGATORIOS.map((s) => [s.tipo, s.etiqueta]),
);

/**
 * Interruptor de visibilidad hacia el portal.
 *
 * El corredor siempre ve el dato; esto decide si lo comparte con el propietario
 * y el arrendatario. Se muestra el estado en palabras y no solo con un ícono:
 * un ojo tachado es ambiguo —¿está oculto, o hago clic para ocultarlo?—.
 */
function BotonVisibilidad({
  visible,
  onToggle,
  queEs,
}: {
  visible: boolean;
  onToggle: () => void;
  /** Qué se está mostrando u ocultando, para el lector de pantalla. */
  queEs: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={visible}
      aria-label={visible ? `Dejar de compartir ${queEs} en el portal` : `Compartir ${queEs} en el portal`}
      title={visible ? "Las partes del contrato lo ven en el portal" : "Oculto para las partes del contrato"}
      className="hw-btn flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
      style={{
        background: visible ? "var(--hw-surface-2)" : "transparent",
        color: visible ? "var(--hw-text-3)" : "var(--hw-text-4)",
        border: `1px solid ${visible ? "var(--hw-border)" : "var(--hw-border-2)"}`,
      }}
    >
      {visible
        ? <><Eye    className="h-3 w-3" aria-hidden="true" /> Visible</>
        : <><EyeOff className="h-3 w-3" aria-hidden="true" /> Oculto</>}
    </button>
  );
}

/**
 * Cuentas de servicios de la propiedad.
 *
 * Los cuatro servicios básicos aparecen SIEMPRE, y no como una lista que el
 * corredor va agregando: son obligatorios (G-02), y una lista vacía invita a
 * saltárselos. Lo que sí puede hacer es marcar "no aplica" — que es la
 * respuesta correcta para una casa sin gas de red, y distinta de dejarlo en
 * blanco.
 *
 * Aparte de esos cuatro puede agregar las que quiera (internet, alarma, TV
 * cable). Esas sí se quitan, porque no hay ninguna que toda propiedad deba
 * tener.
 */
export function CuentasServicioFields({
  cuentas,
  onChange,
}: {
  cuentas: EntradaCuenta[];
  onChange: (c: EntradaCuenta[]) => void;
}) {
  /** Índices reales dentro del arreglo, para no perderlos al separar la lista. */
  const basicas = SERVICIOS_OBLIGATORIOS
    .map((s) => ({ s, i: cuentas.findIndex((c) => c.tipo === s.tipo) }))
    .filter(({ i }) => i >= 0);
  const adicionales = cuentas
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !SERVICIOS_OBLIGATORIOS.some((s) => s.tipo === c.tipo));

  function patch(i: number, cambio: Partial<EntradaCuenta>) {
    onChange(cuentas.map((c, idx) => (idx === i ? { ...c, ...cambio } : c)));
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
        Cuentas de servicios *
      </p>
      <p className="mb-3 text-xs" style={{ color: "var(--hw-text-4)" }}>
        Si la propiedad no tiene alguno de estos servicios, márcalo como “no aplica”.
        Marca como oculta la cuenta que no quieras compartir en el portal.
      </p>

      <div className="space-y-3">
        {basicas.map(({ s, i }) => {
          const c = cuentas[i];
          const noAplica = c.estado === "no_aplica";

          return (
            <div
              key={s.tipo}
              className="rounded-xl p-3"
              style={{ background: "var(--hw-surface-2)", border: "1px solid var(--hw-border-2)" }}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold" style={{ color: "var(--hw-text-1)" }}>
                  {ETIQUETA[s.tipo]}
                </span>
                <div className="flex items-center gap-2">
                  {/* Un servicio que no aplica no tiene nada que compartir, así
                      que el interruptor desaparece en vez de quedar inerte. */}
                  {!noAplica && (
                    <BotonVisibilidad
                      visible={c.visibleEnPortal !== false}
                      onToggle={() => patch(i, { visibleEnPortal: c.visibleEnPortal === false })}
                      queEs={`la cuenta de ${ETIQUETA[s.tipo].toLowerCase()}`}
                    />
                  )}
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs" style={{ color: "var(--hw-text-3)" }}>
                    <input
                      type="checkbox"
                      checked={noAplica}
                      onChange={(e) =>
                        patch(i, {
                          estado: e.target.checked ? "no_aplica" : "registrada",
                          ...(e.target.checked ? { numero: "", empresa: "", titular: "" } : {}),
                        })
                      }
                      className="h-3.5 w-3.5"
                      style={{ accentColor: "var(--hw-primary)" }}
                    />
                    No aplica
                  </label>
                </div>
              </div>

              {/* Los campos desaparecen al marcar "no aplica": dejarlos visibles
                  y deshabilitados sugiere que falta algo por llenar. */}
              {!noAplica && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text" value={c.numero ?? ""}
                    onChange={(e) => patch(i, { numero: e.target.value })}
                    placeholder="N° de cuenta o cliente"
                    aria-label={`N° de cuenta de ${ETIQUETA[s.tipo]}`}
                    className={INPUT} style={BORDE}
                  />
                  <input
                    type="text" value={c.empresa ?? ""}
                    onChange={(e) => patch(i, { empresa: e.target.value })}
                    placeholder="Empresa"
                    aria-label={`Empresa de ${ETIQUETA[s.tipo]}`}
                    className={INPUT} style={BORDE}
                  />
                  <input
                    type="text" value={c.titular ?? ""}
                    onChange={(e) => patch(i, { titular: e.target.value })}
                    placeholder="Titular de la cuenta"
                    aria-label={`Titular de la cuenta de ${ETIQUETA[s.tipo]}`}
                    className={INPUT} style={BORDE}
                  />
                  <select
                    value={c.paga}
                    onChange={(e) => patch(i, { paga: e.target.value as EntradaCuenta["paga"] })}
                    className={INPUT} style={BORDE}
                    aria-label={`Quién paga ${ETIQUETA[s.tipo]}`}
                  >
                    <option value="arrendatario">Paga el arrendatario</option>
                    <option value="propietario">Paga el propietario</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cuentas adicionales ─────────────────────────────────────────── */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
            Otras cuentas
          </p>
          <button
            type="button"
            onClick={() => onChange([...cuentas, {
              tipo: "otro", estado: "registrada", etiqueta: "",
              numero: "", empresa: "", titular: "", paga: "arrendatario",
            }])}
            className="hw-btn flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
            style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-2)" }}
          >
            <Plus className="h-3 w-3" aria-hidden="true" /> Agregar
          </button>
        </div>
        <p className="mb-2 text-xs" style={{ color: "var(--hw-text-4)" }}>
          Internet, alarma, TV cable o cualquier otra que la propiedad tenga contratada.
        </p>

        {adicionales.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
            Sin cuentas adicionales.
          </p>
        ) : (
          <div className="space-y-3">
            {adicionales.map(({ c, i }, orden) => (
              <div
                key={i}
                className="rounded-xl p-3"
                style={{ background: "var(--hw-surface-2)", border: "1px solid var(--hw-border-2)" }}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="text" value={c.etiqueta ?? ""}
                    onChange={(e) => patch(i, { etiqueta: e.target.value })}
                    placeholder="Internet"
                    aria-label={`Nombre de la cuenta adicional ${orden + 1}`}
                    className={INPUT + " sm:max-w-[220px]"} style={BORDE}
                  />
                  <div className="flex items-center gap-2">
                    <BotonVisibilidad
                      visible={c.visibleEnPortal !== false}
                      onToggle={() => patch(i, { visibleEnPortal: c.visibleEnPortal === false })}
                      queEs={c.etiqueta?.trim() || `la cuenta adicional ${orden + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => onChange(cuentas.filter((_, idx) => idx !== i))}
                      aria-label={`Quitar la cuenta ${c.etiqueta?.trim() || `adicional ${orden + 1}`}`}
                      className="hw-btn shrink-0 rounded-lg p-1.5"
                      style={{ color: "var(--hw-text-4)" }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    type="text" value={c.numero ?? ""}
                    onChange={(e) => patch(i, { numero: e.target.value })}
                    placeholder="N° de cuenta o cliente"
                    aria-label={`N° de la cuenta adicional ${orden + 1}`}
                    className={INPUT} style={BORDE}
                  />
                  <input
                    type="text" value={c.empresa ?? ""}
                    onChange={(e) => patch(i, { empresa: e.target.value })}
                    placeholder="Empresa"
                    aria-label={`Empresa de la cuenta adicional ${orden + 1}`}
                    className={INPUT} style={BORDE}
                  />
                  <input
                    type="text" value={c.titular ?? ""}
                    onChange={(e) => patch(i, { titular: e.target.value })}
                    placeholder="Titular de la cuenta"
                    aria-label={`Titular de la cuenta adicional ${orden + 1}`}
                    className={INPUT} style={BORDE}
                  />
                  <select
                    value={c.paga}
                    onChange={(e) => patch(i, { paga: e.target.value as EntradaCuenta["paga"] })}
                    className={INPUT} style={BORDE}
                    aria-label={`Quién paga la cuenta adicional ${orden + 1}`}
                  >
                    <option value="arrendatario">Paga el arrendatario</option>
                    <option value="propietario">Paga el propietario</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TIPOS_COMPLEMENTO: { valor: EntradaRolComplementario["tipo"]; etiqueta: string }[] = [
  { valor: "estacionamiento", etiqueta: "Estacionamiento" },
  { valor: "bodega",          etiqueta: "Bodega" },
  { valor: "otro",            etiqueta: "Otra unidad" },
];

/**
 * Roles de unidades accesorias (G-06).
 *
 * A diferencia de las cuentas, acá SÍ se parte de una lista vacía: la mayoría
 * de las casas no tiene ninguno, y mostrar campos vacíos por defecto sugeriría
 * que falta llenarlos.
 */
export function RolesComplementariosFields({
  roles,
  onChange,
}: {
  roles: EntradaRolComplementario[];
  onChange: (r: EntradaRolComplementario[]) => void;
}) {
  function patch(i: number, cambio: Partial<EntradaRolComplementario>) {
    onChange(roles.map((r, idx) => (idx === i ? { ...r, ...cambio } : r)));
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Estacionamiento o bodega
        </p>
        <button
          type="button"
          onClick={() => onChange([...roles, { tipo: "estacionamiento", rol: "", descripcion: "" }])}
          className="hw-btn flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
          style={{ background: "var(--hw-surface-2)", color: "var(--hw-text-2)" }}
        >
          <Plus className="h-3 w-3" aria-hidden="true" /> Agregar
        </button>
      </div>
      <p className="mb-2 text-xs" style={{ color: "var(--hw-text-4)" }}>
        En edificios cada unidad tiene su propio rol. Es opcional.
      </p>

      {roles.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
          Sin unidades adicionales.
        </p>
      ) : (
        <div className="space-y-2">
          {roles.map((r, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2">
              <select
                value={r.tipo}
                onChange={(e) => patch(i, { tipo: e.target.value as EntradaRolComplementario["tipo"] })}
                className={INPUT + " sm:w-44"} style={BORDE}
                aria-label={`Tipo de la unidad ${i + 1}`}
              >
                {TIPOS_COMPLEMENTO.map((t) => (
                  <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
                ))}
              </select>
              <input
                type="text" value={r.rol}
                onChange={(e) => patch(i, { rol: e.target.value })}
                placeholder="871-143"
                className={INPUT + " sm:w-32"} style={BORDE}
                aria-label={`Rol de la unidad ${i + 1}`}
              />
              <input
                type="text" value={r.descripcion ?? ""}
                onChange={(e) => patch(i, { descripcion: e.target.value })}
                placeholder="Estacionamiento 43"
                className={INPUT + " min-w-[8rem] flex-1"} style={BORDE}
                aria-label={`Descripción de la unidad ${i + 1}`}
              />
              <BotonVisibilidad
                visible={r.visibleEnPortal !== false}
                onToggle={() => patch(i, { visibleEnPortal: r.visibleEnPortal === false })}
                queEs={`el rol de la unidad ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => onChange(roles.filter((_, idx) => idx !== i))}
                aria-label={`Quitar unidad ${i + 1}`}
                className="hw-btn shrink-0 rounded-lg p-2"
                style={{ color: "var(--hw-text-4)" }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Interruptor de visibilidad del rol principal, junto a su campo. */
export function VisibilidadRolPrincipal({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  return <BotonVisibilidad visible={visible} onToggle={onToggle} queEs="el rol de avalúo" />;
}
