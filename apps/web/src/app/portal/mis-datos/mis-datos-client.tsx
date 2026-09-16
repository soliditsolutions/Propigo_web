"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Phone, ShieldOff, User } from "lucide-react";
import {
  solicitarRectificacionAction, confirmarRectificacionAction,
  reportarIdentidadIncorrectaAction, oponerseAlTratamientoAction,
} from "./actions";
import type { CampoRectificable as Campo } from "@/lib/rectificacion-persona";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "var(--hw-surface-2)", border: "1px solid var(--hw-border-2)" }}>
      {children}
    </div>
  );
}

function CardTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <div className="mt-0.5 shrink-0" style={{ color: "var(--hw-text-3)" }}>{icon}</div>
      <div className="min-w-0">
        <p className="font-semibold" style={{ color: "var(--hw-text-1)" }}>{title}</p>
        <p className="text-xs" style={{ color: "var(--hw-text-3)" }}>{subtitle}</p>
      </div>
    </div>
  );
}

/** Identidad — solo lectura. Reportar un error la deriva a la corredora. */
function IdentidadCard({ nombre, rut }: { nombre: string; rut: string }) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function enviar() {
    setError("");
    startTransition(async () => {
      const r = await reportarIdentidadIncorrectaAction(detalle);
      if (!r.ok) { setError(r.error); return; }
      setEnviado(true);
      setAbierto(false);
    });
  }

  return (
    <Card>
      <CardTitle icon={<User className="h-5 w-5" aria-hidden />} title="Identidad" subtitle="Nombre y RUT no se editan desde aquí — son tu identidad legal." />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>Nombre</p>
          <p style={{ color: "var(--hw-text-1)" }}>{nombre}</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>RUT</p>
          <p style={{ color: "var(--hw-text-1)" }}>{rut}</p>
        </div>
      </div>

      {enviado ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--hw-success)" }}>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Avisamos a tu corredora. Te contactará para corregirlo.
        </p>
      ) : abierto ? (
        <div className="mt-3 space-y-2">
          <textarea
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="¿Qué dato está mal y cuál debería ser?"
            rows={2}
            maxLength={500}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)", color: "var(--hw-text-1)" }}
          />
          {error && <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={enviar} disabled={isPending || !detalle.trim()}
              className="hw-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--hw-primary)" }}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Enviar aviso"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="hw-btn text-xs" style={{ color: "var(--hw-text-4)" }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} className="hw-btn mt-3 text-xs font-semibold underline" style={{ color: "var(--hw-primary)" }}>
          Mi nombre o RUT están mal
        </button>
      )}
    </Card>
  );
}

/** Rectificación de correo o teléfono — pedir código, confirmarlo. */
function RectificacionCard({ campo, valorActual }: { campo: Campo; valorActual: string | null }) {
  const [paso, setPaso] = useState<"idle" | "editando" | "codigo">("idle");
  const [valorNuevo, setValorNuevo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [confirmado, setConfirmado] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const label = campo === "email" ? "Correo electrónico" : "Teléfono";
  const Icon = campo === "email" ? Mail : Phone;

  function solicitar() {
    setError("");
    startTransition(async () => {
      const r = await solicitarRectificacionAction(campo, valorNuevo);
      if (!r.ok) { setError(r.error); return; }
      setPaso("codigo");
    });
  }

  function confirmar() {
    setError("");
    startTransition(async () => {
      const r = await confirmarRectificacionAction(campo, codigo);
      if (!r.ok) { setError(r.error); return; }
      setConfirmado(r.valorNuevo);
      setPaso("idle");
      setCodigo("");
    });
  }

  return (
    <Card>
      <CardTitle
        icon={<Icon className="h-5 w-5" aria-hidden />}
        title={label}
        subtitle={
          campo === "telefono"
            ? "El código de confirmación llega a tu correo registrado — no enviamos SMS."
            : "El código de confirmación llega al correo nuevo, para comprobar que es tuyo."
        }
      />
      <p className="text-sm" style={{ color: "var(--hw-text-1)" }}>{confirmado ?? valorActual ?? "No registrado"}</p>

      {confirmado && (
        <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--hw-success)" }}>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Actualizado.
        </p>
      )}

      {paso === "idle" && (
        <button type="button" onClick={() => { setPaso("editando"); setValorNuevo(""); setError(""); }}
          className="hw-btn mt-2 text-xs font-semibold underline" style={{ color: "var(--hw-primary)" }}>
          Corregir
        </button>
      )}

      {paso === "editando" && (
        <div className="mt-3 space-y-2">
          <input
            type={campo === "email" ? "email" : "text"}
            value={valorNuevo}
            onChange={(e) => setValorNuevo(e.target.value)}
            placeholder={campo === "email" ? "nuevo@correo.cl" : "+56 9 1234 5678"}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)", color: "var(--hw-text-1)" }}
          />
          {error && <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={solicitar} disabled={isPending || !valorNuevo.trim()}
              className="hw-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--hw-primary)" }}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Enviar código"}
            </button>
            <button type="button" onClick={() => setPaso("idle")} className="hw-btn text-xs" style={{ color: "var(--hw-text-4)" }}>Cancelar</button>
          </div>
        </div>
      )}

      {paso === "codigo" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs" style={{ color: "var(--hw-text-3)" }}>Ingresa el código de 6 dígitos que enviamos.</p>
          <input
            type="text" inputMode="numeric" maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="w-32 rounded-lg border px-3 py-2 text-center text-sm tabular-nums tracking-widest"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)", color: "var(--hw-text-1)" }}
          />
          {error && <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={confirmar} disabled={isPending || codigo.length !== 6}
              className="hw-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--hw-success)" }}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Confirmar"}
            </button>
            <button type="button" onClick={() => setPaso("idle")} className="hw-btn text-xs" style={{ color: "var(--hw-text-4)" }}>Cancelar</button>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Oposición al tratamiento (L-DP6) — reusa la baja de avisos, con alcance explícito. */
function OposicionCard({ suscrito, alcance }: { suscrito: boolean; alcance: "solo_opcionales" | "todos" }) {
  const [alcanceElegido, setAlcanceElegido] = useState<"solo_opcionales" | "todos">(alcance);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [hecho, setHecho] = useState(false);
  const [isPending, startTransition] = useTransition();

  function oponerse() {
    setError("");
    startTransition(async () => {
      const r = await oponerseAlTratamientoAction(alcanceElegido, motivo);
      if (!r.ok) { setError(r.error); return; }
      setHecho(true);
    });
  }

  const opuesto = !suscrito || hecho;

  return (
    <Card>
      <CardTitle
        icon={<ShieldOff className="h-5 w-5" aria-hidden />}
        title="Oponerme al tratamiento"
        subtitle="Detiene los avisos que elijas. Lo necesario para tu contrato (cobros, comprobantes) sigue tratándose: no es algo a lo que la ley permita oponerse."
      />

      {opuesto ? (
        <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--hw-success)" }}>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Registrado. Puedes reactivar tus avisos cuando quieras desde tu contrato.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-col gap-1.5 text-sm" style={{ color: "var(--hw-text-2)" }}>
            <label className="flex items-center gap-2">
              <input type="radio" checked={alcanceElegido === "solo_opcionales"} onChange={() => setAlcanceElegido("solo_opcionales")} />
              Solo avisos informativos (recomendado) — sigo recibiendo lo del contrato
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={alcanceElegido === "todos"} onChange={() => setAlcanceElegido("todos")} />
              Todos, incluidos los del contrato
            </label>
          </div>
          <input
            type="text" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (opcional)"
            className="w-full rounded-lg border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--hw-border)", background: "var(--hw-surface)", color: "var(--hw-text-1)" }}
          />
          {alcanceElegido === "todos" && (
            <p className="flex items-start gap-1.5 text-xs" style={{ color: "var(--hw-warning-dk)" }}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              No te llegarán ni los recordatorios de vencimiento ni los avisos de atraso.
            </p>
          )}
          {error && <p className="text-xs" style={{ color: "var(--hw-danger)" }}>{error}</p>}
          <button type="button" onClick={oponerse} disabled={isPending}
            className="hw-btn rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--hw-danger)" }}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Oponerme"}
          </button>
        </div>
      )}
    </Card>
  );
}

export function MisDatosClient({
  nombre, rut, email, telefono, suscrito, alcance,
}: {
  nombre: string; rut: string; email: string | null; telefono: string | null;
  suscrito: boolean; alcance: "solo_opcionales" | "todos";
}) {
  return (
    <div className="space-y-4">
      <IdentidadCard nombre={nombre} rut={rut} />
      <RectificacionCard campo="email" valorActual={email} />
      <RectificacionCard campo="telefono" valorActual={telefono} />
      <OposicionCard suscrito={suscrito} alcance={alcance} />
    </div>
  );
}
