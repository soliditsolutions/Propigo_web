"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { DERECHOS, type ClaveDerecho } from "@/lib/derechos";
import { solicitarDerechoAction } from "./actions";
import { useAccionSegura } from "@/components/ui/use-accion-segura";

const FECHA = new Intl.DateTimeFormat("es-CL", { dateStyle: "long" });

export function DerechosForm({ plazoDias, correo }: { plazoDias: number; correo: string }) {
  const [derecho, setDerecho] = useState<ClaveDerecho | "">("");
  const [nombre, setNombre]   = useState("");
  const [rut, setRut]         = useState("");
  const [email, setEmail]     = useState("");
  const [detalle, setDetalle] = useState("");
  const [acepta, setAcepta]   = useState(false);
  const [error, setError]     = useState("");
  const [listo, setListo]     = useState<{ folio: string; venceAt: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const ejecutar = useAccionSegura();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const r = await ejecutar(() => solicitarDerechoAction({ derecho, nombre, rut, email, detalle, acepta }));
      if (!r) return; // ya se avisó el fallo de red o de sesión
      if (!r.ok) { setError(r.error); return; }
      setListo({ folio: r.folio, venceAt: r.venceAt });
    });
  }

  if (listo) {
    return (
      <div className="space-y-3 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
        <h1 className="text-xl font-bold" style={{ color: "var(--pgo-text-1)" }}>Recibimos tu solicitud</h1>
        <p className="text-sm" style={{ color: "var(--pgo-text-3)" }}>Guarda este número:</p>
        <p className="font-mono text-2xl font-bold tracking-wider" style={{ color: "var(--pgo-primary)" }}>{listo.folio}</p>
        <p className="text-sm" style={{ color: "var(--pgo-text-3)" }}>
          Te responderemos a más tardar el <strong>{FECHA.format(new Date(listo.venceAt))}</strong>. Te enviamos
          el mismo número a <strong>{email}</strong>. Antes de entregar o modificar datos verificaremos tu identidad.
        </p>
      </div>
    );
  }

  const campo = "pgo-input w-full rounded-lg px-3 py-2 text-sm";
  const etiqueta = "mb-1 block text-xs font-semibold";

  return (
    <form onSubmit={enviar} className="space-y-5" noValidate>
      <div className="text-center">
        <ShieldCheck className="mx-auto mb-2 h-9 w-9" style={{ color: "var(--pgo-primary)" }} aria-hidden="true" />
        <h1 className="text-xl font-bold" style={{ color: "var(--pgo-text-1)" }}>Ejercer mis derechos sobre mis datos</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>
          Te respondemos en un máximo de {plazoDias} días corridos. También puedes escribir a{" "}
          <a href={`mailto:${correo}`} className="underline">{correo}</a>.
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className={etiqueta} style={{ color: "var(--pgo-text-3)" }}>¿Qué quieres hacer?</legend>
        {DERECHOS.map((d) => (
          <label key={d.clave} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
            style={{
              background: derecho === d.clave ? "var(--pgo-primary-lt)" : "var(--pgo-surface-2)",
              border: `1px solid ${derecho === d.clave ? "var(--pgo-primary-bd)" : "var(--pgo-border-2)"}`,
            }}>
            <input type="radio" name="derecho" value={d.clave} checked={derecho === d.clave}
              onChange={() => setDerecho(d.clave)} className="mt-0.5 h-4 w-4 shrink-0"
              style={{ accentColor: "var(--pgo-primary)" }} />
            <span className="min-w-0">
              <span className="block text-sm" style={{ color: "var(--pgo-text-1)" }}>{d.etiqueta}</span>
              <span className="block text-xs" style={{ color: "var(--pgo-text-4)" }}>{d.ayuda}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="d-nombre" className={etiqueta} style={{ color: "var(--pgo-text-3)" }}>Nombre completo</label>
        <input id="d-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" maxLength={120} className={campo} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="d-rut" className={etiqueta} style={{ color: "var(--pgo-text-3)" }}>RUT</label>
          <input id="d-rut" value={rut} onChange={(e) => setRut(e.target.value)} placeholder="12.345.678-9" inputMode="text" className={campo} />
        </div>
        <div>
          <label htmlFor="d-email" className={etiqueta} style={{ color: "var(--pgo-text-3)" }}>Correo de contacto</label>
          <input id="d-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={120} className={campo} />
        </div>
      </div>
      <div>
        <label htmlFor="d-detalle" className={etiqueta} style={{ color: "var(--pgo-text-3)" }}>
          Detalle <span className="font-normal" style={{ color: "var(--pgo-text-4)" }}>— opcional</span>
        </label>
        <textarea id="d-detalle" rows={4} maxLength={2000} value={detalle} onChange={(e) => setDetalle(e.target.value)}
          placeholder="Cuéntanos qué datos o qué corredora te interesan."
          className={campo} />
      </div>

      {/* Sin premarcar: el consentimiento tiene que ser un acto expreso (Ley 21.719). */}
      <label className="flex cursor-pointer items-start gap-2.5 text-xs" style={{ color: "var(--pgo-text-3)" }}>
        <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: "var(--pgo-primary)" }} />
        <span>Autorizo el uso de estos datos únicamente para verificar mi identidad y atender esta solicitud.</span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl p-3 text-sm"
          style={{ background: "var(--pgo-danger-lt)", color: "var(--pgo-danger-dk)", border: "1px solid var(--pgo-danger-bd)" }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={isPending}
        className="pgo-btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Enviar solicitud
      </button>
    </form>
  );
}
