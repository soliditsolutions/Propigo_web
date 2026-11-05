import { NextResponse } from "next/server";
import { clearPortalCookie } from "@/lib/portal-auth";

export async function GET() {
  await clearPortalCookie();
  // Location relativa (igual que /api/auth/logout): el navegador la resuelve
  // contra el dominio en que está el usuario. Ni NEXT_PUBLIC_APP_URL (opcional)
  // ni req.url (localhost:PUERTO en el servidor standalone) sirven de base.
  return new NextResponse(null, { status: 307, headers: { Location: "/portal" } });
}
