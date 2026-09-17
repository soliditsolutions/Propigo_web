"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, ShieldCheck, ChevronDown, Check } from "lucide-react";

const STORAGE_KEY = "hw_tos_v2";

export function TerminosAviso() {
  const [visible,  setVisible]  = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [closing,  setClosing]  = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Mostrar solo si no se ha aceptado antes
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) queueMicrotask(() => setVisible(true));
    } catch {
      queueMicrotask(() => setVisible(true));
    }
  }, []);

  // Listener nativo de scroll — funciona tanto con scroll real como programático
  const checkScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32) {
      setScrolled(true);
    }
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !visible) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll(); // por si el contenido cabe sin scroll
    return () => el.removeEventListener("scroll", checkScroll);
  }, [visible, checkScroll]);

  function handleAccept() {
    if (!scrolled) return;
    try { localStorage.setItem(STORAGE_KEY, new Date().toISOString()); } catch { /* */ }
    setClosing(true);
    setTimeout(() => setVisible(false), 320);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tos-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(10, 37, 64, 0.65)",
        opacity:    closing ? 0 : 1,
        transition: "opacity 320ms ease",
      }}
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden lg:max-w-2xl xl:max-w-3xl"
        style={{
          background:   "var(--hw-surface)",
          borderRadius: "20px",
          boxShadow:    "var(--hw-shadow-3)",
          maxHeight:    "min(760px, 92dvh)",
          transform:    closing ? "scale(0.96) translateY(8px)" : "scale(1) translateY(0)",
          transition:   "transform 320ms cubic-bezier(0.16,1,0.3,1), opacity 320ms ease",
        }}
      >
        {/* ── Cabecera ─────────────────────────────────────────── */}
        <div
          className="flex shrink-0 flex-col gap-2 px-7 pt-7 pb-5"
          style={{ borderBottom: "1px solid var(--hw-border)" }}
        >
          {/* Badge de aviso */}
          <div
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: "var(--hw-warning-lt)",
              color:      "var(--hw-warning)",
              border:     "1px solid var(--hw-warning-bd)",
            }}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Antes de continuar
          </div>

          <h2
            id="tos-modal-title"
            className="text-xl font-bold leading-snug"
            style={{ color: "var(--hw-text-1)" }}
          >
            Términos de uso y aviso anti-fraude
          </h2>
          <p className="text-sm" style={{ color: "var(--hw-text-3)" }}>
            Lea el siguiente aviso y acéptelo para acceder al marketplace.
          </p>
        </div>

        {/* ── Cuerpo scrolleable ───────────────────────────────── */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-7 py-5"
          style={{ scrollBehavior: "smooth" }}
        >
          {/* Bloque 1: Carácter intermediario */}
          <Section title="Plataforma intermediaria">
            <p>
              Housing SOLIDIT conecta corredores de propiedades con potenciales arrendatarios.{" "}
              <strong>No es parte de ningún contrato de arrendamiento</strong>, no administra
              dinero y no garantiza la disponibilidad ni el estado de las propiedades publicadas.
            </p>
          </Section>

          {/* Bloque 2: Advertencias anti-fraude */}
          <Section title="Alerta de fraudes — léalo con atención">
            <ul className="space-y-3">
              {[
                ["Nunca transfiera dinero", "antes de visitar la propiedad presencialmente y firmar un contrato notarial o simple."],
                ["No entregue documentos", "(cédula de identidad, liquidaciones de sueldo) sin tener un contrato previo firmado."],
                ["Desconfíe de precios muy bajos", "para la zona — es la señal más común de estafa. Verifique el valor de mercado."],
                ["Housing SOLIDIT nunca solicita pagos", "directamente a través de la plataforma ni a cuentas bancarias de personas naturales."],
                ["Ante sospechas, denuncie", "a la PDI (134), Carabineros (133) o SERNAC (800 700 100)."],
              ].map(([bold, rest]) => (
                <li key={bold as string} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "var(--hw-warning-lt)", color: "var(--hw-warning)" }}
                    aria-hidden
                  >
                    !
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: "var(--hw-text-2)" }}>
                    <strong style={{ color: "var(--hw-text-1)" }}>{bold}</strong>{" "}{rest}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Bloque 3: Responsabilidad */}
          <Section title="Limitación de responsabilidad">
            <p>
              Conforme al <span className="font-semibold">artículo 16 de la Ley 19.496</span>{" "}
              de Protección al Consumidor, Housing SOLIDIT no asume responsabilidad por actos
              fraudulentos de terceros ni por perjuicios derivados de negociaciones realizadas
              fuera de los canales certificados de la plataforma.
            </p>
            <p className="mt-3">
              Al aceptar estos términos usted declara haber leído las advertencias anteriores y
              acepta actuar con la diligencia que exige el{" "}
              <span className="font-semibold">artículo 1546 del Código Civil</span> (buena fe
              contractual). Puede leer los términos completos en{" "}
              <Link
                href="/terminos-uso"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
                style={{ color: "var(--pf-purple)" }}
              >
                /terminos-uso
              </Link>.
            </p>
          </Section>

          {/* Bloque 4: Marco legal */}
          <div
            className="mt-1 mb-4 flex flex-wrap items-center gap-2"
            style={{ borderTop: "1px solid var(--hw-border)", paddingTop: "16px" }}
          >
            {["Ley 19.496", "Ley 21.719", "Ley 18.101", "Código Civil", "Chile 2026"].map((t) => (
              <span
                key={t}
                className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: "var(--hw-primary-lt)",
                  color:      "var(--hw-primary)",
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* ── Indicador de scroll ────────────────────────────────
              `sticky` (no `absolute`) y DENTRO del propio div scrolleable:
              así se ancla siempre al borde inferior del viewport visible
              del scroll, cualquiera sea la altura real del contenido. Un
              offset fijo en px medido desde el diálogo completo (versión
              anterior) no se adaptaba a mobile, donde el texto envuelve en
              muchas más líneas y el indicador terminaba flotando sobre
              contenido todavía sin leer. */}
          {!scrolled && (
            <div
              className="pointer-events-none sticky inset-x-0 bottom-0 flex flex-col items-center gap-1 pb-1 pt-4 sm:pt-9"
              style={{
                // El texto de la etiqueta necesita quedar sobre fondo 100%
                // opaco (no solo "hacia" opaco) o el párrafo de abajo se
                // transparenta a través de ella y las dos capas de texto se
                // leen mezcladas. Por eso el degradé se resuelve a opaco
                // ANTES del final de la caja (60%), dejando toda la franja
                // donde vive la etiqueta+chevron sólida; el fade real ocurre
                // solo en el padding-top de arriba, sobre texto que de
                // todas formas está por perderse de vista al hacer scroll.
                background: "linear-gradient(to top, var(--hw-surface) 0%, var(--hw-surface) 60%, transparent 100%)",
              }}
            >
              <span className="text-xs font-medium" style={{ color: "var(--hw-text-3)" }}>
                Desplácese para leer todo
              </span>
              <ChevronDown
                className="h-4 w-4 animate-bounce"
                style={{ color: "var(--hw-text-4)" }}
                aria-hidden
              />
            </div>
          )}
        </div>

        {/* ── Pie de acciones ──────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-between gap-4 px-7 py-5"
          style={{ borderTop: "1px solid var(--hw-border)" }}
        >
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--hw-text-4)" }}>
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--pf-success-check)" }} aria-hidden />
            Ley 21.719 · Datos protegidos
          </div>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!scrolled}
            aria-describedby={!scrolled ? "tos-scroll-hint" : undefined}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            style={{
              background: scrolled ? "var(--hw-primary)" : "var(--hw-surface-2)",
              color:      scrolled ? "#fff" : "var(--hw-text-4)",
              cursor:     scrolled ? "pointer" : "not-allowed",
              boxShadow:  scrolled ? "var(--hw-glow-primary)" : "none",
            }}
          >
            {scrolled && <Check className="h-4 w-4" aria-hidden />}
            {scrolled ? "Acepto y continúo" : "Lea el aviso completo"}
          </button>
        </div>
        {!scrolled && (
          <p
            id="tos-scroll-hint"
            className="sr-only"
          >
            Debe desplazarse hasta el final del aviso antes de poder aceptar.
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3
        className="mb-2.5 text-sm font-bold uppercase tracking-wider"
        style={{ color: "var(--hw-text-3)", letterSpacing: "0.06em" }}
      >
        {title}
      </h3>
      <div className="text-sm leading-relaxed" style={{ color: "var(--hw-text-2)" }}>
        {children}
      </div>
    </div>
  );
}
