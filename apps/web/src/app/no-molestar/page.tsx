import { NoMolestarForm } from "./no-molestar-form";
import { contextoBaja } from "./actions";
import { titulo } from "@/lib/marca";

export const dynamic = "force-dynamic";

export const metadata = {
  title: titulo("Dejar de recibir avisos"),
  // Un enlace de baja no debe indexarse ni aparecer en un buscador.
  robots: { index: false, follow: false },
};

/**
 * Baja de notificaciones desde el enlace del pie de un correo (art. 28 B de
 * la Ley 19.496). Ruta pública sin sesión: la autorización es el token
 * firmado que viene en la URL.
 */
export default async function NoMolestarPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const ctx = t ? await contextoBaja(t) : { ok: false as const };

  return (
    <main className="pgo-page-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pgo-auth-card w-full max-w-md rounded-2xl p-6 sm:p-8">
        {!t || !ctx.ok ? (
          <div className="space-y-3 text-center">
            <h1 className="text-xl font-bold" style={{ color: "var(--pgo-text-1)" }}>
              Este enlace no es válido
            </h1>
            <p className="text-sm" style={{ color: "var(--pgo-text-3)" }}>
              Puede haber sido cortado al copiarlo. Busca el enlace{" "}
              <strong>Darte de baja aquí</strong> al final de cualquier aviso que te hayamos enviado.
            </p>
          </div>
        ) : (
          <NoMolestarForm token={t} nombre={ctx.nombre} corredora={ctx.corredora} />
        )}
      </div>
    </main>
  );
}
