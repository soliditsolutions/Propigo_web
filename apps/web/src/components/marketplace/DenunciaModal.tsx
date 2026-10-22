"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Modal, ModalSuccess, modalInputCls, modalInputStyle } from "@/components/ui/modal";
import { MARCA, RAZON_SOCIAL } from "@/lib/marca";

const TIPOS = [
  { value: "fraude_inmobiliario", label: "Fraude inmobiliario" },
  { value: "estafa",              label: "Estafa o apropiación de dineros" },
  { value: "informacion_falsa",   label: "Información falsa en la publicación" },
  { value: "acoso",               label: "Acoso o presión indebida" },
  { value: "discriminacion",      label: "Discriminación arbitraria" },
  { value: "incumplimiento",      label: "Incumplimiento de contrato" },
  { value: "otro",                label: "Otro" },
] as const;

type TipoDenuncia = typeof TIPOS[number]["value"];

interface Props {
  publicacionId: string;
  tituloPub:     string;
  nombreCorredor: string;
  onClose:       () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- tituloPub queda reservado en Props para un futuro resumen visible en el modal
export function DenunciaModal({ publicacionId, tituloPub: _tituloPub, nombreCorredor, onClose }: Props) {
  const { show: toast } = useToast();
  const [isPending, start] = useTransition();
  const [enviada, setEnviada] = useState(false);

  const [form, setForm] = useState({
    tipo:                  "" as TipoDenuncia | "",
    objetivo:              "propiedad" as "propiedad" | "corredor",
    descripcion:           "",
    evidenciaDescripcion:  "",
    esAnonima:             false,
    nombreDenunciante:     "",
    apellidoDenunciante:   "",
    emailDenunciante:      "",
    declaraVeracidad:      false,
    aceptaTratamientoDatos: false,
  });

  const [errores, setErrores] = useState<Partial<Record<keyof typeof form, string>>>({});

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function validar(): boolean {
    const e: typeof errores = {};
    if (!form.tipo)                           e.tipo = "Selecciona el tipo de denuncia";
    if (form.descripcion.trim().length < 30)  e.descripcion = "Describe el problema con al menos 30 caracteres";
    if (!form.esAnonima) {
      if (!form.nombreDenunciante.trim())     e.nombreDenunciante = "Requerido";
      if (!form.apellidoDenunciante.trim())   e.apellidoDenunciante = "Requerido";
    }
    if (!form.declaraVeracidad)               e.declaraVeracidad = "Debes declarar la veracidad de la información";
    if (!form.aceptaTratamientoDatos)         e.aceptaTratamientoDatos = "Debes aceptar el tratamiento de datos";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) return;

    start(async () => {
      try {
        const res  = await fetch("/api/marketplace/denuncia", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            ...form,
            publicacionId: form.objetivo === "propiedad" ? publicacionId : undefined,
            nombreCorredor: form.objetivo === "corredor" ? nombreCorredor : undefined,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast(data.error ?? "Error al enviar. Intenta nuevamente.", "error");
          return;
        }
        setEnviada(true);
      } catch {
        toast("Error de conexión. Intenta nuevamente.", "error");
      }
    });
  }

  const inputCls = modalInputCls;
  const inputStyle = (campo: keyof typeof form) => modalInputStyle(!!errores[campo]);

  return (
    <Modal
      onClose={onClose}
      title="Hacer una denuncia"
      subtitle="Reportar propiedad o corredor"
      icon={<ShieldAlert className="h-5 w-5" style={{ color: "var(--pgo-danger)" }} aria-hidden />}
    >
          {enviada ? (
            <ModalSuccess
              title="Denuncia recibida"
              message="Nuestro equipo revisará tu denuncia y tomará las medidas correspondientes. Gracias por ayudarnos a mantener la plataforma segura."
              extra={
                <div className="w-full rounded-xl p-3 text-xs text-left" style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}>
                  <p style={{ color: "var(--pf-text-muted)" }}>
                    Para emergencias o delitos, comunícate con <strong>Carabineros (133)</strong> o presenta una denuncia en el <strong>SERNAC (800 700 100)</strong>.
                  </p>
                </div>
              }
              onClose={onClose}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Aviso legal */}
              <div className="rounded-xl p-3 text-xs" style={{ background: "var(--pgo-warning-lt)", border: "1px solid var(--pgo-warning-bd)", color: "var(--pgo-warning-dk)" }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--pgo-warning)" }} aria-hidden />
                  <p>
                    Las denuncias falsas o maliciosas pueden tener consecuencias legales conforme al <strong>Art. 211 del Código Penal</strong> (denuncia calumniosa). Asegúrate de que la información sea verídica.
                  </p>
                </div>
              </div>

              {/* Objetivo */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--pf-navy)" }}>¿Qué deseas denunciar?</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["propiedad", "corredor"] as const).map(obj => (
                    <button
                      key={obj}
                      type="button"
                      onClick={() => set("objetivo", obj)}
                      className="rounded-xl py-2.5 px-3 text-sm font-medium transition-all"
                      style={{
                        background:   form.objetivo === obj ? "var(--pf-brand-tint)" : "var(--pf-surface)",
                        border:       `1.5px solid ${form.objetivo === obj ? "var(--pf-brand)" : "var(--pf-border-input)"}`,
                        color:        form.objetivo === obj ? "var(--pf-brand)" : "var(--pf-text-body)",
                      }}
                    >
                      {obj === "propiedad" ? "Una propiedad" : "Un corredor"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de denuncia */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Tipo de denuncia <span style={{ color: "var(--pgo-danger)" }}>*</span>
                </label>
                <select
                  value={form.tipo}
                  onChange={e => set("tipo", e.target.value as TipoDenuncia)}
                  className={inputCls}
                  style={inputStyle("tipo")}
                >
                  <option value="">Selecciona una opción…</option>
                  {TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errores.tipo && <p className="mt-1 text-xs" style={{ color: "var(--pgo-danger)" }}>{errores.tipo}</p>}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Descripción de los hechos <span style={{ color: "var(--pgo-danger)" }}>*</span>
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={e => set("descripcion", e.target.value)}
                  placeholder="Describe con detalle lo ocurrido, incluyendo fechas y hechos específicos…"
                  rows={5}
                  className={inputCls}
                  style={{ ...inputStyle("descripcion"), resize: "none" }}
                  maxLength={3000}
                />
                <div className="flex justify-between mt-1">
                  {errores.descripcion
                    ? <p className="text-xs" style={{ color: "var(--pgo-danger)" }}>{errores.descripcion}</p>
                    : <span />}
                  <p className="text-xs" style={{ color: "var(--pf-text-light)" }}>{form.descripcion.length}/3000</p>
                </div>
              </div>

              {/* Evidencia */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Evidencia (opcional)
                </label>
                <textarea
                  value={form.evidenciaDescripcion}
                  onChange={e => set("evidenciaDescripcion", e.target.value)}
                  placeholder="Describe capturas de pantalla, documentos u otras evidencias que poseas…"
                  rows={2}
                  className={inputCls}
                  style={{ ...inputStyle("evidenciaDescripcion"), resize: "none" }}
                  maxLength={1000}
                />
              </div>

              {/* Anonimato */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--pf-hero-1)", border: "1px solid var(--pf-border)" }}>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.esAnonima}
                    onChange={e => set("esAnonima", e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--pf-brand)]"
                  />
                  <span className="text-sm font-medium" style={{ color: "var(--pf-navy)" }}>Enviar denuncia anónima</span>
                </label>
                <p className="text-xs ml-6" style={{ color: "var(--pf-text-muted)" }}>
                  Puedes denunciar sin identificarte. De lo contrario, completa tus datos.
                </p>
              </div>

              {/* Datos del denunciante (si no es anónima) */}
              {!form.esAnonima && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {(["nombreDenunciante", "apellidoDenunciante"] as const).map(campo => (
                      <div key={campo}>
                        <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                          {campo === "nombreDenunciante" ? "Nombre" : "Apellido"} <span style={{ color: "var(--pgo-danger)" }}>*</span>
                        </label>
                        <input
                          type="text"
                          value={form[campo]}
                          onChange={e => set(campo, e.target.value)}
                          className={inputCls}
                          style={inputStyle(campo)}
                          maxLength={80}
                        />
                        {errores[campo] && <p className="mt-1 text-xs" style={{ color: "var(--pgo-danger)" }}>{errores[campo]}</p>}
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                      Email de contacto (opcional)
                    </label>
                    <input
                      type="email"
                      value={form.emailDenunciante}
                      onChange={e => set("emailDenunciante", e.target.value)}
                      placeholder="Para recibir actualizaciones sobre tu denuncia"
                      className={inputCls}
                      style={inputStyle("emailDenunciante")}
                      maxLength={120}
                    />
                  </div>
                </div>
              )}

              {/* Consentimientos obligatorios */}
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.declaraVeracidad}
                    onChange={e => set("declaraVeracidad", e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--pf-brand)] mt-0.5 shrink-0"
                  />
                  <span className="text-xs" style={{ color: "var(--pf-text-body)" }}>
                    <strong>Declaro que la información es verídica</strong> y entiendo que presentar una denuncia falsa puede tener consecuencias legales conforme al Art. 211 del Código Penal chileno. <span style={{ color: "var(--pgo-danger)" }}>*</span>
                  </span>
                </label>
                {errores.declaraVeracidad && <p className="text-xs ml-6" style={{ color: "var(--pgo-danger)" }}>{errores.declaraVeracidad}</p>}

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.aceptaTratamientoDatos}
                    onChange={e => set("aceptaTratamientoDatos", e.target.checked)}
                    className="h-4 w-4 rounded accent-[var(--pf-brand)] mt-0.5 shrink-0"
                  />
                  <span className="text-xs" style={{ color: "var(--pf-text-body)" }}>
                    Acepto que mis datos personales sean tratados por {RAZON_SOCIAL}, responsable de {MARCA}, para gestionar esta denuncia, conforme a la <strong>Ley 21.719</strong> de protección de datos personales. <span style={{ color: "var(--pgo-danger)" }}>*</span>
                  </span>
                </label>
                {errores.aceptaTratamientoDatos && <p className="text-xs ml-6" style={{ color: "var(--pgo-danger)" }}>{errores.aceptaTratamientoDatos}</p>}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--pgo-danger)" }}
              >
                {isPending ? (
                  <><Spinner />Enviando…</>
                ) : (
                  <><ShieldAlert className="h-4 w-4" aria-hidden />Enviar denuncia</>
                )}
              </button>

              <p className="text-[11px] text-center" style={{ color: "var(--pf-text-light)" }}>
                Esta denuncia será evaluada por nuestro equipo. Las denuncias graves pueden derivarse a las autoridades competentes (SERNAC, Carabineros, Ministerio Público).
              </p>
            </form>
          )}
    </Modal>
  );
}
