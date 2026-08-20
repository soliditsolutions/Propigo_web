"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Send, Loader2, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cantidad, plural } from "@/lib/format";

interface Comentario {
  id:           string;
  texto:        string;
  usuarioNombre: string;
  createdAt:    Date | string;
  documentos:   { id: string; nombre: string }[];
}

interface Props {
  contratoId:  string;
  comentarios: Comentario[];
}

function fechaLabel(d: Date | string): string {
  return new Date(d).toLocaleDateString("es-CL", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function ComentariosCorredorSection({ contratoId, comentarios }: Props) {
  const router           = useRouter();
  const { show: toast }  = useToast();
  const [isPending, start] = useTransition();
  const [texto, setTexto]  = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    start(async () => {
      const res = await fetch(`/api/panel/contratos/${contratoId}/comentarios`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ texto: texto.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error ?? "Error al enviar el comentario.", "error");
        return;
      }
      toast("Comentario enviado. El arrendatario recibirá un correo con el aviso.", "success");
      setTexto("");
      router.refresh();
    });
  }

  return (
    <div
      className="mb-6 overflow-hidden rounded-2xl"
      style={{ background: "var(--hw-surface)", border: "1px solid var(--hw-border)", boxShadow: "var(--hw-shadow)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--hw-border)", background: "var(--hw-surface-2)" }}
      >
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          <MessageSquare className="h-4 w-4" aria-hidden />
          Mensajes al arrendatario
        </h2>
        {comentarios.length > 0 && (
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--hw-primary-lt)", color: "var(--hw-primary)" }}>
            {comentarios.length}
          </span>
        )}
      </div>

      {/* Historial */}
      {comentarios.length > 0 ? (
        <div className="divide-y" style={{ borderColor: "var(--hw-border)" }}>
          {comentarios.map(c => {
            const abierto = expanded.has(c.id);
            return (
              <div key={c.id}>
                <button
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-[var(--hw-surface-2)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--hw-text-3)" }}>{c.usuarioNombre}</span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--hw-text-4)" }}>{fechaLabel(c.createdAt)}</span>
                    </div>
                    {!abierto && (
                      <p className="text-sm truncate mt-0.5" style={{ color: "var(--hw-text-2)" }}>{c.texto}</p>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 mt-0.5 transition-transform ${abierto ? "rotate-180" : ""}`} style={{ color: "var(--hw-text-4)" }} aria-hidden />
                </button>
                {abierto && (
                  <div className="px-5 pb-3">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--hw-text-2)" }}>{c.texto}</p>
                    {c.documentos.length > 0 && (
                      <p className="mt-2 text-xs" style={{ color: "var(--hw-text-4)" }}>
                        {cantidad(c.documentos.length, "documento", "documentos")}{" "}
                        {plural(c.documentos.length, "adjunto", "adjuntos")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-4 text-sm" style={{ color: "var(--hw-text-4)" }}>
          Sin mensajes enviados aún.
        </div>
      )}

      {/* Formulario nuevo comentario */}
      <form
        onSubmit={handleSubmit}
        className="px-5 py-4 space-y-3"
        style={{ borderTop: "1px solid var(--hw-border)", background: "var(--hw-surface-2)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--hw-text-4)" }}>
          Nuevo mensaje para el arrendatario
        </p>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribe un mensaje informativo, instrucción o recordatorio para el arrendatario…"
          rows={3}
          maxLength={2000}
          className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none outline-none transition-colors focus:border-[var(--hw-primary)]"
          style={{ borderColor: "var(--hw-border)", color: "var(--hw-text-1)", background: "var(--hw-surface)" }}
          disabled={isPending}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--hw-text-4)" }}>{texto.length}/2000</span>
          <button
            type="submit"
            disabled={isPending || !texto.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--hw-primary)" }}
          >
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Enviando…</>
              : <><Send className="h-4 w-4" aria-hidden />Enviar mensaje</>}
          </button>
        </div>
        <p className="text-xs" style={{ color: "var(--hw-text-4)" }}>
          El arrendatario recibirá un correo con el aviso y podrá ver el mensaje en su portal.
        </p>
      </form>
    </div>
  );
}
