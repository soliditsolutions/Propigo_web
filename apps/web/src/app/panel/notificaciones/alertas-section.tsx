"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellPlus, Send, Pencil, Power, Loader2, ChevronDown, ChevronUp,
  Wrench, Clock3, AlertTriangle, FileText, Sparkles, Eye, ArrowLeft,
} from "lucide-react";
import { Card, SectionTitle, Badge } from "@/components/panel/ui";
import { useToast } from "@/components/ui/toast";
import { MARCADORES, LIMITES, renderizarAlerta, type EntradaAlerta, type DatosAlerta } from "@/lib/alertas";
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

/**
 * Puntos de partida — el problema real no es que el formulario tenga pocos
 * campos, es que parte en blanco: sin un ejemplo concreto, alguien que no ha
 * escrito una alerta antes no sabe qué se espera en "asunto" ni cómo se ve
 * un {{marcador}} bien usado. Cada plantilla es una alerta real y completa,
 * no un placeholder — se guarda tal cual si nadie la toca.
 */
const PLANTILLAS: {
  id: string;
  titulo: string;
  descripcion: string;
  icon: typeof Wrench;
  valores: EntradaAlerta;
}[] = [
  {
    id: "recordatorio",
    titulo: "Recordatorio antes del vencimiento",
    descripcion: "Automática · avisa unos días antes de que venza el pago.",
    icon: Clock3,
    valores: {
      nombre: "Recordatorio antes del vencimiento",
      asunto: "Tu arriendo vence pronto — {{direccion}}",
      cuerpo: "Hola {{arrendatario}}, te recordamos que el pago de {{monto}} vence el {{vencimiento}}. Si ya pagaste, no necesitas hacer nada.\n\n{{corredora}}",
      destinatario: "arrendatario", disparador: "antes_de_vencimiento", diasOffset: 3,
    },
  },
  {
    id: "atraso",
    titulo: "Aviso de atraso",
    descripcion: "Automática · avisa unos días después de un pago vencido.",
    icon: AlertTriangle,
    valores: {
      nombre: "Aviso de atraso",
      asunto: "Pago pendiente — {{direccion}}",
      cuerpo: "Hola {{arrendatario}}, el pago de {{monto}} con vencimiento el {{vencimiento}} todavía está pendiente. Regulariza a la brevedad o contáctanos si tienes algún inconveniente.\n\n{{corredora}}",
      destinatario: "arrendatario", disparador: "dias_de_mora", diasOffset: 5,
    },
  },
  {
    id: "mantencion",
    titulo: "Aviso de mantención",
    descripcion: "Manual · la envías tú cuando corresponda, sobre un contrato puntual.",
    icon: Wrench,
    valores: {
      nombre: "Aviso de mantención",
      asunto: "Mantención programada en {{direccion}}",
      cuerpo: "Hola {{arrendatario}}, te informamos que se realizará una mantención en tu propiedad. Nos pondremos en contacto para coordinar el horario.\n\n{{corredora}}",
      destinatario: "arrendatario", disparador: null, diasOffset: null,
    },
  },
  {
    id: "propietario",
    titulo: "Aviso al propietario",
    descripcion: "Manual · una novedad puntual sobre su propiedad.",
    icon: FileText,
    valores: {
      nombre: "Aviso al propietario",
      asunto: "Novedades sobre tu propiedad en {{direccion}}",
      cuerpo: "Hola {{propietario}}, te escribimos para contarte una novedad sobre tu propiedad en {{direccion}}.\n\n{{corredora}}",
      destinatario: "propietario", disparador: null, diasOffset: null,
    },
  },
];

/** Datos de ejemplo para la vista previa — nunca se envían, solo se muestran. */
const DATOS_EJEMPLO: DatosAlerta = {
  arrendatario: "Pedro Arrendatario",
  propietario: "Ana Dueña",
  direccion: "Los Aromos 1234, Ñuñoa",
  monto: "$450.000",
  vencimiento: new Date(),
  corredora: "Tu corredora",
};

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
  // Solo aplica al crear (no al editar): antes de mostrar el formulario,
  // elegir un punto de partida — ver PLANTILLAS arriba.
  const [eligiendoPlantilla, setEligiendoPlantilla] = useState(false);
  const [form, setForm]             = useState<EntradaAlerta>(VACIA);
  const [error, setError]           = useState("");
  const [enviando, setEnviando]     = useState<string | null>(null);
  const [contratoSel, setContratoSel] = useState("");
  const [isPending, startTransition] = useTransition();

  // Último campo enfocado (asunto o mensaje) — ahí se insertan los chips de
  // {{marcador}}. Los refs (no solo el nombre) permiten leer la posición real
  // del cursor al momento del click, así el marcador queda donde se estaba
  // escribiendo y no siempre al final.
  const [ultimoFoco, setUltimoFoco] = useState<"asunto" | "cuerpo">("cuerpo");
  const asuntoRef = useRef<HTMLInputElement | null>(null);
  const cuerpoRef = useRef<HTMLTextAreaElement | null>(null);

  function abrirNueva() {
    setEditando("nueva"); setEligiendoPlantilla(true); setForm(VACIA); setError("");
  }
  function elegirPlantilla(valores: EntradaAlerta) {
    setForm(valores); setEligiendoPlantilla(false);
  }
  function abrirEdicion(a: AlertaVista) {
    setEditando(a.id); setEligiendoPlantilla(false);
    setForm({
      nombre: a.nombre, asunto: a.asunto, cuerpo: a.cuerpo,
      destinatario: a.destinatario, disparador: a.disparador, diasOffset: a.diasOffset,
    });
    setError("");
  }
  function cerrarFormulario() {
    setEditando(null); setEligiendoPlantilla(false);
  }

  function insertarMarcador(clave: string) {
    const esAsunto = ultimoFoco === "asunto";
    const ref = esAsunto ? asuntoRef.current : cuerpoRef.current;
    const campo = esAsunto ? "asunto" : "cuerpo";
    const actual = form[campo];
    const tag = `{{${clave}}}`;
    const start = ref?.selectionStart ?? actual.length;
    const end   = ref?.selectionEnd   ?? actual.length;
    const nuevo = actual.slice(0, start) + tag + actual.slice(end);
    setForm((f) => ({ ...f, [campo]: nuevo }));
    // Vuelve el foco al campo con el cursor justo después del marcador
    // insertado — sin esto, seguir escribiendo continúa en el lugar
    // equivocado (o en ningún campo, porque el click quitó el foco).
    requestAnimationFrame(() => {
      ref?.focus();
      const pos = start + tag.length;
      ref?.setSelectionRange(pos, pos);
    });
  }

  function guardar() {
    setError("");
    startTransition(async () => {
      const r = editando === "nueva"
        ? await crearAlerta(form)
        : await actualizarAlerta(editando!, form);
      if (!r.ok) { setError(r.error); return; }
      toast(editando === "nueva" ? "Alerta creada." : "Alerta actualizada.", "success");
      cerrarFormulario();
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
        <span className="flex shrink-0 items-center gap-2 text-xs" style={{ color: "var(--pgo-text-3)" }}>
          {alertas.length}
          {abierta ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {abierta && (
        <div className="mt-4 space-y-3">
          {esManager && editando === null && (
            <button type="button" onClick={abrirNueva} className="pgo-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
              <BellPlus className="h-4 w-4" aria-hidden="true" />
              Nueva alerta
            </button>
          )}

          {editando !== null && eligiendoPlantilla && (
            <div className="space-y-3 rounded-xl p-4" style={{ background: "var(--pgo-surface-2)", border: "1px solid var(--pgo-border-2)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--pgo-text-1)" }}>
                ¿Cómo quieres empezar?
              </p>
              <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
                Elige la que más se parezca a lo que necesitas — queda editable, es solo para no partir de cero.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PLANTILLAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => elegirPlantilla(p.valores)}
                    className="pgo-btn flex items-start gap-3 rounded-xl p-3 text-left"
                    style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)" }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: "var(--pgo-primary-lt)", color: "var(--pgo-primary)" }}
                      aria-hidden="true"
                    >
                      <p.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold" style={{ color: "var(--pgo-text-1)" }}>{p.titulo}</span>
                      <span className="block text-xs" style={{ color: "var(--pgo-text-4)" }}>{p.descripcion}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: "var(--pgo-border)" }}>
                <button type="button" onClick={() => elegirPlantilla(VACIA)}
                  className="text-xs font-medium underline-offset-2 hover:underline" style={{ color: "var(--pgo-text-3)" }}>
                  Prefiero empezar en blanco
                </button>
                <button type="button" onClick={cerrarFormulario} disabled={isPending}
                  className="pgo-btn rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--pgo-surface)", color: "var(--pgo-text-3)" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {editando !== null && !eligiendoPlantilla && (
            <div className="space-y-4 rounded-xl p-4" style={{ background: "var(--pgo-surface-2)", border: "1px solid var(--pgo-border-2)" }}>
              {editando === "nueva" && (
                <button type="button" onClick={() => setEligiendoPlantilla(true)}
                  className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--pgo-primary)" }}>
                  <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Elegir otro punto de partida
                </button>
              )}

              {/* Paso 1 — quién y cuándo, antes de escribir: define el tono y si
                  hace falta pensar en "días antes/después" o no. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="¿A quién va?">
                  <select
                    value={form.destinatario}
                    onChange={(e) => setForm({ ...form, destinatario: e.target.value as EntradaAlerta["destinatario"] })}
                    className="pgo-input w-full rounded-lg px-3 py-2 text-sm"
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
                        diasOffset: v === "" ? null : (form.diasOffset ?? 5),
                      });
                    }}
                    className="pgo-input w-full rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Solo cuando yo la envíe</option>
                    <option value="antes_de_vencimiento">Antes del vencimiento</option>
                    <option value="dias_de_mora">Cuando hay atraso</option>
                  </select>
                </Campo>
              </div>

              {form.disparador && (
                <Campo etiqueta={form.disparador === "antes_de_vencimiento" ? "¿Cuántos días antes del vencimiento del pago?" : "¿A los cuántos días de atraso?"}>
                  <input
                    type="number" min={0} max={LIMITES.diasOffsetMax}
                    value={form.diasOffset ?? ""}
                    onChange={(e) => setForm({ ...form, diasOffset: e.target.value === "" ? null : Number(e.target.value) })}
                    className="pgo-input w-32 rounded-lg px-3 py-2 text-sm"
                  />
                </Campo>
              )}

              {/* Paso 2 — el contenido, con los marcadores insertables a mano. */}
              <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--pgo-border)" }}>
                <Campo etiqueta="Asunto" ayuda="Lo primero que ve quien recibe el correo.">
                  <input
                    ref={asuntoRef}
                    value={form.asunto} maxLength={LIMITES.asunto}
                    onChange={(e) => setForm({ ...form, asunto: e.target.value })}
                    onFocus={() => setUltimoFoco("asunto")}
                    placeholder="Mantención programada en {{direccion}}"
                    className="pgo-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                </Campo>

                <Campo etiqueta="Mensaje">
                  <textarea
                    ref={cuerpoRef}
                    value={form.cuerpo} maxLength={LIMITES.cuerpo} rows={5}
                    onChange={(e) => setForm({ ...form, cuerpo: e.target.value })}
                    onFocus={() => setUltimoFoco("cuerpo")}
                    placeholder="Hola {{arrendatario}}, te avisamos que…"
                    className="pgo-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                </Campo>

                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Toca uno para insertarlo en {ultimoFoco === "asunto" ? "el asunto" : "el mensaje"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {MARCADORES.map((m) => (
                      <button
                        key={m.clave}
                        type="button"
                        onClick={() => insertarMarcador(m.clave)}
                        title={m.ayuda}
                        className="pgo-btn rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ background: "var(--pgo-primary-lt)", color: "var(--pgo-primary-dk)" }}
                      >
                        <code>{`{{${m.clave}}}`}</code>
                        <span className="ml-1 font-normal opacity-80">{m.ayuda}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vista previa — con datos de ejemplo, nunca se envía. Cierra el
                    loop de "¿esto de verdad se ve bien?" sin tener que enviarse
                    un aviso de prueba a sí mismo. */}
                {(form.asunto || form.cuerpo) && (
                  <div className="rounded-xl p-3" style={{ background: "var(--pgo-surface)", border: "1px dashed var(--pgo-border-2)" }}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--pgo-text-4)" }}>
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Vista previa con datos de ejemplo
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--pgo-text-1)" }}>
                      {renderizarAlerta(form.asunto, DATOS_EJEMPLO) || <span style={{ color: "var(--pgo-text-4)" }}>(sin asunto)</span>}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm" style={{ color: "var(--pgo-text-2)" }}>
                      {renderizarAlerta(form.cuerpo, DATOS_EJEMPLO) || <span style={{ color: "var(--pgo-text-4)" }}>(sin mensaje)</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* Paso 3 — nombrarla, ahora que ya se sabe qué dice. */}
              <div className="border-t pt-4" style={{ borderColor: "var(--pgo-border)" }}>
                <Campo etiqueta="Nombre de la alerta" ayuda="Solo lo ves tú y tu equipo, para reconocerla en la lista.">
                  <input
                    value={form.nombre} maxLength={LIMITES.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Aviso de mantención"
                    className="pgo-input w-full rounded-lg px-3 py-2 text-sm"
                  />
                </Campo>
              </div>

              {error && <p className="text-sm" style={{ color: "var(--pgo-danger)" }}>{error}</p>}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={cerrarFormulario} disabled={isPending}
                  className="pgo-btn rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--pgo-surface)", color: "var(--pgo-text-3)" }}>
                  Cancelar
                </button>
                <button type="button" onClick={guardar} disabled={isPending}
                  className="pgo-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Guardar
                </button>
              </div>
            </div>
          )}

          {alertas.length === 0 && editando === null && (
            <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>
              {esManager
                ? "Todavía no hay alertas. Crea la primera y quedará disponible para todo tu equipo."
                : "El administrador de tu cuenta todavía no ha creado alertas."}
            </p>
          )}

          {alertas.map((a) => (
            <div key={a.id} className="rounded-xl p-3" style={{ background: "var(--pgo-surface-2)", border: "1px solid var(--pgo-border-2)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-semibold" style={{ color: "var(--pgo-text-1)" }}>
                    {a.nombre}
                    {!a.activa && <Badge tone="slate">Desactivada</Badge>}
                  </p>
                  <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
                    {describirDisparador(a)} · {a.destinatario === "arrendatario" ? "al arrendatario" : "al propietario"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.activa && (
                    <button type="button" onClick={() => { setEnviando(enviando === a.id ? null : a.id); setContratoSel(""); }}
                      className="pgo-btn flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "var(--pgo-surface)", color: "var(--pgo-text-2)" }}>
                      <Send className="h-3.5 w-3.5" aria-hidden="true" /> Enviar
                    </button>
                  )}
                  {esManager && (
                    <>
                      <button type="button" onClick={() => abrirEdicion(a)} aria-label={`Editar ${a.nombre}`}
                        className="pgo-btn rounded-lg p-1.5" style={{ color: "var(--pgo-text-4)" }}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => alternar(a)} disabled={isPending}
                        aria-label={a.activa ? `Desactivar ${a.nombre}` : `Activar ${a.nombre}`}
                        className="pgo-btn rounded-lg p-1.5" style={{ color: a.activa ? "var(--pgo-warning)" : "var(--pgo-success)" }}>
                        <Power className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {enviando === a.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3" style={{ borderColor: "var(--pgo-border)" }}>
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
                      ¿Sobre qué contrato?
                    </label>
                    <select value={contratoSel} onChange={(e) => setContratoSel(e.target.value)}
                      className="pgo-input w-full rounded-lg px-3 py-2 text-sm">
                      <option value="">Elige un contrato…</option>
                      {contratos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => mandar(a.id)} disabled={!contratoSel || isPending}
                    className="pgo-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">
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
      <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
        {etiqueta}
        {ayuda && <span className="ml-1 font-normal" style={{ color: "var(--pgo-text-4)" }}>— {ayuda}</span>}
      </label>
      {children}
    </div>
  );
}
