import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/token";
import { titulo } from "@/lib/marca";
import { MarcoGuiado } from "@/components/acceso/marco-guiado";
import { T } from "@/components/acceso/textos";
import { EnlaceInvalido, NuevaContrasenaForm } from "./nueva-form";

export const metadata: Metadata = {
  title: titulo("Nueva contraseña"),
};

export default async function NuevaContrasenaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Se valida al cargar para avisar de inmediato; la acción vuelve a validar al guardar.
  let invalido: string | null = null;
  if (!token) {
    invalido = T.nueva.sinToken;
  } else {
    const resetToken = await prisma.resetToken.findFirst({
      where: { tokenHash: await hashToken(token), usadoEn: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (!resetToken) invalido = T.nueva.vencido;
  }

  return (
    <MarcoGuiado flujo="nueva">
      {token && !invalido ? <NuevaContrasenaForm token={token} /> : <EnlaceInvalido mensaje={invalido ?? T.nueva.sinToken} />}
    </MarcoGuiado>
  );
}
