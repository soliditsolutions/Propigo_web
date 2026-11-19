import type { Metadata } from "next";
import Link from "next/link";
import { RegistroForm } from "./registro-form";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { T } from "@/components/acceso/textos";
import { CORREO, titulo } from "@/lib/marca";
import { registroAbierto } from "@/lib/registro-abierto";

// Se decide en cada petición: sin esto Next prerenderiza la página en el build y
// REGISTRO_ABIERTO del servidor en marcha nunca se leería.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: titulo("Crear cuenta"),
};

export default function RegistroPage() {
  if (!registroAbierto()) {
    return (
      <MarcoGuiado flujo="pronto">
        <div className="pgo-acc-cuerpo">
          <hgroup className="pgo-acc-cabecera">
            <h1 className="pgo-acc-titulo">{T.pronto.titulo}</h1>
            <p className="pgo-acc-sub">
              {T.pronto.sub} <a href={`mailto:${CORREO.soporte}`} className="pgo-acc-enlace">{CORREO.soporte}</a>.
            </p>
          </hgroup>
          <p className="pgo-acc-centrado">
            {T.registro.yaTienes} <Link href="/login" className="pgo-acc-enlace">{T.registro.entrar}</Link>
          </p>
        </div>
      </MarcoGuiado>
    );
  }

  // El formulario trae su propio marco: la ruta de pasos del panel sigue al paso actual.
  return <RegistroForm />;
}
