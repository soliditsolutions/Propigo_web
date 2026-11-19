import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import VerificarForm from "./verificar-form";
import { titulo } from "@/lib/marca";

export const metadata = { title: titulo("Verificar dispositivo") };

export default async function VerificarDispositivoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Si ya tiene deviceToken en el JWT, redirigir al panel
  if (session.deviceToken) redirect("/panel");

  return <VerificarForm email={session.email} />;
}
