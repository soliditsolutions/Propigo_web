import Link from "next/link";
import { SearchX } from "lucide-react";
import { EstadoPagina, ESTADO_BTN_PRIMARIO } from "@/components/ui/estado-pagina";

/** Dentro del menú del panel: contratos o propiedades que no existen o no son de la corredora. */
export default function PanelNotFound() {
  return (
    <EstadoPagina
      variante="panel"
      icono={SearchX}
      titulo="No encontramos lo que buscas"
      descripcion={<p>Puede que el enlace esté incompleto, que se haya eliminado o que no pertenezca a tu corredora.</p>}
      acciones={
        <Link href="/panel" className={ESTADO_BTN_PRIMARIO}>
          Ir al resumen
        </Link>
      }
    />
  );
}
