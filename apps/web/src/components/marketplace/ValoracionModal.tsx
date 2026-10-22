"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { Modal, ModalSuccess } from "@/components/ui/modal";

interface Props {
  token:   string;
  onClose: () => void;
}

const ETIQUETAS: Record<number, string> = {
  1: "Muy mala atención",
  2: "Mala atención",
  3: "Regular",
  4: "Buena atención",
  5: "Excelente atención",
};

export function ValoracionModal({ token, onClose }: Props) {
  const { show: toast } = useToast();
  const [isPending, start] = useTransition();
  const [enviada, setEnviada] = useState(false);

  const [estrellas, setEstrellas]   = useState(0);
  const [hover,     setHover]       = useState(0);
  const [comentario, setComentario] = useState("");
  const [errorEst,   setErrorEst]   = useState(false);

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (estrellas < 1) { setErrorEst(true); return; }

    start(async () => {
      try {
        const res  = await fetch("/api/marketplace/valoracion", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token, estrellas, comentario: comentario.trim() || undefined }),
        });
        const data = await res.json();

        if (!res.ok) {
          toast(data.error ?? "Error al enviar la valoración.", "error");
          return;
        }
        setEnviada(true);
      } catch {
        toast("Error de conexión. Intenta nuevamente.", "error");
      }
    });
  }

  const active = hover || estrellas;

  return (
    <Modal
      onClose={onClose}
      title="Valorar al corredor"
      icon={<Star className="h-5 w-5" style={{ fill: "var(--pgo-warning)", color: "var(--pgo-warning)" }} aria-hidden />}
      maxWidth="md"
    >
          {enviada ? (
            <ModalSuccess
              tone="amber"
              title="¡Gracias por tu valoración!"
              message="Tu opinión ayuda a otros usuarios a tomar mejores decisiones."
              onClose={onClose}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <p className="text-sm text-center" style={{ color: "var(--pf-text-body)" }}>
                ¿Cómo fue la atención del corredor?
              </p>

              {/* Estrellas */}
              <div className="flex flex-col items-center gap-2">
                <div
                  className="flex gap-2"
                  role="group"
                  aria-label="Calificación de 1 a 5 estrellas"
                  onMouseLeave={() => setHover(0)}
                >
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
                      onClick={() => { setEstrellas(n); setErrorEst(false); }}
                      onMouseEnter={() => setHover(n)}
                      className="transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--pgo-warning)] rounded"
                    >
                      <Star
                        className="h-9 w-9 transition-colors"
                        style={{
                          color:    n <= active ? "var(--pgo-warning)" : "var(--pf-border-input)",
                          fill:     n <= active ? "var(--pgo-warning)" : "transparent",
                        }}
                      />
                    </button>
                  ))}
                </div>

                {active > 0 && (
                  <p className="text-sm font-medium transition-all" style={{ color: "var(--pgo-warning)" }}>
                    {ETIQUETAS[active]}
                  </p>
                )}
                {errorEst && (
                  <p className="text-xs" style={{ color: "var(--pgo-danger)" }}>Selecciona una calificación</p>
                )}
              </div>

              {/* Comentario opcional */}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--pf-navy)" }}>
                  Comentario <span className="font-normal" style={{ color: "var(--pf-text-light)" }}>(opcional)</span>
                </label>
                <textarea
                  value={comentario}
                  onChange={e => setComentario(e.target.value)}
                  placeholder="Cuéntanos más sobre tu experiencia con el corredor…"
                  rows={4}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--pf-brand)] focus:shadow-[0_0_0_3px_var(--pf-brand-tint)]"
                  style={{ borderColor: "var(--pf-border-input)", background: "var(--pf-surface)", color: "var(--pf-navy)", resize: "none" }}
                  maxLength={500}
                />
                <p className="mt-1 text-right text-xs" style={{ color: "var(--pf-text-light)" }}>{comentario.length}/500</p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--pgo-warning)" }}
              >
                {isPending ? (
                  <><Spinner />Enviando…</>
                ) : (
                  <><Star className="h-4 w-4 fill-white" aria-hidden />Enviar valoración</>
                )}
              </button>
            </form>
          )}
    </Modal>
  );
}
