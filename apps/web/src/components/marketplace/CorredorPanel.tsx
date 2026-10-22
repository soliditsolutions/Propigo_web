"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail, ShieldCheck, Star, MessageSquare, ShieldAlert, ChevronDown,
} from "lucide-react";
import { ContactoModal } from "./ContactoModal";
import { DenunciaModal } from "./DenunciaModal";
import { MARCA } from "@/lib/marca";

/* ──────────────────────────────────────── tipos ── */
interface ValoracionItem {
  id:         string;
  estrellas:  number;
  comentario: string | null;
  createdAt:  string; // ISO string
  nombre:     string;
  apellido:   string;
}

interface ValoracionesData {
  promedio:  number | null;
  total:     number;
  recientes: ValoracionItem[];
}

interface Props {
  publicacionId:  string;
  tituloPub:      string;
  nombreCorredor: string;
  tenantId:       string;
  precioLabel:    string;
  precioPie:      string;
  valoraciones:   ValoracionesData;
}

/* ──────────────────────────────────────── helpers ── */
function StarRow({ valor, total }: { valor: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className="h-4 w-4"
          style={{ color: n <= Math.round(valor) ? "var(--pgo-warning)" : "var(--pf-border-input)", fill: n <= Math.round(valor) ? "var(--pgo-warning)" : "transparent" }}
          aria-hidden
        />
      ))}
      <span className="text-xs font-semibold" style={{ color: "var(--pf-navy)" }}>{valor.toFixed(1)}</span>
      <span className="text-xs" style={{ color: "var(--pf-text-light)" }}>({total})</span>
    </div>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { month: "short", year: "numeric" });
}

/* ──────────────────────────────────────── componente ── */
export function CorredorPanel({
  publicacionId, tituloPub, nombreCorredor, precioLabel, precioPie, valoraciones,
}: Props) {
  type Modal = "contacto" | "denuncia" | null;
  const [abierto,  setAbierto]  = useState<Modal>(null);
  const [verTodas, setVerTodas] = useState(false);

  const { promedio, total, recientes } = valoraciones;
  const mostradas = verTodas ? recientes : recientes.slice(0, 2);

  return (
    <>
      <div className="sticky top-20 space-y-4">

        {/* Precio + contacto */}
        <div className="pf-card p-5">
          <p className="text-2xl font-bold" style={{ color: "var(--pf-brand)", letterSpacing: "-0.01em" }}>
            {precioLabel}
          </p>
          <p className="text-sm" style={{ color: "var(--pf-text-light)" }}>{precioPie}</p>

          {/* Corredor */}
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--pf-border)" }}>
            <p className="text-xs" style={{ color: "var(--pf-text-light)" }}>Publicado por</p>
            <p className="mt-0.5 font-semibold" style={{ color: "var(--pf-navy)" }}>{nombreCorredor}</p>
            <p className="text-xs" style={{ color: "var(--pf-text-light)" }}>Corredor de propiedades</p>
            {promedio !== null && (
              <div className="mt-1.5">
                <StarRow valor={promedio} total={total} />
              </div>
            )}
          </div>

          {/* Botón de contacto */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setAbierto("contacto")}
              className="pf-btn-primary w-full"
              style={{ height: "44px", padding: "0 16px", fontSize: "13px", borderRadius: "10px" }}
            >
              <Mail className="h-4 w-4" aria-hidden />
              Contactar al corredor
            </button>
          </div>

          <p className="mt-3 text-center text-[11px]" style={{ color: "var(--pf-text-light)" }}>
            Visita sin costo · Sin compromiso
          </p>
        </div>

        {/* Valoraciones */}
        {total > 0 && (
          <div className="pf-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" style={{ color: "var(--pf-text-light)" }} aria-hidden />
                <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--pf-text-light)" }}>
                  Valoraciones
                </h3>
              </div>
              {promedio !== null && <StarRow valor={promedio} total={total} />}
            </div>

            <div className="space-y-3">
              {mostradas.map(v => (
                <div
                  key={v.id}
                  className="rounded-xl p-3"
                  style={{ background: "var(--pf-hero-1)", border: "1px solid var(--pf-border)" }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          className="h-3.5 w-3.5"
                          style={{ color: n <= v.estrellas ? "var(--pgo-warning)" : "var(--pf-border-input)", fill: n <= v.estrellas ? "var(--pgo-warning)" : "transparent" }}
                          aria-hidden
                        />
                      ))}
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--pf-text-light)" }}>{formatFecha(v.createdAt)}</span>
                  </div>
                  {v.comentario && (
                    <p className="text-xs leading-relaxed" style={{ color: "var(--pf-text-body)" }}>{v.comentario}</p>
                  )}
                  <p className="mt-1 text-[10px] font-semibold" style={{ color: "var(--pf-text-muted)" }}>
                    {v.nombre} {v.apellido.charAt(0)}.
                  </p>
                </div>
              ))}
            </div>

            {recientes.length > 2 && (
              <button
                type="button"
                onClick={() => setVerTodas(v => !v)}
                className="pgo-tap-target relative flex w-full items-center justify-center gap-1 py-2 text-xs"
                style={{ color: "var(--pf-brand)" }}
              >
                {verTodas ? "Ver menos" : `Ver las ${recientes.length} valoraciones`}
                <ChevronDown className={`h-3 w-3 transition-transform ${verTodas ? "rotate-180" : ""}`} aria-hidden />
              </button>
            )}
          </div>
        )}

        {/* Portal arrendatarios */}
        <div
          className="rounded-2xl border p-4"
          style={{ background: "var(--pf-brand-tint)", borderColor: "color-mix(in srgb, var(--pf-brand) 20%, transparent)" }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--pf-navy)" }}>¿Ya eres arrendatario?</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--pf-text-body)" }}>
            Consulta el estado de tu contrato, pagos y documentos en tu portal personal.
          </p>
          <Link
            href="/portal"
            className="pf-btn-primary mt-3 w-full"
            style={{ height: "44px", padding: "0 16px", fontSize: "12px", borderRadius: "8px" }}
          >
            Ir al portal de arrendatarios
          </Link>
        </div>

        {/* Seguridad + denuncia */}
        <div className="space-y-2">
          <div
            className="flex items-start gap-2 rounded-xl p-3 text-xs"
            style={{ background: "var(--pf-hero-1)", color: "var(--pf-text-muted)" }}
          >
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--pf-success-check)" }} aria-hidden />
            <span>Propiedad gestionada por corredor {MARCA}. Tus datos se tratan conforme a la Ley 21.719.</span>
          </div>
          <button
            type="button"
            onClick={() => setAbierto("denuncia")}
            className="pgo-tap-target relative flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs transition-colors hover:bg-[var(--pgo-danger-lt)]"
            style={{ color: "var(--pgo-danger)" }}
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            Reportar esta publicación o corredor
          </button>
        </div>
      </div>

      {/* ── Modales ── */}
      {abierto === "contacto" && (
        <ContactoModal
          publicacionId={publicacionId}
          tituloPub={tituloPub}
          onClose={() => setAbierto(null)}
        />
      )}

      {abierto === "denuncia" && (
        <DenunciaModal
          publicacionId={publicacionId}
          tituloPub={tituloPub}
          nombreCorredor={nombreCorredor}
          onClose={() => setAbierto(null)}
        />
      )}

    </>
  );
}
