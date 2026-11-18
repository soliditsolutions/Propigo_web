import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewAcceso } from "./preview-acceso";

/** Vista previa de diseño de las pantallas de acceso. Solo existe fuera de producción. */
export const metadata: Metadata = {
  title: "Vista previa de acceso — Propigo",
  robots: { index: false, follow: false },
};

export default async function PreviewAccesoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  return <PreviewAcceso inicial={{ e: q.e, f: q.f, s: q.s, p: q.p, barra: q.barra }} />;
}
