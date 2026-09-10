"use client";

import { useState, useTransition } from "react";
import { Building2, Landmark, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { formatRut } from "@/lib/rut";
import { ETIQUETA_TIPO_CUENTA, TIPOS_CUENTA } from "@/lib/cuenta-bancaria";
import { guardarDatosCorredora, guardarCuentaCorredora, eliminarCuentaCorredora } from "./actions";

type Cuenta = {
  banco: string; tipo: string; numero: string;
  titular: string; rutTitular: string; email: string | null;
} | null;

const inputBase: React.CSSProperties = {
  height: "44px", width: "100%", borderRadius: "12px",
  border: "1px solid var(--hw-border-2)", background: "var(--hw-surface)",
  color: "var(--hw-text-1)", fontSize: "14px", padding: "0 14px",
  outline: "none", boxShadow: "var(--hw-input-shadow)",
  transition: "border-color 150ms ease, box-shadow 150ms ease",
};
const focusHandlers = {
  onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--hw-primary)";
    e.currentTarget.style.boxShadow = "var(--hw-input-shadow-focus)";
  },
  onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = "var(--hw-border-2)";
    e.currentTarget.style.boxShadow = "var(--hw-input-shadow)";
  },
};
const labelStyle: React.CSSProperties = { color: "var(--hw-text-2)" };

function Campo({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold" style={labelStyle}>{label}</label>
      {children}
      {hint && <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>{hint}</p>}
    </div>
  );
}

function Seccion({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl p-6 space-y-5"
      style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--hw-primary)" }}>{icon}</span>
        <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

export function CorredoraClient({
  datos,
  cuenta,
}: {
  datos: { nombre: string; rut: string; esPersonaJuridica: boolean; giro: string; direccion: string };
  cuenta: Cuenta;
}) {
  const { show: toast } = useToast();

  // ── Datos de facturación ──
  const [esPJ, setEsPJ] = useState(datos.esPersonaJuridica);
  const [giro, setGiro] = useState(datos.giro);
  const [direccion, setDireccion] = useState(datos.direccion);
  const [savingDatos, startDatos] = useTransition();

  function guardarDatos() {
    startDatos(async () => {
      const r = await guardarDatosCorredora({ esPersonaJuridica: esPJ, giro, direccion });
      toast(r.ok ? "Datos guardados." : r.error, r.ok ? "success" : "error");
    });
  }

  // ── Cuenta bancaria ──
  const [banco, setBanco] = useState(cuenta?.banco ?? "");
  const [tipo, setTipo] = useState(cuenta?.tipo ?? "corriente");
  const [numero, setNumero] = useState(cuenta?.numero ?? "");
  const [titular, setTitular] = useState(cuenta?.titular ?? "");
  const [rutTitular, setRutTitular] = useState(cuenta?.rutTitular ?? "");
  const [emailCuenta, setEmailCuenta] = useState(cuenta?.email ?? "");
  const [savingCuenta, startCuenta] = useTransition();
  const [borrando, startBorrar] = useTransition();

  function guardarCuenta() {
    startCuenta(async () => {
      const r = await guardarCuentaCorredora({ banco, tipo, numero, titular, rutTitular, email: emailCuenta });
      toast(r.ok ? "Cuenta bancaria guardada." : r.error, r.ok ? "success" : "error");
    });
  }

  function borrarCuenta() {
    startBorrar(async () => {
      const r = await eliminarCuentaCorredora();
      if (r.ok) {
        setBanco(""); setNumero(""); setTitular(""); setRutTitular(""); setEmailCuenta(""); setTipo("corriente");
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
          <Campo label="Razón social">
            <input type="text" value={datos.nombre} disabled
              style={{ ...inputBase, opacity: 0.6, cursor: "not-allowed" }} />
          </Campo>
          <Campo label="RUT" hint="Identifica la cuenta; no se puede cambiar aquí.">
            <input type="text" value={datos.rut ? formatRut(datos.rut) : ""} disabled
              style={{ ...inputBase, opacity: 0.6, cursor: "not-allowed" }} />
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
                background: esPJ === op.pj ? "var(--hw-primary-lt)" : "var(--hw-surface-2)",
                border: `1px solid ${esPJ === op.pj ? "var(--hw-primary-bd)" : "var(--hw-border-2)"}`,
              }}>
              <input type="radio" name="esPJ" checked={esPJ === op.pj}
                onChange={() => setEsPJ(op.pj)}
                className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: "var(--hw-primary)" }} />
              <span className="min-w-0">
                <span className="block text-sm" style={{ color: "var(--hw-text-1)" }}>{op.etiqueta}</span>
                <span className="block text-xs" style={{ color: "var(--hw-text-4)" }}>{op.detalle}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <Campo label="Giro" hint="Aparece en el encabezado de cada comprobante y liquidación.">
          <input type="text" value={giro} onChange={(e) => setGiro(e.target.value)}
            placeholder="Corretaje de propiedades" style={inputBase} {...focusHandlers} />
        </Campo>

        <Campo label="Domicilio comercial">
          <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)}
            placeholder="Av. Providencia 1234, oficina 501, Providencia" style={inputBase} {...focusHandlers} />
        </Campo>

        <button type="button" onClick={guardarDatos} disabled={savingDatos}
          className="hw-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
          style={{ background: savingDatos ? "var(--hw-text-4)" : "var(--hw-primary)" }}>
          {savingDatos && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Guardar datos
        </button>
      </Seccion>

      <Seccion icon={<Landmark className="h-4 w-4" aria-hidden />} titulo="Cuenta bancaria de la corredora">
        <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>
          Es la cuenta que se le indica al arrendatario en el recordatorio de pago. Dato
          sensible: no se muestra en el marketplace ni a terceros.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Banco">
            <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)}
              placeholder="Banco de Chile" style={inputBase} {...focusHandlers} />
          </Campo>
          <Campo label="Tipo de cuenta">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputBase} {...focusHandlers}>
              {TIPOS_CUENTA.map((t) => (
                <option key={t} value={t}>{ETIQUETA_TIPO_CUENTA[t] ?? t}</option>
              ))}
            </select>
          </Campo>
        </div>

        <Campo label="Número de cuenta">
          <input type="text" inputMode="numeric" value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/[^\d\s-]/g, ""))}
            placeholder="0012345678" style={inputBase} {...focusHandlers} />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Titular">
            <input type="text" value={titular} onChange={(e) => setTitular(e.target.value)}
              placeholder="Corredora del Sur SpA" style={inputBase} {...focusHandlers} />
          </Campo>
          <Campo label="RUT del titular">
            <input type="text" value={rutTitular} onChange={(e) => setRutTitular(e.target.value)}
              placeholder="76.123.456-0" style={inputBase} {...focusHandlers} />
          </Campo>
        </div>

        <Campo label="Correo para el comprobante (opcional)" hint="A dónde el arrendatario envía el comprobante de la transferencia.">
          <input type="email" value={emailCuenta} onChange={(e) => setEmailCuenta(e.target.value)}
            placeholder="pagos@tucorredora.cl" style={inputBase} {...focusHandlers} />
        </Campo>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={guardarCuenta} disabled={savingCuenta}
            className="hw-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ background: savingCuenta ? "var(--hw-text-4)" : "var(--hw-primary)" }}>
            {savingCuenta && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Guardar cuenta
          </button>
          {cuenta && (
            <button type="button" onClick={borrarCuenta} disabled={borrando}
              className="hw-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium"
              style={{ color: "var(--hw-danger-dk)" }}>
              {borrando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              Eliminar
            </button>
          )}
        </div>
      </Seccion>
    </div>
  );
}
