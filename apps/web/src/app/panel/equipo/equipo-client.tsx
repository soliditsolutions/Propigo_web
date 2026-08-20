"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus, Send, Loader2, Users, Mail, Clock, Power, RotateCw, Building2,
} from "lucide-react";
import {
  invitarColaboradorAction,
  desactivarColaboradorAction,
  reactivarColaboradorAction,
} from "./actions";
import { useToast } from "@/components/ui/toast";
import { Badge, CupoBadge } from "@/components/panel/ui";

type Colaborador = {
  id: string;
  nombre: string;
  email: string;
  desactivado: boolean;
  propiedadesAsignadas: number;
};

type Invitacion = {
  id: string;
  nombre: string;
  email: string;
  expiresAt: string;
};

type Cupo = { usado: number; max: number; planLabel: string };

function diasRestantes(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function InvitarForm({ cupo }: { cupo: Cupo }) {
  const router = useRouter();
  const { show: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [nombre, setNombre] = useState("");
  const [email, setEmail]   = useState("");
  const [error, setError]   = useState("");
  const lleno = cupo.usado >= cupo.max;

  const inputStyle: React.CSSProperties = {
    height: "44px", width: "100%", borderRadius: "12px",
    border: "1px solid var(--hw-border-2)", background: "var(--hw-surface)",
    color: "var(--hw-text-1)", fontSize: "14px", padding: "0 14px",
    outline: "none", boxShadow: "var(--hw-input-shadow)",
    opacity: (isPending || lleno) ? 0.6 : 1,
  };
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = "var(--hw-primary)";
      e.currentTarget.style.boxShadow   = "var(--hw-input-shadow-focus)";
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = "var(--hw-border-2)";
      e.currentTarget.style.boxShadow   = "var(--hw-input-shadow)";
    },
  };

  function handleInvitar() {
    setError("");
    startTransition(async () => {
      const res = await invitarColaboradorAction(nombre, email);
      if (!res.ok) { setError(res.error); return; }
      setNombre(""); setEmail("");
      toast("Invitación enviada correctamente.", "success");
      router.refresh();
    });
  }

  return (
    <section
      className="rounded-2xl p-6"
      style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" style={{ color: "var(--hw-primary)" }} aria-hidden="true" />
          <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>Invitar colaborador</h2>
        </div>
        <CupoBadge usado={cupo.usado} max={cupo.max} unidad="usuarios" planLabel={cupo.planLabel} />
      </div>

      {lleno && (
        <p
          className="mb-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--hw-warning-lt)", color: "var(--hw-warning)", border: "1px solid var(--hw-warning-bd)" }}
        >
          Alcanzaste el límite de {cupo.max} usuario{cupo.max !== 1 ? "s" : ""} de tu plan {cupo.planLabel}. Desactiva a alguien o mejora tu plan para invitar a más gente.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="equipo-nombre" className="block text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>
            Nombre completo
          </label>
          <input
            id="equipo-nombre" type="text" value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan Pérez" disabled={isPending || lleno}
            style={inputStyle} {...focusHandlers}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="equipo-email" className="block text-sm font-semibold" style={{ color: "var(--hw-text-2)" }}>
            Correo electrónico
          </label>
          <input
            id="equipo-email" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="juan@empresa.cl" disabled={isPending || lleno}
            style={inputStyle} {...focusHandlers}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--hw-danger)" }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handleInvitar}
        disabled={isPending || lleno || !nombre.trim() || !email.trim()}
        className="hw-btn-primary mt-4"
        style={{ height: "42px", fontSize: "14px", borderRadius: "10px", opacity: (lleno || !nombre.trim() || !email.trim()) ? 0.5 : 1 }}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {isPending ? "Enviando…" : "Enviar invitación"}
      </button>
    </section>
  );
}

function ColaboradorRow({ c }: { c: Colaborador }) {
  const router = useRouter();
  const { show: toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = c.desactivado
        ? await reactivarColaboradorAction(c.id)
        : await desactivarColaboradorAction(c.id);
      if (!res.ok) { toast(res.error, "error"); return; }
      toast(c.desactivado ? "Colaborador reactivado." : "Colaborador desactivado.", "success");
      router.refresh();
    });
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
      style={{ borderBottom: "1px solid var(--hw-border)" }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate" style={{ color: "var(--hw-text-1)" }}>{c.nombre}</p>
          <Badge tone={c.desactivado ? "slate" : "green"}>{c.desactivado ? "Desactivado" : "Activo"}</Badge>
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
          <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
          {c.email}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
          <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          {c.propiedadesAsignadas} propiedad{c.propiedadesAsignadas !== 1 ? "es" : ""} asignada{c.propiedadesAsignadas !== 1 ? "s" : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className="hw-btn shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
        style={{
          background: "var(--hw-surface-2)",
          color:      c.desactivado ? "var(--hw-success)" : "var(--hw-danger)",
          border:     `1px solid ${c.desactivado ? "var(--hw-success-bd)" : "var(--hw-danger-bd)"}`,
        }}
      >
        {isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          : c.desactivado ? <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> : <Power className="h-3.5 w-3.5" aria-hidden="true" />}
        {c.desactivado ? "Reactivar" : "Desactivar"}
      </button>
    </div>
  );
}

export function EquipoClient({
  colaboradores,
  invitaciones,
  cupo,
}: {
  colaboradores: Colaborador[];
  invitaciones: Invitacion[];
  cupo: Cupo;
}) {
  return (
    <div className="space-y-6">
      <InvitarForm cupo={cupo} />

      <section
        className="overflow-hidden rounded-2xl"
        style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
      >
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--hw-border)" }}>
          <Users className="h-4 w-4" style={{ color: "var(--hw-primary)" }} aria-hidden="true" />
          <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>
            Colaboradores ({colaboradores.length})
          </h2>
        </div>

        {colaboradores.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm" style={{ color: "var(--hw-text-4)" }}>
            Aún no has invitado a ningún colaborador.
          </p>
        ) : (
          colaboradores.map((c) => <ColaboradorRow key={c.id} c={c} />)
        )}
      </section>

      {invitaciones.length > 0 && (
        <section
          className="overflow-hidden rounded-2xl"
          style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow-1)" }}
        >
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--hw-border)" }}>
            <Clock className="h-4 w-4" style={{ color: "var(--hw-warning)" }} aria-hidden="true" />
            <h2 className="text-base font-semibold" style={{ color: "var(--hw-text-1)" }}>
              Invitaciones pendientes ({invitaciones.length})
            </h2>
          </div>
          {invitaciones.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              style={{ borderBottom: "1px solid var(--hw-border)" }}
            >
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: "var(--hw-text-1)" }}>{inv.nombre}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
                  <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                  {inv.email}
                </p>
              </div>
              {/* Texto de varias palabras — no usar <Badge>, que aplica
                  text-transform:capitalize (pensado para estados de una sola
                  palabra como "activo"/"pendiente") y mayuscularía cada
                  palabra de la frase. */}
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  background: "var(--hw-warning-lt)",
                  color:      "var(--hw-warning)",
                  outline:    "1px solid var(--hw-warning-bd)",
                  outlineOffset: "-1px",
                }}
              >
                Expira en {diasRestantes(inv.expiresAt)} día{diasRestantes(inv.expiresAt) !== 1 ? "s" : ""}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
