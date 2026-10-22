/**
 * Portal — Mis datos (Ley 21.719).
 *
 * Ejercicio de derechos desde el propio portal, sin depender de un correo a
 * la corredora: rectificación de correo/teléfono (L-DP4) y oposición al
 * tratamiento no esencial (L-DP6). Nombre y RUT no son editables acá — son
 * identidad, se reportan a la corredora (ver `rectificacion-persona.ts`).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { getPortalSession } from "@/lib/portal-auth";
import { withTenant } from "@/lib/tenant-db";
import { MisDatosClient } from "./mis-datos-client";
import { Logo } from "@/components/public/Logo";
import { MARCA } from "@/lib/marca";

export default async function MisDatosPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal");
  const { personaId, tenantId, propiedadId } = session;

  const [persona, preferencia, contrato] = await withTenant(tenantId, async (tx) => Promise.all([
    tx.persona.findFirstOrThrow({
      where: { id: personaId, tenantId },
      select: { nombre: true, rut: true, email: true, telefono: true },
    }),
    tx.preferenciaNotificacion.findUnique({
      where: { tenantId_personaId: { tenantId, personaId } },
      select: { suscrito: true, alcance: true },
    }),
    tx.contrato.findFirst({
      where: {
        tenantId, propiedadId,
        OR: [{ arrendatarioId: personaId }, { propietarioId: personaId }],
        estado: { in: ["vigente", "terminado", "terminado_anticipado"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]));

  return (
    <div className="min-h-screen" style={{ background: "var(--pgo-page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 sm:px-6"
        style={{ background: "var(--pgo-surface)", borderBottom: "1px solid var(--pgo-border)", boxShadow: "0 1px 4px rgba(15,31,53,0.06)" }}
      >
        <div className="flex items-center gap-3">
          {contrato ? (
            <Link
              href={`/portal/contrato/${contrato.id}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[var(--pgo-surface-2)]"
              style={{ color: "var(--pgo-text-3)" }}
              aria-label="Volver a mi contrato"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          <div>
            <Logo size="xs" wordColor="var(--pgo-text-1)" />
            <p className="mt-0.5 text-xs" style={{ color: "var(--pgo-text-4)" }}>Mis datos</p>
          </div>
        </div>
        <a
          href="/api/portal/logout"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--pgo-danger-lt)]"
          style={{ color: "var(--pgo-danger)" }}
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Cerrar sesión
        </a>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--pgo-text-1)" }}>Mis datos personales</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--pgo-text-3)" }}>
            Ejerce tus derechos sobre los datos que {MARCA} guarda de ti, conforme a la Ley 21.719.{" "}
            <a href="/privacidad#derechos" className="underline" style={{ color: "var(--pgo-primary)" }}>Más sobre tus derechos</a>.
          </p>
        </div>

        <MisDatosClient
          nombre={persona.nombre}
          rut={persona.rut}
          email={persona.email}
          telefono={persona.telefono}
          suscrito={preferencia?.suscrito ?? true}
          alcance={preferencia?.alcance ?? "solo_opcionales"}
        />
      </main>
    </div>
  );
}
