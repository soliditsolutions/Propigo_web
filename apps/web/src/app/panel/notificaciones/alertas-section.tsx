"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellPlus, Send, Pencil, Power, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, SectionTitle, Badge } from "@/components/panel/ui";
import { useToast } from "@/components/ui/toast";
import { MARCADORES, LIMITES, type EntradaAlerta } from "@/lib/alertas";
import { crearAlerta, actualizarAlerta, cambiarEstadoAlerta, enviarAlerta } from "./alertas-actions";

export type AlertaVista = {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  destinatario: "arrendatario" | "propietario";
  activa: boolean;
  disparador: "antes_de_vencimiento" | "dias_de_mora" | null;
  diasOffset: number | null;
  creadaPor: { nombre: string };
};

export type ContratoOpcion = { id: string; etiqueta: string };

const VACIA: EntradaAlerta = {
  nombre: "", asunto: "", cuerpo: "",
  destinatario: "arrendatario", disparador: null, diasOffset: null,
};

/** Cómo se lee un disparador en la interfaz, no cómo se llama en la base. */
function describirDisparador(a: AlertaVista): string {
  if (!a.disparador) return "Se envía a mano";
  const d = a.diasOffset ?? 0;
  const dias = d === 1 ? "1 día" : `${d} días`;
  return a.disparador === "antes_de_vencimiento"
    ? `Automática · ${dias} antes del vencimiento`
    : `Automática · ${dias} de atraso`;
}

export function AlertasSection({
  alertas,
  contratos,
  esManager,
}: {
  alertas: AlertaVista[];
  contratos: ContratoOpcion[];
  esManager: boolean;
}) {
  const router = useRouter();
  const { show: toast } = useToast();
  const [abierta, setAbierta]       = useState(false);
  const [editando, setEditando]     = useState<string | null>(null);
  const [form, setForm]             = useState<EntradaAlerta>(VACIA);
  const [error, setError]           = useState("");
  const [enviando, setEnviando]     = useState<string | null>(null);
  const [contratoSel, setContratoSel] = useState("");
  const [isPending, startTransition] = useTransition();

  function abrirNueva() {
    setEditando("nueva"); setForm(VACIA); setError("");
  }
  function abrirEdicion(a: AlertaVista) {
    setEditando(a.id);
    setForm({
      nombre: a.nombre, asunto: a.asunto, cuerpo: a.cuerpo,
      destinatario: a.destinatario, disparador: a.disparador, diasOffset: a.diasOffset,
    });
    setError("");
  }

  function guardar() {
    setError("");
    startTransition(async () => {
      const r = editando === "nueva"
        ? await crearAlerta(form)
        : await actualizarAlerta(editando!, form);
      if (!r.ok) { setError(r.error); return; }
      toast(editando === "nueva" ? "Alerta creada." : "Alerta actualizada.", "success");
      setEditando(null);
      router.refresh();
    });
  }

  function alternar(a: AlertaVista) {
    startTransition(async () => {
      const r = await cambiarEstadoAlerta(a.id, !a.activa);
      if (!r.ok) { toast(r.error, "error"); return; }
      toast(a.activa ? "Alerta desactivada." : "Alerta activada.", "success");
      router.refresh();
    });
  }

  function mandar(alertaId: string) {
    if (!contratoSel) return;
    startTransition(async () => {
      const r = await enviarAlerta(alertaId, contratoSel);
      if (!r.ok) { toast(r.error, "error"); return; }
      toast("Alerta encolada. Sale con el próximo envío.", "success");
      setEnviando(null); setContratoSel("");
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={abierta}
      >
        <SectionTitle
          title="Alertas personalizadas"
          description={
            esManager
              ? "Avisos que defines una vez y quedan disponibles para todo tu equipo."
              : "Avisos definidos por el administrador de tu cuenta, listos para usar."
          }
        />
        <span className="flex shrink-0 items-center gap-2 text-xs" style={{ color: "var(--hw-text-3)" }}>
          {alertas.length}
          {abierta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {abierta && (
        <div className="mt-4 space-y-3">
          {esManager && editando === null && (
            <button type="button" onClick={abrirNueva} className="hw-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
              <BellPlus className="h-4 w-4" aria-hidden="true" />
              Nueva alerta
            </button>
          )}

          {editando !== null && (
            <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--hw-surface-2)", border: "1px solid var(--hw-border-2)" }}>
              <Campo etiqueta="Nombre" ayuda="Solo lo ves tú, para reconocerla.">
                <input
                  value={form.nombre} maxLength={LIMITES.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Aviso de mantención"
                  className="hw-input w-full rounded-lg px-3 py-2 text-sm"
                />
              </Campo>

              <Campo etiqueta="Asunto" ayuda="Lo primero que ve quien recibe el correo.">
                <input
                  value={form.asunto} maxLength={LIMITES.asunto}
                  onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                  placeholder="Mantención programada en {{direccion}}"
                  className="hw-input w-full rounded-lg px-3 py-2 text-sm"
                />
              </Campo>

              <Campo etiqueta="Mensaje">
                <textarea
                  value={form.cuerpo} maxLength={LIMITES.cuerpo} rows={4}
                  onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                  placeholder="Hola {{arrendatario}}, te avisamos que…"
                  className="hw-input w-full rounded-lg px-3 py-2 text-sm"
                />
              </Campo>

              <div className="rounded-lg p-3 text-xs" style={{ background: "var(--hw-primary-lt)", color: "var(--hw-primary-dk)" }}>
                <p className="mb-1 font-semibold">Puedes insertar estos datos y se reemplazan solos:</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {MARCADORES.map((m) => (
                    <span key={m.clave}><code>{`{{${m.clave}}}`}</code> — {m.ayuda}</span>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="¿A quién va?">
                  <select
                    value={form.destinatario}
                    onChange={(e) => setForm({ ...form, destinatario: e.target.value as EntradaAlerta["destinatario"] })}
                    className="hw-input w-full rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="arrendatario">Al arrendatario</option>
                    <option value="propietario">Al propietario</option>
                  </select>
                </Campo>

                <Campo etiqueta="¿Cuándo se envía?">
                  <select
                    value={form.disparador ?? ""}
                    onChange={(e) => {
                      const v = e.target.value as EntradaAlerta["disparador"] | "";
                      setForm({
                        ...form,
                        disparador: v === "" ? null : v,
                        // Los días acompañan al disparador: sin él no significan nada.
                        diasOffset: v === "" ? null : (form.diasOffset ?? 5),
                      });
                    }}
                    className="hw-input w-full rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Solo cuando yo la envíe</option>
                    <option value="antes_de_vencimiento">Antes del vencimiento</option>
                    <option value="dias_de_mora">Cuando hay atraso</option>
                  </select>
                </Campo>
              </div>

              {form.disparador && (
                <Campo etiqueta={form.disparador === "antes_de_vencimiento" ? "¿Cuántos días antes?" : "¿Tras cuántos días de atraso?"}>
                  <input
                    type="number" min={0} max={LIMITES.diasOffsetMax}
                    value={form.diasOffset ?? ""}
                    onChange={(e) => setForm({ ...form, diasOffset: e.target.value === "" ? null : Number(e.target.value) })}
                    className="hw-input w-32 rounded-lg px-3 py-2 text-sm"
                  />
                </Campo>
              )}

              {error && <p className="text-sm" style={{ color: "var(--hw-danger)" }}>{error}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditando(null)} disabled={isPending}
                  className="hw-btn rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--hw-surface)", color: "var(--hw-text-3)" }}>
                  Cancelar
                </button>
                <button type="button" onClick={guardar} disabled={isPending}
                  className="hw-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Guardar
                </button>
              </div>
            </div>
          )}

          {alertas.length === 0 && editando === null && (
            <p className="text-sm" style={{ color: "var(--hw-text-4)" }}>
              {esManager
                ? "Todavía no hay alertas. Crea la primera y quedará disponible para todo tu equipo."
                : "El administrador de tu cuenta todavía no ha creado alertas."}
            </p>
          )}

          {alertas.map((a) => (
            <div key={a.id} className="rounded-xl p-3" style={{ background: "var(--hw-surface-2)", border: "1px solid var(--hw-border-2)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--hw-text-1)" }}>
                    {a.nombre}
                    {!a.activa && <Badge tone="slate">Desactivada</Badge>}
                  </p>
                  <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
                    {describirDisparador(a)} · {a.destinatario === "arrendatario" ? "al arrendatario" : "al propietario"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.activa && (
                    <button type="button" onClick={() => { setEnviando(enviando === a.id ? null : a.id); setContratoSel(""); }}
                      className="hw-btn flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "var(--hw-surface)", color: "var(--hw-text-2)" }}>
                      <Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar
                    </button>
                  )}
                  {esManager && (
                    <>
                      <button type="button" onClick={() => abrirEdicion(a)} aria-label={`Editar ${a.nombre}`}
                        className="hw-btn rounded-lg p-1.5" style={{ color: "var(--hw-text-4)" }}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => alternar(a)} disabled={isPending}
                        aria-label={a.activa ? `Desactivar ${a.nombre}` : `Activar ${a.nombre}`}
                        className="hw-btn rounded-lg p-1.5" style={{ color: a.activa ? "var(--hw-warning)" : "var(--hw-success)" }}>
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {enviando === a.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3" style={{ borderColor: "var(--hw-border)" }}>
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--hw-text-3)" }}>
                      ¿Sobre qué contrato?
                    </label>
                    <select value={contratoSel} onChange={(e) => setContratoSel(e.target.value)}
                      className="hw-input w-full rounded-lg px-3 py-2 text-sm">
                      <option value="">Elige un contrato…</option>
                      {contratos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => mandar(a.id)} disabled={!contratoSel || isPending}
                    className="hw-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    Encolar aviso
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--hw-text-3)" }}>
        {etiqueta}
        {ayuda && <span className="ml-1 font-normal" style={{ color: "var(--hw-text-4)" }}>— {ayuda}</span>}
      </label>
      {children}
    </div>
  );
}
