import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { prisma }        from "@/lib/db";
import { hashToken }     from "@/lib/token";
import { InvitacionForm } from "./invitacion-form";
import { InvitacionInvalidDialog } from "./invalid-dialog";
import { Logo } from "@/components/public/Logo";
import { MARCA, titulo } from "@/lib/marca";

export const metadata: Metadata = {
  title: titulo("Aceptar invitación"),
};

export default async function InvitacionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let invalidMensaje: string | null = null;
  let nombre = "";
  let email  = "";
  let empresa = "";

  if (!token) {
    invalidMensaje = "No se proporcionó un enlace de invitación.";
  } else {
    const tokenHash  = await hashToken(token);
    const invitacion = await prisma.invitacionColaborador.findFirst({
      where: {
        tokenHash,
        usadoEn:   null,
        expiresAt: { gt: new Date() },
      },
      select: { nombre: true, email: true, invitadoPorId: true },
    });
    if (!invitacion) {
      invalidMensaje = "La invitación expiró o ya se usó. Pide a tu administrador que te reenvíe una nueva.";
    } else {
      nombre = invitacion.nombre;
      email  = invitacion.email;

      // `invitadoPor` (Usuario) está protegido por RLS — no se puede incluir
      // directamente desde este contexto sin sesión/tenant conocido. Se
      // resuelve igual que en actions.ts: la función SECURITY DEFINER
      // auth_tenant_de_usuario() para el tenantId, y `tenant` (sin RLS, es
      // la raíz del tenant) para el nombre a mostrar.
      const tenantRows = await prisma.$queryRaw<{ tenant_id: string | null }[]>`
        SELECT auth_tenant_de_usuario(${invitacion.invitadoPorId}::uuid) AS tenant_id
      `;
      const tenantId = tenantRows[0]?.tenant_id;
      const tenant   = tenantId
        ? await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nombre: true } })
        : null;
      empresa = tenant?.nombre ?? "";
    }
  }

  return (
    <>
      <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--pgo-page)" }}>
        <div className="pgo-aurora-layer" aria-hidden="true" />

        <div className="relative z-10 flex min-h-screen">
          <aside
            className="pgo-auth-aside hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] shrink-0 p-10"
            aria-hidden="true"
          >
            <div>
              <Logo size="lg" wordColor="var(--pgo-sidebar-text)" />
              <p className="mt-1 text-sm" style={{ color: "var(--pgo-sidebar-muted)" }}>
                Panel del corredor
              </p>

              <div className="mt-10 mb-8" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

              <h1 className="text-3xl font-bold leading-snug tracking-tight" style={{ color: "var(--pgo-sidebar-text)" }}>
                Te invitaron a{" "}
                <span style={{ color: "var(--pgo-primary-bd)" }}>colaborar.</span>
              </h1>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--pgo-sidebar-muted)" }}>
                {empresa
                  ? `${empresa} te invitó a gestionar propiedades en ${MARCA}. Define tu contraseña para empezar.`
                  : `Define tu contraseña para empezar a colaborar en ${MARCA}.`}
              </p>
            </div>

            <div>
              <div className="mb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)" }}
              >
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--pgo-success)" }} />
                Ley 21.719 · Protección de datos personales · Chile
              </div>
            </div>
          </aside>

          <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
            {!invalidMensaje && token && (
              <div className="w-full max-w-sm">
                <div className="mb-8 lg:hidden">
                  <Logo size="md" wordColor="var(--pgo-text-1)" />
                </div>

                <div className="mb-8">
                  <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--pgo-text-1)" }}>
                    Hola, {nombre}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: "var(--pgo-text-3)" }}>
                    Define una contraseña para tu cuenta en <strong>{email}</strong>.
                  </p>
                </div>

                <div className="pgo-auth-card p-6">
                  <InvitacionForm token={token} nombre={nombre} email={email} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {invalidMensaje && <InvitacionInvalidDialog mensaje={invalidMensaje} />}
    </>
  );
}
