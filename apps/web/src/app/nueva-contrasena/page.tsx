import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { prisma }        from "@/lib/db";
import { hashToken }     from "@/lib/token";
import { NuevaContrasenaForm } from "./nueva-form";
import { InvalidDialog }       from "./invalid-dialog";

export const metadata: Metadata = {
  title: "Nueva contraseña — Housing",
};

export default async function NuevaContrasenaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Validar token en page load — da feedback inmediato al usuario
  let invalidMensaje: string | null = null;

  if (!token) {
    invalidMensaje = "No se proporcionó un enlace de recuperación.";
  } else {
    const tokenHash = await hashToken(token);
    const resetToken = await prisma.resetToken.findFirst({
      where: {
        tokenHash,
        usadoEn:   null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!resetToken) {
      invalidMensaje =
        "El enlace de recuperación expiró o ya se usó. Solicita uno nuevo.";
    }
  }

  return (
    <>
      {/* Layout de dos paneles — siempre visible como fondo contextual */}
      <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--hw-page)" }}>

        {/* Fondo aurora boreal a pantalla completa (decorativo) */}
        <div className="hw-aurora-layer" aria-hidden="true" />

        <div className="relative z-10 flex min-h-screen">

        {/* ── Panel izquierdo — branding (oculto en mobile) ── */}
        <aside
          className="hw-auth-aside hidden lg:flex flex-col justify-between w-[420px] xl:w-[480px] shrink-0 p-10"
          aria-hidden="true"
        >
          <div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-2xl font-bold tracking-tight"
                style={{ color: "var(--hw-sidebar-text)" }}
              >
                Housing
              </span>
              <span
                className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                SOLIDIT
              </span>
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--hw-sidebar-muted)" }}>
              Panel del corredor
            </p>

            <div
              className="mt-10 mb-8"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            />

            <h1
              className="text-3xl font-bold leading-snug tracking-tight"
              style={{ color: "var(--hw-sidebar-text)" }}
            >
              Define una nueva{" "}
              <span style={{ color: "var(--hw-primary-bd)" }}>
                contraseña segura.
              </span>
            </h1>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--hw-sidebar-muted)" }}>
              Elige una frase larga y única. Las frases son más seguras que las
              contraseñas cortas con caracteres especiales.
            </p>

            <div
              className="mt-8 rounded-xl px-4 py-4 space-y-2"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,0.50)" }}
              >
                Ejemplo de frase segura
              </p>
              <p className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.80)" }}>
                &ldquo;café azul montaña 2026 gato&rdquo;
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
                Fácil de recordar · Difícil de adivinar
              </p>
            </div>
          </div>

          <div>
            <div className="mb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
              style={{
                background: "rgba(255,255,255,0.06)",
                color:      "rgba(255,255,255,0.40)",
              }}
            >
              <ShieldCheck
                className="h-3.5 w-3.5 shrink-0"
                style={{ color: "var(--hw-success)" }}
              />
              Ley 21.719 · Protección de datos personales · Chile
            </div>
          </div>
        </aside>

        {/* ── Panel derecho — formulario o vacío si hay error ── */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          {!invalidMensaje && token && (
            <div className="w-full max-w-sm">

              {/* Logo mobile */}
              <div className="mb-8 flex items-baseline gap-2 lg:hidden">
                <span
                  className="text-xl font-bold tracking-tight"
                  style={{ color: "var(--hw-text-1)" }}
                >
                  Housing
                </span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--hw-text-4)" }}
                >
                  SOLIDIT
                </span>
              </div>

              <div className="mb-8">
                <h2
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "var(--hw-text-1)" }}
                >
                  Nueva contraseña
                </h2>
                <p className="mt-1 text-sm" style={{ color: "var(--hw-text-3)" }}>
                  Define una contraseña nueva y segura para tu cuenta.
                </p>
              </div>

              <div className="hw-auth-card p-6">
                <NuevaContrasenaForm token={token} />
              </div>
            </div>
          )}
        </main>
        </div>
      </div>

      {/* Dialog popup — aparece sobre el layout cuando el enlace es inválido */}
      {invalidMensaje && <InvalidDialog mensaje={invalidMensaje} />}
    </>
  );
}
