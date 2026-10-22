"use client";

import { useState } from "react";
import {
  AlertTriangle, CheckCircle2, ArrowUpCircle, CreditCard, Receipt,
  Download, CalendarClock, Building2, Users, Sparkles, X,
} from "lucide-react";
import { Card, SectionTitle } from "@/components/panel/ui";
import { useToast } from "@/components/ui/toast";
import { clp } from "@/lib/format";
import { PLANS, desglosarPrecioClp, type Plan } from "@/lib/plans";
import type { PeriodoDemo } from "@/lib/billing-demo";
import { MARCA } from "@/lib/marca";

function ufFmt(n: number): string {
  return `${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`;
}

function BarraUso({ label, uso, max, icon: Icon }: { label: string; uso: number; max: number; icon: typeof Building2 }) {
  const pct = max > 0 ? Math.min(100, Math.round((uso / max) * 100)) : 0;
  const critico = pct >= 90;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--pgo-text-2)" }}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
        </span>
        <span className="pgo-num font-semibold" style={{ color: critico ? "var(--pgo-danger)" : "var(--pgo-text-2)" }}>
          {uso} / {max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--pgo-border)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: critico ? "var(--pgo-danger)" : "var(--pgo-primary)" }}
        />
      </div>
    </div>
  );
}

export function MiPlanSection({
  tenantNombre,
  plan,
  usoPropiedades,
  maxPropiedades,
  usoUsuarios,
  maxUsuarios,
  valorUfClp,
  diaFacturacion,
  historial,
}: {
  tenantNombre: string;
  plan: Plan;
  usoPropiedades: number;
  maxPropiedades: number;
  usoUsuarios: number;
  maxUsuarios: number;
  valorUfClp: number;
  diaFacturacion: number;
  historial: PeriodoDemo[];
}) {
  const { show: toast } = useToast();
  const [mostrarUpgrade, setMostrarUpgrade] = useState(false);

  const indice = PLANS.findIndex((p) => p.id === plan.id);
  const superiores = indice >= 0 ? PLANS.slice(indice + 1) : [];
  const puedeSubir = superiores.length > 0;

  const { totalClp } = desglosarPrecioClp(plan.mensualUf, valorUfClp);

  function solicitarUpgrade(destino: Plan) {
    setMostrarUpgrade(false);
    toast(
      `Solicitud enviada: cambio a ${destino.name}. Te contactaremos para coordinar el cobro — el cambio de plan todavía no es automático.`,
      "success",
    );
  }

  return (
    <div className="space-y-5">
      {/* Aviso — imposible de pasar por alto: nada de lo que sigue en
          Facturación/Historial/Boletas es un cobro real todavía. */}
      <div
        className="flex gap-3 rounded-xl p-4"
        style={{ background: "var(--pgo-warning-lt)", border: "1px solid var(--pgo-warning-bd)" }}
      >
        <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "var(--pgo-warning)" }} aria-hidden="true" />
        <div className="text-sm" style={{ color: "var(--pgo-warning-dk)" }}>
          <p className="font-semibold">Datos de ejemplo</p>
          <p className="mt-0.5">
            {MARCA} todavía no tiene una pasarela de pago conectada para cobrar tu
            suscripción. El plan y el uso de arriba son reales; el método de pago,
            el historial y las boletas de más abajo son una vista previa de cómo
            se verán cuando la facturación esté activa — ningún cobro descrito acá
            ocurrió de verdad.
          </p>
        </div>
      </div>

      {/* ── Plan actual (real) ──────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {/* SectionTitle.description es para una línea corta (va inline,
                junto al título) — el tagline del plan es una oración larga,
                así que va aparte, en su propio párrafo que sí puede wrappear. */}
            <SectionTitle title="Tu plan actual" />
            <p className="-mt-2 max-w-sm text-xs" style={{ color: "var(--pgo-text-4)" }}>{plan.tagline}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold pgo-num" style={{ color: "var(--pgo-primary)" }}>{plan.name}</p>
            <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
              {ufFmt(plan.mensualUf)} + IVA / mes · {clp(totalClp)} aprox.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <BarraUso label="Propiedades" uso={usoPropiedades} max={maxPropiedades} icon={Building2} />
          <BarraUso label="Usuarios del equipo" uso={usoUsuarios} max={maxUsuarios} icon={Users} />
        </div>

        <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
          {plan.features.map((f) => (
            <li key={f.text} className="flex items-start gap-1.5 text-xs" style={{ color: "var(--pgo-text-2)" }}>
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--pgo-success)" }} aria-hidden="true" />
              {f.text}
            </li>
          ))}
        </ul>

        {puedeSubir && (
          <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--pgo-border)" }}>
            <button
              type="button"
              onClick={() => setMostrarUpgrade(true)}
              className="pgo-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
              Subir de plan
            </button>
          </div>
        )}
      </Card>

      {/* ── Selector de upgrade ─────────────────────────────────────── */}
      {mostrarUpgrade && puedeSubir && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle title="Elige el plan al que quieres subir" as="h3" />
            <button type="button" onClick={() => setMostrarUpgrade(false)} aria-label="Cerrar" className="pgo-btn rounded-lg p-1.5" style={{ color: "var(--pgo-text-4)" }}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {superiores.map((p) => (
              <div key={p.id} className="rounded-xl p-4" style={{ background: "var(--pgo-surface-2)", border: "1px solid var(--pgo-border-2)" }}>
                <p className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--pgo-text-1)" }}>
                  {p.featured && <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--pgo-primary)" }} aria-hidden="true" />}
                  {p.name}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--pgo-text-4)" }}>{ufFmt(p.mensualUf)} + IVA / mes</p>
                <p className="mt-2 text-xs" style={{ color: "var(--pgo-text-3)" }}>
                  Hasta {p.maxPropiedades} propiedades · {p.maxUsuarios === 1 ? "1 usuario" : `${p.maxUsuarios} usuarios`}
                </p>
                <button
                  type="button"
                  onClick={() => solicitarUpgrade(p)}
                  className="pgo-btn-primary mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  Solicitar cambio a {p.name}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Facturación (ejemplo) ───────────────────────────────────── */}
      <Card className="p-5">
        <SectionTitle title="Facturación" description="Ejemplo — la pasarela real todavía no está conectada." />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl p-3" style={{ background: "var(--pgo-surface-2)" }}>
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Próximo cobro
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-1)" }}>
              Día {diaFacturacion} de cada mes · {clp(totalClp)}
            </p>
          </div>
          <div className="rounded-xl p-3" style={{ background: "var(--pgo-surface-2)" }}>
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--pgo-text-3)" }}>
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> Método de pago
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-sm" style={{ color: "var(--pgo-text-1)" }}>Visa •••• 4242 · vence 08/28</p>
              <button
                type="button"
                onClick={() => toast("Próximamente: podrás actualizar tu método de pago desde acá.", "success")}
                className="pgo-btn shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold"
                style={{ background: "var(--pgo-surface)", color: "var(--pgo-primary)" }}
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Historial de pagos y boletas (ejemplo) ─────────────────── */}
      <Card className="p-5">
        <SectionTitle title="Historial de pagos y boletas" description="Ejemplo — para que veas cómo se verá tu historial real." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: "var(--pgo-text-4)" }}>
                <th className="pb-2 font-semibold">Período</th>
                <th className="pb-2 font-semibold">Monto</th>
                <th className="pb-2 font-semibold">Estado</th>
                <th className="pb-2 font-semibold text-right">Boleta</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((p) => (
                <tr key={p.clave} className="border-t" style={{ borderColor: "var(--pgo-border)" }}>
                  <td className="py-2" style={{ color: "var(--pgo-text-1)" }}>{p.label}</td>
                  <td className="py-2 pgo-num" style={{ color: "var(--pgo-text-1)" }}>{clp(p.totalClp)}</td>
                  <td className="py-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{ background: "var(--pgo-success-lt)", color: "var(--pgo-success)" }}
                    >
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Pagado
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <a
                      href={`/api/panel/billing/boleta-demo/pdf?periodo=${p.clave}`}
                      className="pgo-btn inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                      style={{ background: "var(--pgo-surface-2)", color: "var(--pgo-text-2)" }}
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" /> PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs" style={{ color: "var(--pgo-text-4)" }}>
          <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
          Cada PDF dice &ldquo;documento de ejemplo&rdquo; en el encabezado — no es una boleta ni factura válida ante el SII.
        </p>
      </Card>

      <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
        Cuenta: {tenantNombre}
      </p>
    </div>
  );
}
