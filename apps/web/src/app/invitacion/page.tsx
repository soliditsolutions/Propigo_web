import type { Metadata } from "next";
import { prisma }        from "@/lib/db";
import { hashToken }     from "@/lib/token";
import { titulo } from "@/lib/marca";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { T } from "@/components/acceso/textos";
import { InvitacionForm, InvitacionInvalida } from "./invitacion-form";

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
    invalidMensaje = T.invitacion.sinToken;
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
      invalidMensaje = T.invitacion.vencida;
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
    <MarcoGuiado flujo="invitacion">
      {token && !invalidMensaje
        ? <InvitacionForm token={token} nombre={nombre} email={email} empresa={empresa} />
        : <InvitacionInvalida mensaje={invalidMensaje ?? T.invitacion.sinToken} />}
    </MarcoGuiado>
  );
}
