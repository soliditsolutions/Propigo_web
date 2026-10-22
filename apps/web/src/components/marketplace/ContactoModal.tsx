"use client";

import { useState, useTransition } from "react";
import { Send } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Modal, ModalSuccess, modalInputCls, modalInputStyle } from "@/components/ui/modal";

interface Props {
  publicacionId: string;
  tituloPub:     string;
  onClose:       () => void;
}

type Paso = "formulario" | "exito";

export function ContactoModal({ publicacionId, tituloPub, onClose }: Props) {
  const { show: toast } = useToast();
  const [isPending, start] = useTransition();
  const [paso, setPaso]   = useState<Paso>("formulario");

  const [form, setForm] = useState({
    nombre:        "",
    apellido:      "",
    telefono:      "",
    email:         "",
    titulo:        "",
    descripcion:   "",
    quiereContacto: true,
    viaEmail:      true,
    viaTelefono:   false,
  });

  const [errores, setErrores] = useState<Partial<Record<keyof typeof form, string>>>({});

  function set(field: keyof typeof form, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrores(prev => ({ ...prev, [field]: undefined }));
  }

  function validar(): boolean {
    const e: Partial<Record<keyof typeof form, string>> = {};
    if (!form.nombre.trim())        e.nombre       = "Requerido";
    if (!form.apellido.trim())      e.apellido     = "Requerido";
    if (form.telefono.trim().length < 8) e.telefono = "Teléfono inválido";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Correo electrónico inválido";
    if (!form.titulo.trim())        e.titulo       = "Requerido";
    if (form.descripcion.trim().length < 10) e.descripcion = "Mínimo 10 caracteres";
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validar()) return;

    start(async () => {
      try {
        const res  = await fetch("/api/marketplace/contacto", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ ...form, publicacionId }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast(data.error ?? "Error al enviar. Intenta nuevamente.", "error");
          return;
        }

        setPaso("exito");
      } catch {
        toast("Error de conexión. Intenta nuevamente.", "error");
      }
    });
  }

  const inputCls = modalInputCls;
  const inputStyle = (campo: keyof typeof form) => modalInputStyle(!!errores[campo]);

  return (
    <Modal onClose={onClose} title="Contactar al corredor" subtitle={tituloPub}>
          {paso === "exito" ? (
            <ModalSuccess
              title="¡Consulta enviada!"
              message="El corredor recibirá tu mensaje y se pondrá en contacto usando los canales que indicaste."
              onClose={onClose}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Nombre y Apellido */}
              <div className="grid grid-cols-2 gap-3">
                {(["nombre", "apellido"] as const).map(campo => (
                  <div key={campo}>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                      {campo === "nombre" ? "Nombre" : "Apellido"} <span style={{ color: "var(--pgo-danger)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={form[campo]}
                      onChange={e => set(campo, e.target.value)}
                      placeholder={campo === "nombre" ? "Juan" : "González"}
                      className={inputCls}
                      style={inputStyle(campo)}
                      maxLength={80}
                    />
                    {errores[campo] && <p className="mt-1 text-xs" style={{ color: "var(--pgo-danger)" }}>{errores[campo]}</p>}
                  </div>
                ))}
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Teléfono <span style={{ color: "var(--pgo-danger)" }}>*</span>
                </label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={e => set("telefono", e.target.value)}
                  placeholder="+56 9 1234 5678"
                  className={inputCls}
                  style={inputStyle("telefono")}
                  maxLength={20}
                />
                {errores.telefono && <p className="mt-1 text-xs" style={{ color: "var(--pgo-danger)" }}>{errores.telefono}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Correo electrónico <span style={{ color: "var(--pgo-danger)" }}>*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set("email", e.target.value)}
                  placeholder="tu@correo.cl"
                  className={inputCls}
                  style={inputStyle("email")}
                  maxLength={120}
                />
                {errores.email && <p className="mt-1 text-xs" style={{ color: "var(--pgo-danger)" }}>{errores.email}</p>}
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Título de la consulta <span style={{ color: "var(--pgo-danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={form.titulo}
                  onChange={e => set("titulo", e.target.value)}
                  placeholder="Ej: Consulta sobre fecha de disponibilidad"
                  className={inputCls}
                  style={inputStyle("titulo")}
                  maxLength={120}
                />
                {errores.titulo && <p className="mt-1 text-xs" style={{ color: "var(--pgo-danger)" }}>{errores.titulo}</p>}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Descripción <span style={{ color: "var(--pgo-danger)" }}>*</span>
                </label>
                <textarea
                  value={form.descripcion}
                  onChange={e => set("descripcion", e.target.value)}
                  placeholder="Describe tu consulta con el mayor detalle posible..."
                  rows={4}
                  className={inputCls}
                  style={{ ...inputStyle("descripcion"), resize: "none" }}
                  maxLength={2000}
                />
                <div className="flex justify-between mt-1">
                  {errores.descripcion
                    ? <p className="text-xs" style={{ color: "var(--pgo-danger)" }}>{errores.descripcion}</p>
                    : <span />}
                  <p className="text-xs" style={{ color: "var(--pf-text-light)" }}>{form.descripcion.length}/2000</p>
                </div>
              </div>

              {/* Checkboxes de contacto */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--pf-hero-1)", border: "1px solid var(--pf-border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--pf-navy)" }}>¿Cómo quieres que te contacten?</p>
                {([
                  { key: "viaEmail",    label: "Vía Email" },
                  { key: "viaTelefono", label: "Vía Teléfono" },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={e => set(key, e.target.checked)}
                      className="h-4 w-4 rounded accent-[var(--pf-brand)]"
                    />
                    <span className="text-sm" style={{ color: "var(--pf-text-body)" }}>{label}</span>
                  </label>
                ))}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="pf-btn-primary w-full"
                style={{ padding: "11px 16px", fontSize: "14px", borderRadius: "12px" }}
              >
                {isPending ? (
                  <><Spinner />Enviando…</>
                ) : (
                  <><Send className="h-4 w-4" aria-hidden />Enviar consulta</>
                )}
              </button>

              <p className="text-[11px] text-center" style={{ color: "var(--pf-text-light)" }}>
                Tus datos serán tratados conforme a la Ley 21.719 de protección de datos personales.
              </p>
            </form>
          )}
    </Modal>
  );
}
