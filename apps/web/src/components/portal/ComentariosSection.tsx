"use client";

import { MessageSquare, FileText, Download, ChevronDown } from "lucide-react";
import { useState } from "react";

interface DocAdjunto {
  id:     string;
  nombre: string;
  tipo:   string;
}

interface Comentario {
  id:           string;
  texto:        string;
  usuarioNombre: string;
  createdAt:    string;
  documentos:   DocAdjunto[];
}

interface Props {
  comentarios: Comentario[];
}

function fechaRelativa(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ComentariosSection({ comentarios }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([comentarios[0]?.id ?? ""]));

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--pgo-surface)", border: "1px solid var(--pgo-border)", boxShadow: "var(--pgo-shadow)" }}
    >
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--pgo-border)" }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>
          <MessageSquare className="h-4 w-4" aria-hidden />
          Mensajes del corredor
        </h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ background: "var(--pgo-primary-lt)", color: "var(--pgo-primary)" }}
        >
          {comentarios.length}
        </span>
      </div>

      {/* Lista */}
      {comentarios.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <MessageSquare className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--pgo-text-4)", opacity: 0.4 }} aria-hidden />
          <p className="text-sm" style={{ color: "var(--pgo-text-4)" }}>Sin mensajes del corredor aún.</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--pgo-border)" }}>
          {comentarios.map((c) => {
            const abierto = expanded.has(c.id);
            return (
              <div key={c.id}>
                {/* Encabezado del comentario */}
                <button
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--pf-surface)]"
                  aria-expanded={abierto}
                >
                  {/* Avatar */}
                  <div
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: "var(--pgo-primary)", color: "#fff" }}
                    aria-hidden
                  >
                    {c.usuarioNombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold" style={{ color: "var(--pgo-text-1)" }}>
                        {c.usuarioNombre}
                      </span>
                      <span className="shrink-0 text-xs" style={{ color: "var(--pgo-text-4)" }}>
                        {fechaRelativa(c.createdAt)}
                      </span>
                    </div>
                    {!abierto && (
                      <p className="mt-0.5 text-xs truncate" style={{ color: "var(--pgo-text-3)" }}>
                        {c.texto}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${abierto ? "rotate-180" : ""}`}
                    style={{ color: "var(--pgo-text-4)" }}
                    aria-hidden
                  />
                </button>

                {/* Cuerpo expandido */}
                {abierto && (
                  <div className="px-5 pb-4" style={{ paddingLeft: "calc(20px + 28px + 12px)" }}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--pgo-text-2)" }}>
                      {c.texto}
                    </p>

                    {/* Documentos adjuntos */}
                    {c.documentos.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pgo-text-4)" }}>
                          Documentos adjuntos
                        </p>
                        {c.documentos.map(doc => (
                          <a
                            key={doc.id}
                            href={`/api/portal/documento/${doc.id}`}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--pf-surface)]"
                            style={{ background: "var(--pgo-surface-2)", color: "var(--pgo-primary)" }}
                            download
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="flex-1 truncate" style={{ color: "var(--pgo-text-2)" }}>{doc.nombre}</span>
                            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
