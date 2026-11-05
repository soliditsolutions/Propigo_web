import { redirect }    from "next/navigation";
import { getSession }  from "@/lib/auth";
import { prisma }      from "@/lib/db";
import { withTenant }  from "@/lib/tenant-db";
import { PanelShell }  from "@/components/panel/shell";
import { getPlanEfectivo } from "@/lib/plans";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // El middleware ya protege /panel/* pero este check es la defensa en profundidad.
  const session = await getSession();
  if (!session) redirect("/login");

  // ADR-0013 (cuentas multi-usuario) — un Collaborator desactivado debe ser
  // expulsado a /login en su siguiente request, no ver un error crudo. El JWT
  // es stateless, así que esto se valida contra la fila real en cada carga
  // del panel — mismo choke point que ya usa el middleware, único lugar por
  // el que pasan TODAS las páginas de /panel/*. getActor()/getTenant() (usado
  // más abajo en el árbol) hacen el mismo redirect por su cuenta — Next.js
  // ejecuta layout y page en paralelo, así que una page puede ganarle la
  // carrera a este chequeo; este bloque no es la única garantía, es defensa
  // en profundidad redundante con la de getActor().
  //
  // Un Server Component no puede mutar cookies (`clearSessionCookie()`
  // lanzaría "Cookies can only be modified in a Server Action or Route
  // Handler"), y sin limpiar la cookie el proxy seguiría viendo un JWT con
  // firma válida y rebotaría de vuelta a /panel en loop — por eso el
  // redirect va a la ruta GET dedicada que sí puede limpiarla.
  const usuarioActivo = await withTenant(session.tenantId, (tx) => tx.usuario.findUnique({
    where: { id: session.sub }, select: { desactivadoEn: true },
  }));
  if (!usuarioActivo || usuarioActivo.desactivadoEn) {
    redirect("/api/auth/logout");
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where:  { id: session.tenantId },
    select: { nombre: true, plan: true },
  });

  return (
    <PanelShell
      // Nombre del plan que rige, no el id interno ("demo", "Gratuito").
      tenant={{ nombre: tenant.nombre, plan: getPlanEfectivo(tenant.plan).name }}
      user={{ nombre: session.nombre, email: session.email, rol: session.rol }}
    >
      {children}
    </PanelShell>
  );
}
