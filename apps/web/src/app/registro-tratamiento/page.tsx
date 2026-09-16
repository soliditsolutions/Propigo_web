/**
 * /registro-tratamiento — Registro de Actividades de Tratamiento (L-DP8, Ley 21.719).
 *
 * Se publica en vez de guardarlo solo para una auditoría: es la manera más
 * simple de mantenerlo cierto —una sola versión, no una interna y otra que se
 * entrega si la piden— y de que cualquiera, incluida la Agencia de Protección
 * de Datos, pueda verificarlo en cualquier momento.
 *
 * El contenido sale de `lib/registro-tratamiento.ts`: los plazos de
 * retención los resuelve `RETENCIONES` (la misma fuente que aplica la purga),
 * así que no pueden decir algo distinto de lo que el sistema realmente borra.
 */
import Link from "next/link";
import { ClipboardList, Database, Users, Globe, Clock, ShieldCheck } from "lucide-react";
import { PublicNavbar } from "@/components/public/PublicNavbar";
import { ACTIVIDADES_TRATAMIENTO, retencionesDe } from "@/lib/registro-tratamiento";

export const metadata = {
  title: "Registro de Actividades de Tratamiento · Housing SOLIDIT",
  description:
    "Registro de actividades de tratamiento de datos personales de Housing SOLIDIT, conforme a la Ley 21.719: qué datos, con qué finalidad, con quién se comparten y por cuánto tiempo.",
};

const ULTIMA_ACTUALIZACION = "10 de septiembre de 2026";

export default function RegistroTratamientoPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--pf-surface)" }}>
      <PublicNavbar />

      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-8 flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
          >
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--pf-navy)", letterSpacing: "-0.01em" }}>
              Registro de Actividades de Tratamiento
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--pf-text-light)" }}>
              Ley 21.719, Título IV · Última actualización: {ULTIMA_ACTUALIZACION}
            </p>
          </div>
        </div>

        <p className="mb-8 text-base leading-relaxed" style={{ color: "var(--pf-text-body)" }}>
          Por cada actividad en la que tratamos datos personales: qué datos, de quién, con qué
          base legal, con quién se comparten (si con alguien) y por cuánto tiempo se conservan.
          Es el detalle operativo de lo que resume{" "}
          <Link href="/privacidad" style={{ color: "var(--pf-purple)", fontWeight: 500 }}>
            la Política de Privacidad
          </Link>.
        </p>

        <div className="space-y-5">
          {ACTIVIDADES_TRATAMIENTO.map((a) => {
            const retenciones = retencionesDe(a);
            return (
              <div
                key={a.actividad}
                className="rounded-2xl p-5"
                style={{ background: "var(--pf-page)", border: "1px solid var(--pf-border)" }}
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-base font-bold" style={{ color: "var(--pf-navy)" }}>{a.actividad}</h2>
                  <span
                    className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{ background: "var(--pf-purple-tint)", color: "var(--pf-purple)" }}
                  >
                    {a.baseLegal}
                  </span>
                </div>
                <p className="mb-4 text-sm" style={{ color: "var(--pf-text-body)" }}>{a.finalidad}</p>

                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-light)" }}>
                      <Database className="h-3.5 w-3.5" aria-hidden="true" /> Datos
                    </dt>
                    <dd className="text-sm" style={{ color: "var(--pf-text-body)" }}>
                      <ul className="space-y-0.5">
                        {a.categoriasDatos.map((d) => <li key={d}>{d}</li>)}
                      </ul>
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-light)" }}>
                      <Users className="h-3.5 w-3.5" aria-hidden="true" /> Titulares
                    </dt>
                    <dd className="text-sm" style={{ color: "var(--pf-text-body)" }}>{a.categoriasTitulares.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-light)" }}>
                      <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Destinatarios
                    </dt>
                    <dd className="text-sm" style={{ color: "var(--pf-text-body)" }}>
                      {a.destinatarios ? (
                        <ul className="space-y-0.5">{a.destinatarios.map((d) => <li key={d}>{d}</li>)}</ul>
                      ) : "Ninguno fuera de Housing SOLIDIT."}
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--pf-text-light)" }}>
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Retención
                    </dt>
                    <dd className="text-sm" style={{ color: "var(--pf-text-body)" }}>
                      {retenciones.length > 0 ? (
                        <ul className="space-y-0.5">
                          {retenciones.map((r) => (
                            <li key={r.clave}>{r.categoria}: {r.periodo}{r.fundamento ? ` (${r.fundamento})` : ""}</li>
                          ))}
                        </ul>
                      ) : "Mientras dure el servicio contratado; ver los plazos generales en Privacidad §4."}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>

        <div
          className="mt-8 rounded-2xl p-6 text-sm"
          style={{ background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}
        >
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" style={{ color: "var(--pf-purple)" }} aria-hidden="true" />
            <span className="font-semibold" style={{ color: "var(--pf-navy)" }}>Medidas de seguridad, en toda actividad</span>
          </div>
          <ul className="space-y-1" style={{ color: "var(--pf-text-body)" }}>
            <li>Aislamiento multi-tenant a nivel de fila (RLS): una corredora no puede leer ni escribir los datos de otra.</li>
            <li>Cifrado en tránsito (TLS) y en reposo.</li>
            <li>Contraseñas y códigos de un solo uso con hash irreversible — nunca en texto claro.</li>
          </ul>
          <p className="mt-4 text-xs" style={{ color: "var(--pf-text-light)" }}>
            No tratamos datos sensibles en los términos del art. 16 de la Ley 21.719 (salud, origen
            étnico, opiniones políticas, etc.). Puede ejercer sus derechos sobre estos datos desde{" "}
            <Link href="/privacidad#derechos" style={{ color: "var(--pf-purple)" }}>la sección de derechos de la Política de Privacidad</Link>
            {" "}o, si es arrendatario o propietario, desde{" "}
            <Link href="/portal" style={{ color: "var(--pf-purple)" }}>el portal de autoconsulta → Mis datos</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
