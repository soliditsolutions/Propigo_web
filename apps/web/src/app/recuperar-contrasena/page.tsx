import type { Metadata } from "next";
import { RecuperarForm } from "./recuperar-form";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { titulo } from "@/lib/marca";

export const metadata: Metadata = {
  title: titulo("Recuperar contraseña"),
};

export default function RecuperarContrasenaPage() {
  return (
    <MarcoGuiado flujo="recuperar">
      <RecuperarForm />
    </MarcoGuiado>
  );
}
