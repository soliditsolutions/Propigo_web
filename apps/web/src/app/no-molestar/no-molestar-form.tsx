"use client";

import { useState, useTransition } from "react";
import { BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { DURACIONES, ALCANCES } from "@/lib/notificacion-preferencias";
import { registrarBaja } from "./actions";
import { MARCA } from "@/lib/marca";

export function NoMolestarForm({
  token,
  nombre,
  corredora,
}: {
  token: string;
  nombre?: string;
  corredora?: string;
}) {
  // Por defecto, el alcance que no puede perjudicar a nadie.
  const [alcance, setAlcance]   = useState<string>("solo_opcionales");
  const [duracion, setDuracion] = useState<string>("1m");
  const [motivo, setMotivo]     = useState("");
  const [error, setError]       = useState("");
  const [listo, setListo]       = useState<{ permanente: boolean; hasta: string | null; total: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar() {
    setError("");
    startTransition(async () => {
      const r = await registrarBaja(token, duracion, alcance, motivo);
      if (!r.ok) { setError(r.error); return; }
      setListo({ permanente: r.permanente, hasta: r.hasta, total: r.total });
    });
  }

  if (listo) {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
        <h1 className="text-xl font-bold" style={{ color: "var(--pgo-text-1)" }}>Listo, no te escribimos más</h1>
        <p className="text-sm" style={{ color: "var(--pgo-text-3)" }}>
          {listo.total
            ? "No te enviaremos ningún correo"
            : "Dejamos de enviarte los avisos informativos"}
          {listo.permanente
            ? " de forma permanente."
            : ` hasta el ${new Date(listo.hasta!).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}.`}
        </p>
        {!listo.total && (
          <p className="text-sm" style={{ color: "var(--pgo-success)" }}>
            Los avisos de tu contrato —vencimientos, atrasos y comprobantes— te van a seguir llegando.
          </p>
        )}
        <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
          Si cambias de opinión, puedes volver a activarlos cuando quieras desde tu portal de arrendatario.
          Esto no afecta tu contrato ni tus pagos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center">
        <BellOff className="mx-auto mb-2 h-9 w-9" style={{ color: "var(--pgo-text-4)" }} aria-hidden="true" />
        <h1 className="text-xl font-bold" style={{ color: "var(--pgo-text-1)" }}>
          Dejar de recibir avisos por correo
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>
          {nombre ? `Hola ${nombre}. ` : ""}
          {corredora ? `Son los avisos que te envía ${corredora} a través de ${MARCA}.` : "Son los avisos que te enviamos por correo."}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
          ¿Qué avisos quieres dejar de recibir?
        </legend>
        {ALCANCES.map((a) => (
          <label key={a.clave} className="flex cursor-pointer items-start gap-2.5 rounded-xl px-3 py-2.5"
            style={{
              background: alcance === a.clave ? "var(--pgo-primary-lt)" : "var(--pgo-surface-2)",
              border: `1px solid ${alcance === a.clave ? "var(--pgo-primary-bd)" : "var(--pgo-border-2)"}`,
            }}>
            <input
              type="radio" name="alcance" value={a.clave}
              checked={alcance === a.clave}
              onChange={() => setAlcance(a.clave)}
              className="mt-0.5 h-4 w-4 shrink-0" style={{ accentColor: "var(--pgo-primary)" }}
            />
            <span className="min-w-0">
              <span className="block text-sm" style={{ color: "var(--pgo-text-1)" }}>{a.etiqueta}</span>
              <span className="block text-xs" style={{ color: "var(--pgo-text-4)" }}>{a.detalle}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/* La advertencia aparece solo cuando corresponde: en el alcance seguro
          sería ruido, y el ruido constante enseña a ignorar las advertencias. */}
      {alcance === "todos" && (
        <div className="rounded-xl p-3 text-xs" style={{ background: "var(--pgo-warning-lt)", color: "var(--pgo-warning-dk)", border: "1px solid var(--pgo-warning-bd)" }}>
          Con esta opción tampoco te avisaremos si tu arriendo vence o queda impago.
          Tu contrato, tus pagos y tus plazos siguen exactamente igual — pero vas a
          tener que revisarlos tú en el portal.
        </div>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
          ¿Por cuánto tiempo?
        </legend>
        {DURACIONES.map((d) => (
          <label key={d.clave} className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{
              background: duracion === d.clave ? "var(--pgo-primary-lt)" : "var(--pgo-surface-2)",
              border: `1px solid ${duracion === d.clave ? "var(--pgo-primary-bd)" : "var(--pgo-border-2)"}`,
            }}>
            <input
              type="radio" name="duracion" value={d.clave}
              checked={duracion === d.clave}
              onChange={() => setDuracion(d.clave)}
              className="h-4 w-4" style={{ accentColor: "var(--pgo-primary)" }}
            />
            <span className="text-sm" style={{ color: "var(--pgo-text-1)" }}>{d.etiqueta}</span>
          </label>
        ))}
      </fieldset>

      <div>
        <label htmlFor="motivo" className="mb-1 block text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
          ¿Nos cuentas por qué? <span className="font-normal" style={{ color: "var(--pgo-text-4)" }}>— opcional</span>
        </label>
        <textarea
          id="motivo" rows={3} maxLength={300}
          value={motivo} onChange={(e) => setMotivo(e.target.value)}
          placeholder="Recibo demasiados correos, prefiero revisar el portal…"
          className="pgo-input w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm" style={{ color: "var(--pgo-danger)" }}>{error}</p>}

      <button
        type="button" onClick={enviar} disabled={isPending}
        className="pgo-btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Confirmar
      </button>
    </div>
  );
}
