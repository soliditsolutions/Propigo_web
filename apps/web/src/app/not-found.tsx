import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import {
  EstadoPagina,
  ESTADO_BTN_PRIMARIO,
  ESTADO_BTN_SECUNDARIO,
  ESTILO_BTN_SECUNDARIO,
} from "@/components/ui/estado-pagina";
import { titulo } from "@/lib/marca";

export const metadata: Metadata = { title: titulo("Página no encontrada") };

export default function NotFound() {
  return (
    <EstadoPagina
      icono={SearchX}
      titulo="No encontramos esta página"
      descripcion={<p>El enlace puede estar mal copiado o la página ya no existe.</p>}
      acciones={
        <>
          <Link href="/marketplace" className={ESTADO_BTN_SECUNDARIO} style={ESTILO_BTN_SECUNDARIO}>
            Ver propiedades
          </Link>
          <Link href="/" className={ESTADO_BTN_PRIMARIO}>
            Ir al inicio
          </Link>
        </>
      }
    />
  );
}
