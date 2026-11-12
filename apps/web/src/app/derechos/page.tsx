import Link from "next/link";
import { DerechosForm } from "./derechos-form";
import { CORREO, titulo } from "@/lib/marca";
import { PLAZO_RESPUESTA_DIAS } from "@/lib/derechos";

export const metadata = {
  title: titulo("Ejercer mis derechos"),
  description: "Pide acceso, rectificación, supresión, oposición, portabilidad o bloqueo de tus datos personales.",
};

/**
 * Canal público para ejercer los derechos de la Ley 21.719 (L-DP7). Ruta sin
 * sesión: lo usa cualquier titular de datos, tenga o no cuenta.
 */
export default function DerechosPage() {
  return (
    <main className="pgo-page-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pgo-auth-card w-full max-w-xl rounded-2xl p-6 sm:p-8">
        <DerechosForm plazoDias={PLAZO_RESPUESTA_DIAS} correo={CORREO.privacidad} />
        <p className="mt-6 text-center text-xs" style={{ color: "var(--pgo-text-4)" }}>
          <Link href="/privacidad#derechos" className="underline">Cómo tratamos tus datos</Link>
        </p>
      </div>
    </main>
  );
}
