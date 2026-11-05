/**
 * POST /api/auth/logout
 * Cierre de sesión completo:
 * 1. Elimina la cookie de sesión del servidor.
 * 2. Responde con Clear-Site-Data para limpiar cookies/storage/cache del navegador.
 * 3. Redirige a /login.
 *
 * Ref doc: "Tabla 3 — Clear-Site-Data para Cierre de Sesión Seguro"
 * Ref doc: "Testing de Reuso de Identificadores (OWASP)"
 */
import { NextResponse } from "next/server";
import { COOKIE_NAME, DEVICE_COOKIE_NAME } from "@/lib/auth";

function buildLogoutResponse(status: 303 | 307): NextResponse {
  // Location relativa: el navegador la resuelve contra el dominio en que está
  // el usuario. req.url no sirve de base: en el servidor standalone es
  // localhost:PUERTO aunque la petición llegue por propigo.cl, y detrás de un
  // proxy mandaba a https://localhost:3100/login.
  const response = new NextResponse(null, { status, headers: { Location: "/login" } });

  // 1. Eliminar ambas cookies de sesión explícitamente
  const cookieOpts = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path:     "/",
    maxAge:   0,
  };
  response.cookies.set(COOKIE_NAME,        "", cookieOpts);
  response.cookies.set(DEVICE_COOKIE_NAME, "", cookieOpts);

  // 2. Clear-Site-Data — limpia cookies + storage + cache en el navegador cliente
  response.headers.set(
    "Clear-Site-Data",
    '"cookies", "storage", "cache"',
  );

  return response;
}

export async function POST() {
  // El redirect 303 garantiza que el browser procesa Set-Cookie ANTES de navegar,
  // eliminando la race-condition con window.location.href en el cliente.
  return buildLogoutResponse(303);
}

// GET — usado por redirect() desde Server Components (p.ej. panel/layout.tsx
// cuando detecta un Usuario desactivado, ADR-0013). Un Server Component no
// puede mutar cookies directamente («Cookies can only be modified in a Server
// Action or Route Handler»); redirigir aquí es el único lugar donde SÍ se
// puede limpiar la cookie de sesión antes de mandar al usuario a /login —
// sin esto, el JWT (firma válida, stateless) seguiría pasando el chequeo de
// sesión del proxy y lo rebotaría de vuelta a /panel en loop infinito.
export async function GET() {
  return buildLogoutResponse(307);
}
