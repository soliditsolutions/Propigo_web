"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, ArrowLeftRight, CreditCard, Receipt,
  Download, CalendarClock, Building2, Users, Sparkles, X, Loader2,
} from "lucide-react";
import { Card, SectionTitle } from "@/components/panel/ui";
import { useToast } from "@/components/ui/toast";
import { clp } from "@/lib/format";
import { PLANS, desglosarPrecioClp, type Plan } from "@/lib/plans";
import {
  tipoDeCambio, diferenciaUpgradeUf, excedentesParaPlan,
  type ModalidadUpgrade, type Excedente,
} from "@/lib/billing/cambio-plan";
import type { PeriodoDemo } from "@/lib/billing-demo";
import { MARCA } from "@/lib/marca";
import { solicitarCambioPlanAction } from "./plan-actions";
import { useAccionSegura } from "@/components/ui/use-accion-segura";
import { EnlaceDescarga } from "@/components/ui/enlace-descarga";

const RECURSO: Record<Excedente["recurso"], { singular: string; plural: string; accion: string; href: string }> = {
  propiedades: { singular: "propiedad", plural: "propiedades", accion: "Ir a Propiedades", href: "/panel/propiedades" },
  usuarios:    { singular: "usuario",   plural: "usuarios",    accion: "Ir a Equipo",      href: "/panel/equipo" },
};

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
  const [mostrarCambio, setMostrarCambio] = useState(false);
  const [destinoId, setDestinoId] = useState<string | null>(null);
  const [modalidad, setModalidad] = useState<ModalidadUpgrade>("proximo_ciclo");
  const [error, setError] = useState<{ mensaje: string; excedentes?: Excedente[] } | null>(null);
  const [enviada, setEnviada] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();
  const ejecutar = useAccionSegura();

  const otros = PLANS.filter((p) => p.id !== plan.id);
  const destino = otros.find((p) => p.id === destinoId) ?? null;
  const tipo = destino ? tipoDeCambio(plan, destino) : null;
  // Anticipo del gate (el servidor lo vuelve a validar con el uso del momento).
  const excedentes = destino && tipo === "downgrade"
    ? (error?.excedentes ?? excedentesParaPlan(destino, { propiedades: usoPropiedades, usuarios: usoUsuarios }))
    : [];
  const diferencia = destino && tipo === "upgrade" ? diferenciaUpgradeUf(plan, destino) : 0;

  const { totalClp } = desglosarPrecioClp(plan.mensualUf, valorUfClp);

  function elegir(id: string) {
    setDestinoId(id);
    setModalidad("proximo_ciclo");
    setError(null);
    setEnviada(null);
  }

  function cerrar() {
    setMostrarCambio(false);
    setDestinoId(null);
    setError(null);
  }

  function enviar() {
    if (!destino) return;
    setError(null);
    startTransition(async () => {
      const r = await ejecutar(() => solicitarCambioPlanAction({
        destinoId: destino.id,
        modalidad: tipo === "upgrade" ? modalidad : null,
      }));
      if (!r) return;
      if (r.ok) {
        // Confirmación en línea (role=status), no toast: un toast la anunciaría
        // dos veces y desaparecería antes de que se lea.
        setEnviada(r.planDestino);
        setDestinoId(null);
      } else {
        setError({ mensaje: r.error, excedentes: r.excedentes });
      }
    });
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

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4" style={{ borderColor: "var(--pgo-border)" }}>
          <button
            type="button"
            onClick={() => { setMostrarCambio(true); setEnviada(null); }}
            aria-expanded={mostrarCambio}
            aria-controls="cambio-plan"
            className="pgo-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            Cambiar de plan
          </button>
          {enviada && (
            <p role="status" className="flex items-center gap-1.5 text-xs" style={{ color: "var(--pgo-success)" }}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Solicitud de cambio a {enviada} enviada. Soporte te escribirá para confirmarla.
            </p>
          )}
        </div>
      </Card>

      {/* ── Cambio de plan (P-B6 / gate P-B7) ────────────────────────── */}
      {mostrarCambio && (
        <div id="cambio-plan"><Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionTitle title="Elige tu nuevo plan" as="h3" />
            <button type="button" onClick={cerrar} aria-label="Cerrar" className="pgo-btn pgo-tap-target relative rounded-lg p-1.5" style={{ color: "var(--pgo-text-4)" }}>
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div role="radiogroup" aria-label="Plan destino" className="grid gap-3 sm:grid-cols-3">
            {otros.map((p) => {
              const sel = p.id === destinoId;
              const sube = tipoDeCambio(plan, p) === "upgrade";
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => elegir(p.id)}
                  className="pgo-btn rounded-xl p-4 text-left"
                  style={{
                    background: sel ? "var(--pgo-primary-lt)" : "var(--pgo-surface-2)",
                    border: `1px solid ${sel ? "var(--pgo-primary)" : "var(--pgo-border-2)"}`,
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--pgo-text-1)" }}>
                      {p.featured && <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--pgo-primary)" }} aria-hidden="true" />}
                      {p.name}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: sube ? "var(--pgo-success)" : "var(--pgo-text-4)" }}>
                      {sube ? "Subir" : "Bajar"}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs" style={{ color: "var(--pgo-text-4)" }}>{ufFmt(p.mensualUf)} + IVA / mes</span>
                  <span className="mt-2 block text-xs" style={{ color: "var(--pgo-text-3)" }}>
                    Hasta {p.maxPropiedades} propiedades · {p.maxUsuarios === 1 ? "1 usuario" : `${p.maxUsuarios} usuarios`}
                  </span>
                </button>
              );
            })}
          </div>

          {destino && tipo === "upgrade" && (
            <fieldset className="mt-4 space-y-2">
              <legend className="mb-2 text-sm font-semibold" style={{ color: "var(--pgo-text-1)" }}>
                ¿Cuándo empieza {destino.name}?
              </legend>
              {([
                {
                  valor: "proximo_ciclo" as const,
                  titulo: "Desde el próximo ciclo",
                  detalle: `Sigues con ${plan.name} hasta tu día de facturación (día ${diaFacturacion}); después pagas ${ufFmt(destino.mensualUf)} + IVA al mes. Sin cobro adicional ahora.`,
                },
                {
                  valor: "inmediato" as const,
                  titulo: "Ahora mismo",
                  detalle: `Pagas hoy la diferencia del mes completo: ${ufFmt(diferencia)} + IVA (${clp(desglosarPrecioClp(diferencia, valorUfClp).totalClp)} aprox.). Tu día de facturación no cambia.`,
                },
              ]).map((op) => (
                <label
                  key={op.valor}
                  className="flex cursor-pointer gap-3 rounded-xl p-3"
                  style={{ background: "var(--pgo-surface-2)", border: `1px solid ${modalidad === op.valor ? "var(--pgo-primary)" : "var(--pgo-border)"}` }}
                >
                  <input
                    type="radio"
                    name="modalidad-upgrade"
                    value={op.valor}
                    checked={modalidad === op.valor}
                    onChange={() => setModalidad(op.valor)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ accentColor: "var(--pgo-primary)" }}
                  />
                  <span className="text-sm">
                    <span className="block font-semibold" style={{ color: "var(--pgo-text-1)" }}>{op.titulo}</span>
                    <span className="mt-0.5 block text-xs" style={{ color: "var(--pgo-text-3)" }}>{op.detalle}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {destino && tipo === "downgrade" && (
            excedentes.length > 0 ? (
              <div className="mt-4 rounded-xl p-4" style={{ background: "var(--pgo-warning-lt)", border: "1px solid var(--pgo-warning-bd)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--pgo-warning-dk)" }}>
                  Para bajar a {destino.name} primero tienes que liberar cupo
                </p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--pgo-warning-dk)" }}>
                  {MARCA} nunca borra nada por ti: tú decides qué eliminar o desactivar.
                </p>
                <ul className="mt-3 space-y-2">
                  {excedentes.map((e) => {
                    const r = RECURSO[e.recurso];
                    return (
                      <li key={e.recurso} className="flex flex-wrap items-center justify-between gap-2 text-sm" style={{ color: "var(--pgo-text-1)" }}>
                        <span>
                          Tienes <strong className="pgo-num">{e.uso}</strong> {r.plural} y {destino.name} permite {e.max}: sobran{" "}
                          <strong className="pgo-num">{e.sobran}</strong> {e.sobran === 1 ? r.singular : r.plural}.
                        </span>
                        <Link href={r.href} className="pgo-btn rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "var(--pgo-surface)", color: "var(--pgo-primary)" }}>
                          {r.accion}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {excedentes.some((e) => e.recurso === "usuarios") && (
                  <p className="mt-3 text-xs" style={{ color: "var(--pgo-warning-dk)" }}>
                    Las invitaciones pendientes también ocupan cupo de usuario: revócalas en Equipo si no las vas a usar.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-xl p-3 text-sm" style={{ background: "var(--pgo-surface-2)", color: "var(--pgo-text-2)" }}>
                Tu cuenta cabe en {destino.name}. El cambio se aplica al terminar el período que ya pagaste; hasta entonces
                conservas todo lo de {plan.name}.
              </p>
            )
          )}

          {error && !error.excedentes && (
            <p role="alert" className="mt-3 text-sm" style={{ color: "var(--pgo-danger)" }}>{error.mensaje}</p>
          )}

          {destino && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enviar}
                disabled={enviando || excedentes.length > 0}
                className="pgo-btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Solicitar cambio a {destino.name}
              </button>
              <p className="text-xs" style={{ color: "var(--pgo-text-4)" }}>
                Mientras no esté activa la facturación, soporte aplica el cambio y te confirma por correo.
              </p>
            </div>
          )}
        </Card></div>
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
                    <EnlaceDescarga
                      href={`/api/panel/billing/boleta-demo/pdf?periodo=${p.clave}`}
                      className="pgo-btn inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                      style={{ background: "var(--pgo-surface-2)", color: "var(--pgo-text-2)" }}
                      icono={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      PDF
                    </EnlaceDescarga>
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
