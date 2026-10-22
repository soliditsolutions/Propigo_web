"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BorderGlow } from "@/components/ui/border-glow";
import { PLANS, precioUf, type Plan, type PlanFeature } from "@/lib/plans";

/**
 * Precio en UF, siempre con 2 decimales y coma decimal (convención chilena):
 * "0,50 UF", no "0,5 UF". Es un precio — mostrar un decimal en un plan y dos
 * en otro se lee como descuido, y "0,5" invita a leerlo mal de reojo.
 */
function formatearUf(valor: number): string {
  return valor.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const POLICIES = [
  {
    title: "Derecho de Retracto (garantía de 10 días)",
    text: "En cumplimiento con la ley del consumidor de Chile, si contratas cualquiera de nuestros planes (mensual o anual) tienes un plazo de 10 días corridos desde la fecha de pago para arrepentirte de la compra, siempre que no hayas hecho un uso intensivo y exhaustivo de las herramientas del plan (por ejemplo, agotar los tokens de IA diarios de manera masiva). Te reembolsamos el 100% de tu dinero sin hacer preguntas.",
  },
  {
    title: "Cancelación sin ataduras",
    text: "Puedes cancelar la renovación automática de tu suscripción en cualquier momento directamente desde tu panel de control. No hay multas ni plazos forzosos adicionales.",
  },
  {
    title: "Término de la suscripción (planes mensuales)",
    text: "Si cancelas después de los primeros 10 días, tu cuenta sigue activa con los beneficios del plan pagado hasta que finalice tu ciclo de facturación actual. No se realizan reembolsos proporcionales por los días no utilizados de ese mes.",
  },
  {
    title: "Planes anuales",
    text: "Si contrataste un plan anual y solicitas la cancelación posterior al período legal de 10 días de retracto, no se emiten reembolsos parciales por los meses restantes. Mantienes tu acceso al plan contratado hasta que se cumpla el año completo pagado.",
  },
];

function PolicyList() {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-[var(--pf-text-body)]">
        En cumplimiento con la Ley N° 19.496 sobre Protección de los Derechos
        de los Consumidores (SERNAC), estas son las reglas que aplican a
        todas nuestras suscripciones.
      </p>
      <dl className="space-y-4">
        {POLICIES.map((p) => (
          <div key={p.title}>
            <dt className="text-sm font-semibold text-[var(--pf-navy)]">{p.title}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-[var(--pf-text-body)]">{p.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ── Tooltip CSS-only (hover + focus) para la jerga de las features ────────
   Sin librería: un botón de ícono accesible por teclado y un panel absoluto
   que aparece con group-hover / group-focus-within. Vive hacia ARRIBA de la
   línea para no chocar con el borde inferior de la card. */
function FeatureTip({ feature }: { feature: PlanFeature }) {
  if (!feature.tooltip) return null;
  return (
    <span className="group/tip relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={`Más información sobre: ${feature.text}`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full opacity-50 outline-none transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--pf-brand)]"
      >
        <Info className="h-3 w-3" aria-hidden="true" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-48 -translate-x-1/2 rounded-lg px-2.5 py-2 text-left text-[10px] font-normal leading-snug opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
        style={{
          background: "var(--pf-surface)",
          border: "1px solid var(--pf-border)",
          color: "var(--pf-text-body)",
        }}
      >
        {feature.tooltip}
      </span>
    </span>
  );
}

/* ── Card individual de plan ─────────────────────────────────────────────── */
function PlanCard({
  plan,
  billing,
  onSelect,
}: {
  plan: Plan;
  billing: "mensual" | "anual";
  onSelect: (plan: Plan) => void;
}) {
  const precio = precioUf(plan, billing);
  return (
    <BorderGlow radius={20} className="h-full">
    <div
      className="pgo-auth-card relative flex h-full w-full flex-col p-4 text-left transition-shadow duration-200 hover:shadow-xl"
      // El plan destacado lleva un anillo púrpura + halo (Decoy Effect): el
      // ring va por box-shadow y no por border para seguir el radio de 20px
      // que .pgo-auth-card ya define, sin desalinear esquinas.
      style={
        plan.featured
          ? {
              boxShadow:
                "0 0 0 1.5px var(--pf-brand), 0 18px 44px -18px color-mix(in srgb, var(--pf-brand) 60%, transparent)",
            }
          : undefined
      }
    >
      {plan.featured && (
        <span
          className="absolute -top-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md"
          style={{ background: "var(--pf-brand)" }}
        >
          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
          <span className="pgo-shiny-text">Más popular</span>
        </span>
      )}

      <h3 className="text-base font-bold text-[var(--pf-navy)]">{plan.name}</h3>
      <p className="mt-1 min-h-[2.6rem] text-[11px] leading-snug text-[var(--pf-text-muted)]">
        {plan.tagline}
      </p>

      <div className="mt-2 flex items-baseline gap-1">
        {/* key={billing} re-monta el span al alternar el toggle y dispara la
            animación .pgo-price-swap (ver globals.css). */}
        <span
          key={billing}
          className="pgo-num pgo-price-swap text-2xl font-bold text-[var(--pf-navy)] lg:text-[27px]"
        >
          {formatearUf(precio)} UF
        </span>
        <span className="text-[11px] text-[var(--pf-text-muted)]">
          /{billing === "mensual" ? "mes" : "año"} + IVA
        </span>
      </div>
      {/* Slot de alto fijo: el badge de ahorro aparece solo en anual, pero el
          espacio se reserva siempre para que las cards no salten de alto. */}
      <div className="mt-1 h-[18px]">
        {billing === "anual" && (
          <span
            className="pgo-price-swap inline-flex rounded-full px-2 py-px text-[10px] font-semibold"
            style={{ background: "var(--pgo-success-lt)", color: "var(--pgo-success)" }}
          >
            {plan.annualSavings}
          </span>
        )}
      </div>

      <ul className="mt-2.5 space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--pf-border)" }}>
        {plan.features.map((f) => (
          <li
            key={f.text}
            className="flex items-center gap-1.5 text-[11px] leading-snug text-[var(--pf-text-body)]"
          >
            <Check className="h-3 w-3 shrink-0" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
            <span className="min-w-0 flex-1">{f.text}</span>
            <FeatureTip feature={f} />
          </li>
        ))}
      </ul>

      <Button
        size="sm"
        variant={plan.featured ? undefined : "outline"}
        // --pf-brand-btn, no --pf-brand: mismo motivo que el CTA del hero
        // (page.tsx) — texto blanco sobre --pf-brand da 3.62:1 en oscuro,
        // bajo el 4.5:1 de AA.
        className={`pgo-sheen mt-auto w-full ${plan.featured ? "bg-[var(--pf-brand-btn)]" : ""}`}
        onClick={() => onSelect(plan)}
      >
        Elegir {plan.name}
      </Button>
    </div>
    </BorderGlow>
  );
}

type ModalState = { mode: "info" } | { mode: "accept"; plan: Plan } | null;

/**
 * Contenido de la parada "Nuestros Planes" del escenario walkthrough —
 * pricing cards (4 columnas en desktop, apiladas en mobile) con el plan Gold
 * destacado, toggle Mensual/Anual con animación de precio, tooltips para la
 * jerga (slots / tokens IA) y banner de garantía como cierre de confianza.
 *
 * Restricción de diseño: en modo fijado la parada vive en un frame de 100vh
 * (~610px útiles bajo el navbar en un laptop), así que todo el bloque está
 * presupuestado en alto — subtítulos con min-h para alinear cards, slot de
 * ahorro reservado (sin saltos al alternar el toggle) y explicaciones largas
 * en tooltips en vez de líneas extra. La política de cancelación/reembolso
 * vive en un modal que hay que aceptar antes de "Elegir {plan}", y también
 * se puede consultar libre desde el banner de garantía.
 */
export function PlanesStop() {
  const router = useRouter();
  const [billing, setBilling] = useState<"mensual" | "anual">("mensual");
  const [modal, setModal] = useState<ModalState>(null);
  const [accepted, setAccepted] = useState(false);

  function openAccept(plan: Plan) {
    setAccepted(false);
    setModal({ mode: "accept", plan });
  }

  function confirmAndContinue() {
    setModal(null);
    router.push("/registro");
  }

  return (
    <div id="planes-card" className="pgo-walk-panel mx-auto w-full max-w-5xl p-5 sm:p-6 lg:max-w-6xl xl:max-w-7xl">
      <div className="text-center">
        <h2 className="text-balance text-2xl font-bold tracking-tight text-[var(--pf-navy)] sm:text-3xl">
          Un plan para cada etapa de{" "}
          <span className="pf-headline-accent">tu negocio</span>
        </h2>

        <div
          className="mt-3 inline-flex items-center gap-1 rounded-full p-1"
          style={{ background: "var(--pf-brand-tint)" }}
        >
          {(["mensual", "anual"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBilling(b)}
              aria-pressed={billing === b}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition-all lg:px-4"
              style={{
                background: billing === b ? "var(--pf-brand-btn)" : "transparent",
                color:      billing === b ? "#fff" : "var(--pf-text-muted)",
              }}
            >
              {b}
              {b === "anual" && (
                <span
                  className="rounded-full px-1.5 py-px text-[9px] font-bold normal-case"
                  style={
                    billing === "anual"
                      ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                      : { background: "var(--pgo-success-lt)", color: "var(--pgo-success)" }
                  }
                >
                  2 meses gratis
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* pt-2.5 deja aire para el badge "Más popular" que sobresale de Gold. */}
      <div className="mt-3 grid gap-3 pt-2.5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} billing={billing} onSelect={openAccept} />
        ))}
      </div>

      {/* Banner de confianza — garantía legal siempre visible, con acceso a
          la política completa (mismo modal informativo de siempre). */}
      <div
        className="mt-4 flex flex-col items-center gap-2 rounded-xl px-4 py-2.5 text-center sm:flex-row sm:gap-3 sm:text-left"
        style={{ background: "var(--pf-brand-tint)" }}
      >
        <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
        <p className="text-[11px] leading-snug text-[var(--pf-text-body)] lg:text-xs">
          <strong className="font-semibold text-[var(--pf-navy)]">
            Prueba sin riesgo: garantía de 10 días.
          </strong>{" "}
          Cumplimos con la Ley Pro Consumidor (Chile): tienes 10 días de
          retracto con reembolso del 100% si la plataforma no se adapta a ti, y
          puedes cancelar en cualquier momento sin amarras.{" "}
          <button
            type="button"
            onClick={() => setModal({ mode: "info" })}
            className="font-medium underline-offset-2 hover:underline"
            style={{ color: "var(--pf-brand)" }}
          >
            Ver política completa
          </button>
        </p>
      </div>

      {modal?.mode === "info" && (
        <Modal
          onClose={() => setModal(null)}
          title="Política de cancelación y reembolso"
          icon={<ShieldCheck className="h-5 w-5" style={{ color: "var(--pf-brand)" }} aria-hidden="true" />}
        >
          <PolicyList />
        </Modal>
      )}

      {modal?.mode === "accept" && (
        <Modal
          onClose={() => setModal(null)}
          title="Antes de continuar"
          subtitle={`Plan ${modal.plan.name}`}
          icon={<ShieldCheck className="h-5 w-5" style={{ color: "var(--pf-brand)" }} aria-hidden="true" />}
        >
          <PolicyList />
          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl p-3" style={{ background: "var(--pf-brand-tint)" }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--pf-brand)]"
            />
            <span className="text-sm text-[var(--pf-navy)]">
              He leído y acepto la política de cancelación y reembolso.
            </span>
          </label>
          <Button
            size="lg"
            disabled={!accepted}
            onClick={confirmAndContinue}
            // --pf-brand-btn: mismo motivo que los otros CTA de esta parada.
            className="pgo-sheen mt-4 w-full bg-[var(--pf-brand-btn)]"
          >
            Continuar con {modal.plan.name}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Modal>
      )}
    </div>
  );
}

