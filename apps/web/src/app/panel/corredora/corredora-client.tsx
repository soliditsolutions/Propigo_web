"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Building2, Landmark, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatRut } from "@/lib/rut";
import { ETIQUETA_TIPO_CUENTA, TIPOS_CUENTA, erroresCuentaBancaria } from "@/lib/cuenta-bancaria";
import { guardarDatosCorredora, guardarCuentaCorredora, eliminarCuentaCorredora } from "./actions";
import { useAccionSegura } from "@/components/ui/use-accion-segura";

type Cuenta = {
  banco: string; tipo: string; numero: string;
  titular: string; rutTitular: string; email: string | null;
} | null;

type Errores = Record<string, string>;

const labelStyle: React.CSSProperties = { color: "var(--pgo-text-2)" };

/** Props de accesibilidad y estilo para un campo con (o sin) error. */
function propsCampo(id: string, error: string | undefined) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className: "pgo-campo",
  } as const;
}

function Campo({ id, label, children, hint, error }: {
  id: string; label: string; children: React.ReactNode; hint?: string; error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold" style={labelStyle}>{label}</label>
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs" style={{ color: "var(--pgo-danger)" }}>{error}</p>
      )}
      {hint && <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>{hint}</p>}
    </div>
  );
}

function Seccion({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-6 space-y-5"
      style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)", boxShadow: "var(--pgo-shadow-1)" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--pgo-primary)" }}>{icon}</span>
        <h2 className="text-base font-semibold" style={{ color: "var(--pgo-text-1)" }}>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

/** Lleva el foco al primer campo con error, en el orden del formulario. */
function enfocarPrimero(contenedor: HTMLElement | null) {
  contenedor?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

export function CorredoraClient({
  datos,
  cuenta,
}: {
  datos: { nombre: string; rut: string; esPersonaJuridica: boolean; giro: string; direccion: string };
  cuenta: Cuenta;
}) {
  const { show: toast } = useToast();
  const ejecutar = useAccionSegura();
  const uid = useId();
  const idDe = (campo: string) => `${uid}-${campo}`;

  // ── Datos de facturación ──
  const [esPJ, setEsPJ] = useState(datos.esPersonaJuridica);
  const [giro, setGiro] = useState(datos.giro);
  const [direccion, setDireccion] = useState(datos.direccion);
  const [erroresDatos, setErroresDatos] = useState<Errores>({});
  const [savingDatos, startDatos] = useTransition();
  const seccionDatos = useRef<HTMLDivElement>(null);

  function guardarDatos() {
    startDatos(async () => {
      const r = await ejecutar(() => guardarDatosCorredora({ esPersonaJuridica: esPJ, giro, direccion }));
      if (!r) return;
      if (r.ok) {
        setErroresDatos({});
        toast("Datos guardados.", "success");
      } else if (r.campos) {
        setErroresDatos(r.campos);
        requestAnimationFrame(() => enfocarPrimero(seccionDatos.current));
      } else {
        toast(r.error, "error");
      }
    });
  }

  // ── Cuenta bancaria ──
  const [banco, setBanco] = useState(cuenta?.banco ?? "");
  const [tipo, setTipo] = useState(cuenta?.tipo ?? "corriente");
  const [numero, setNumero] = useState(cuenta?.numero ?? "");
  const [titular, setTitular] = useState(cuenta?.titular ?? "");
  const [rutTitular, setRutTitular] = useState(cuenta?.rutTitular ?? "");
  const [emailCuenta, setEmailCuenta] = useState(cuenta?.email ?? "");
  const [erroresCuenta, setErroresCuenta] = useState<Errores>({});
  const [savingCuenta, startCuenta] = useTransition();
  const [borrando, startBorrar] = useTransition();
  const seccionCuenta = useRef<HTMLDivElement>(null);

  /** Al corregir un campo, su error deja de mostrarse: ya no describe lo escrito. */
  function limpiar(set: React.Dispatch<React.SetStateAction<Errores>>, campo: string) {
    set((prev) => {
      if (!(campo in prev)) return prev;
      const resto = { ...prev };
      delete resto[campo];
      return resto;
    });
  }

  function guardarCuenta() {
    const datosCuenta = { banco, tipo, numero, titular, rutTitular, email: emailCuenta };
    // Mismas reglas que el servidor: todos los errores de una vez, sin ida y vuelta.
    const locales = erroresCuentaBancaria(datosCuenta) as Errores;
    if (Object.keys(locales).length > 0) {
      setErroresCuenta(locales);
      requestAnimationFrame(() => enfocarPrimero(seccionCuenta.current));
      return;
    }
    startCuenta(async () => {
      const r = await ejecutar(() => guardarCuentaCorredora(datosCuenta));
      if (!r) return;
      if (r.ok) {
        setErroresCuenta({});
        toast("Cuenta bancaria guardada.", "success");
      } else if (r.campos) {
        setErroresCuenta(r.campos);
        requestAnimationFrame(() => enfocarPrimero(seccionCuenta.current));
      } else {
        toast(r.error, "error");
      }
    });
  }

  function borrarCuenta() {
    startBorrar(async () => {
      const r = await ejecutar(() => eliminarCuentaCorredora());
      if (!r) return;
      if (r.ok) {
        setBanco(""); setNumero(""); setTitular(""); setRutTitular(""); setEmailCuenta(""); setTipo("corriente");
        setErroresCuenta({});
        toast("Cuenta bancaria eliminada.", "success");
      } else {
        toast(r.error, "error");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Seccion icon={<Building2 className="h-4 w-4" aria-hidden />} titulo="Identificación y facturación">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id={idDe("razon")} label="Razón social">
            <input id={idDe("razon")} type="text" value={datos.nombre} disabled className="pgo-campo" />
          </Campo>
          <Campo id={idDe("rut")} label="RUT" hint="Identifica la cuenta; no se puede cambiar aquí.">
            <input id={idDe("rut")} type="text" value={datos.rut ? formatRut(datos.rut) : ""} disabled className="pgo-campo" />
          </Campo>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold" style={labelStyle}>¿Cómo opera la corredora?</legend>
          {[
            { pj: true, etiqueta: "Como empresa", detalle: "La comisión que emites lleva IVA." },
            { pj: false, etiqueta: "Como persona natural", detalle: "La comisión queda exenta de IVA (Art. 12° E N°8 LIVS)." },
          ].map((op) => (
            <label key={String(op.pj)} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
              style={{
                background: esPJ === op.pj ? "var(--pgo-primary-lt)" : "var(--pgo-surface-2)",
                border: `1px solid ${esPJ === op.pj ? "var(--pgo-primary-bd)" : "var(--pgo-border-2)"}`,
              }}>
              <input type="radio" name="esPJ" checked={esPJ === op.pj}
                onChange={() => setEsPJ(op.pj)}
                className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: "var(--pgo-primary)" }} />
              <span className="min-w-0">
                <span className="block text-sm" style={{ color: "var(--pgo-text-1)" }}>{op.etiqueta}</span>
                <span className="block text-xs" style={{ color: "var(--pgo-text-4)" }}>{op.detalle}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div ref={seccionDatos} className="space-y-5">
          <Campo id={idDe("giro")} label="Giro" hint="Aparece en el encabezado de cada comprobante y liquidación." error={erroresDatos.giro}>
            <input type="text" value={giro}
              onChange={(e) => { setGiro(e.target.value); limpiar(setErroresDatos, "giro"); }}
              placeholder="Corretaje de propiedades" {...propsCampo(idDe("giro"), erroresDatos.giro)} />
          </Campo>

          <Campo id={idDe("direccion")} label="Domicilio comercial" error={erroresDatos.direccion}>
            <input type="text" value={direccion}
              onChange={(e) => { setDireccion(e.target.value); limpiar(setErroresDatos, "direccion"); }}
              placeholder="Av. Providencia 1234, oficina 501, Providencia" {...propsCampo(idDe("direccion"), erroresDatos.direccion)} />
          </Campo>
        </div>

        <button type="button" onClick={guardarDatos} disabled={savingDatos}
          className="pgo-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: savingDatos ? "var(--pgo-text-4)" : "var(--pgo-primary)" }}>
          {savingDatos && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Guardar datos
        </button>
      </Seccion>

      <Seccion icon={<Landmark className="h-4 w-4" aria-hidden />} titulo="Cuenta bancaria de la corredora">
        <p className="text-sm" style={{ color: "var(--pgo-text-3)" }}>
          Es la cuenta que se le indica al arrendatario en el recordatorio de pago. Dato
          sensible: no se muestra en el marketplace ni a terceros.
        </p>

        <div ref={seccionCuenta} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id={idDe("banco")} label="Banco" error={erroresCuenta.banco}>
              <input type="text" value={banco}
                onChange={(e) => { setBanco(e.target.value); limpiar(setErroresCuenta, "banco"); }}
                placeholder="Banco de Chile" {...propsCampo(idDe("banco"), erroresCuenta.banco)} />
            </Campo>
            <Campo id={idDe("tipo")} label="Tipo de cuenta" error={erroresCuenta.tipo}>
              <select value={tipo}
                onChange={(e) => { setTipo(e.target.value); limpiar(setErroresCuenta, "tipo"); }}
                {...propsCampo(idDe("tipo"), erroresCuenta.tipo)}>
                {TIPOS_CUENTA.map((t) => (
                  <option key={t} value={t}>{ETIQUETA_TIPO_CUENTA[t] ?? t}</option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo id={idDe("numero")} label="Número de cuenta" error={erroresCuenta.numero}>
            <input type="text" inputMode="numeric" value={numero}
              onChange={(e) => { setNumero(e.target.value.replace(/[^\d\s-]/g, "")); limpiar(setErroresCuenta, "numero"); }}
              placeholder="0012345678" {...propsCampo(idDe("numero"), erroresCuenta.numero)} />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo id={idDe("titular")} label="Titular" error={erroresCuenta.titular}>
              <input type="text" value={titular}
                onChange={(e) => { setTitular(e.target.value); limpiar(setErroresCuenta, "titular"); }}
                placeholder="Corredora del Sur SpA" {...propsCampo(idDe("titular"), erroresCuenta.titular)} />
            </Campo>
            <Campo id={idDe("rutTitular")} label="RUT del titular" error={erroresCuenta.rutTitular}>
              <input type="text" value={rutTitular}
                onChange={(e) => { setRutTitular(e.target.value); limpiar(setErroresCuenta, "rutTitular"); }}
                placeholder="76.123.456-0" {...propsCampo(idDe("rutTitular"), erroresCuenta.rutTitular)} />
            </Campo>
          </div>

          <Campo id={idDe("email")} label="Correo para el comprobante (opcional)" hint="A dónde el arrendatario envía el comprobante de la transferencia." error={erroresCuenta.email}>
            <input type="email" value={emailCuenta}
              onChange={(e) => { setEmailCuenta(e.target.value); limpiar(setErroresCuenta, "email"); }}
              placeholder="pagos@tucorredora.cl" {...propsCampo(idDe("email"), erroresCuenta.email)} />
          </Campo>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={guardarCuenta} disabled={savingCuenta}
            className="pgo-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: savingCuenta ? "var(--pgo-text-4)" : "var(--pgo-primary)" }}>
            {savingCuenta && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Guardar cuenta
          </button>
          {cuenta && (
            <button type="button" onClick={borrarCuenta} disabled={borrando}
              className="pgo-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
              style={{ color: "var(--pgo-danger-dk)" }}>
              {borrando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              Eliminar
            </button>
          )}
        </div>
      </Seccion>
    </div>
  );
}
