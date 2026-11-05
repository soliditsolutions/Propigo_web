import Link from "next/link";
import { SearchX } from "lucide-react";
import { EstadoPagina, ESTADO_BTN_PRIMARIO } from "@/components/ui/estado-pagina";

export default function PortalNotFound() {
  return (
    <EstadoPagina
      icono={SearchX}
      titulo="No encontramos este contrato"
      descripcion={
        <p>El enlace puede estar incompleto o el contrato no está asociado a tu RUT. Desde el portal ves todos tus contratos.</p>
      }
      acciones={
        <Link href="/portal" className={ESTADO_BTN_PRIMARIO}>
          Volver al portal
        </Link>
      }
    />
  );
}
