"use client";

import { useState, useTransition } from "react";
import { BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { DURACIONES } from "@/lib/notificacion-preferencias";
import { registrarBaja } from "./actions";

export function NoMolestarForm({
  token,
  nombre,
  corredora,
}: {
  token: string;
  nombre?: string;
  corredora?: string;
}) {
  const [duracion, setDuracion] = useState<string>("1m");
  const [motivo, setMotivo]     = useState("");
  const [error, setError]       = useState("");
  const [listo, setListo]       = useState<{ permanente: boolean; hasta: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar() {
    setError("");
    startTransition(async () => {
      const r = await registrarBaja(token, duracion, motivo);
      if (!r.ok) { setError(r.error); return; }
      setListo({ permanente: r.permanente, hasta: r.hasta });
    });
  }

  if (listo) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: "var(--hw-success)" }} aria-hidden="true" />
        <h1 className="text-xl font-bold" style={{ color: "var(--hw-text-1)" }}>Listo, no te escribimos más</h1>
        <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>
          {listo.permanente
            ? "Dejamos de enviarte avisos por correo de forma permanente."
            : `Dejamos de enviarte avisos hasta el ${new Date(listo.hasta!).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}.`}
        </p>
        <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
          Si cambias de opinión, puedes volver a activarlos cuando quieras desde tu portal de arrendatario.
          Esto no afecta tu contrato ni tus pagos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <BellOff className="mx-auto mb-2 h-9 w-9" style={{ color: "var(--hw-text-4)" }} aria-hidden="true" />
        <h1 className="text-xl font-bold" style={{ color: "var(--hw-text-1)" }}>
          Dejar de recibir avisos por correo
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--hw-text-3)" }}>
          {nombre ? `Hola ${nombre}. ` : ""}
          {corredora ? `Son los avisos que te envía ${corredora} a través de Housing.` : "Son los avisos que te enviamos por correo."}
        </p>
      </div>

      {/* Lo que la persona necesita saber ANTES de decidir, no después. */}
      <div className="rounded-xl p-3 text-xs" style={{ background: "var(--hw-warning-lt)", color: "var(--hw-warning-dk)", border: "1px solid var(--hw-warning-bd)" }}>
        Dejarás de recibir los recordatorios de vencimiento, los avisos de pago atrasado
        y los comprobantes. Tu contrato, tus pagos y tus plazos siguen exactamente igual —
        lo único que cambia es que no te llegarán por correo.
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold" style={{ color: "var(--hw-text-3)" }}>
          ¿Por cuánto tiempo?
        </legend>
        {DURACIONES.map((d) => (
          <label key={d.clave} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{
              background: duracion === d.clave ? "var(--hw-primary-lt)" : "var(--hw-surface-2)",
              border: `1px solid ${duracion === d.clave ? "var(--hw-primary-bd)" : "var(--hw-border-2)"}`,
            }}>
            <input
              type="radio" name="duracion" value={d.clave}
              checked={duracion === d.clave}
              onChange={() => setDuracion(d.clave)}
              className="h-4 w-4" style={{ accentColor: "var(--hw-primary)" }}
            />
            <span className="text-sm" style={{ color: "var(--hw-text-1)" }}>{d.etiqueta}</span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="motivo" className="mb-1 block text-xs font-semibold" style={{ color: "var(--hw-text-3)" }}>
          ¿Nos cuentas por qué? <span className="font-normal" style={{ color: "var(--hw-text-4)" }}>— opcional</span>
        </label>
        <textarea
          id="motivo" rows={3} maxLength={300}
          value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Recibo demasiados correos, prefiero revisar el portal…"
          className="hw-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm" style={{ color: "var(--hw-danger)" }}>{error}</p>}

      <button
        type="button" onClick={enviar} disabled={isPending}
        className="hw-btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Confirmar
      </button>
    </div>
  );
}
