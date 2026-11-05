import Link from "next/link";
import { HousePlus } from "lucide-react";
import { EstadoPagina, ESTADO_BTN_PRIMARIO } from "@/components/ui/estado-pagina";

/** Un aviso compartido que ya se arrendó o se despublicó es el caso más común. */
export default function PublicacionNoEncontrada() {
  return (
    <EstadoPagina
      icono={HousePlus}
      titulo="Esta propiedad ya no está publicada"
      descripcion={<p>Puede que ya se haya arrendado o que el corredor la haya retirado. Revisa otras propiedades disponibles.</p>}
      acciones={
        <Link href="/marketplace" className={ESTADO_BTN_PRIMARIO}>
          Ver propiedades disponibles
        </Link>
      }
    />
  );
}
