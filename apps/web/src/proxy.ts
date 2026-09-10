/**
 * Proxy de protección de rutas (Next.js 16 — antes "middleware").
 *
 * Capas de seguridad:
 *  1. Sesión JWT válida para /panel/* y /verificar-dispositivo
 *  2. Dispositivo confiable verificado para /panel/*
 *     (cookie hw_device debe coincidir con deviceToken embebido en JWT)
 *  3. Sesión JWT portal para /portal/contrato/* (solo lectura)
 *  4. CSP con nonce por request (script-src nonce-based, sin 'unsafe-inline')
 *  5. Caducidad por inactividad y tope absoluto de ambas sesiones
 *
 * El punto 5 vive acá porque un Server Component no puede escribir cookies: la
 * renovación tiene que ocurrir mientras el request todavía se puede responder.
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, signSession, sesionAgotada, COOKIE_NAME, DEVICE_COOKIE_NAME } from "@/lib/auth";
import {
  verifyPortalToken, signPortalSession, sesionPortalAgotada, PORTAL_COOKIE_NAME,
} from "@/lib/portal-auth";
import {
  COOKIE_BASE, PANEL_INACTIVIDAD, PORTAL_INACTIVIDAD, tocaRefrescar,
} from "@/lib/sesion-cookies";

/** Genera un nonce criptográfico aleatorio para CSP por request. */
function generarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

/** Construye el CSP header con el nonce dado. */
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  return [
    "default-src 'self'",
    // 'strict-dynamic' propaga la confianza del nonce a los scripts que este carga
    // 'unsafe-eval' solo en dev (Next.js HMR / Turbopack lo necesita)
    `script-src 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    // Tailwind v4 genera un stylesheet externo; shadcn usa inline styles → 'unsafe-inline' en style-src es el mínimo necesario
    "style-src 'self' 'unsafe-inline'",
    // *.tile.openstreetmap.org: tiles del mapa de ubicación — marketplace
    // público, panel del corredor y portal del arrendatario
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isProd ? "upgrade-insecure-requests" : "",
  ].filter(Boolean).join("; ");
}

/**
 * Corre la ventana de inactividad de la sesión activa y borra la contraria.
 *
 * El `exp` del JWT es lo que hace caducar la sesión sola, así que mantenerla
 * viva es re-firmarla mientras haya navegación. Se re-firma como mucho una vez
 * por minuto (`tocaRefrescar`) para no pagar una firma por cada request.
 *
 * El borrado de la contraria es red de seguridad: los setters de cookie ya la
 * cierran al abrir sesión, pero las sesiones que quedaron abiertas antes de ese
 * cambio siguen en los navegadores y hay que barrerlas.
 */
async function conSesionRenovada(
  res: NextResponse,
  panel: Awaited<ReturnType<typeof verifyToken>>,
  portal: Awaited<ReturnType<typeof verifyPortalToken>>,
): Promise<NextResponse> {
  if (panel) {
    res.cookies.set(PORTAL_COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 });
    if (tocaRefrescar(panel)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se excluyen de `rest`, no se usan
      const { iat: _iat, exp: _exp, ...rest } = panel;
      res.cookies.set(COOKIE_NAME, await signSession(rest), {
        ...COOKIE_BASE, maxAge: PANEL_INACTIVIDAD,
      });
    }
  }

  if (portal) {
    res.cookies.set(COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 });
    if (tocaRefrescar(portal)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se excluyen de `rest`, no se usan
      const { iat: _iat, exp: _exp, ...rest } = portal;
      res.cookies.set(PORTAL_COOKIE_NAME, await signPortalSession(rest), {
        ...COOKIE_BASE, maxAge: PORTAL_INACTIVIDAD,
      });
    }
  }

  return res;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token        = request.cookies.get(COOKIE_NAME)?.value;
  const session      = token ? await verifyToken(token) : null;

  // Generar nonce para CSP y propagarlo como request header (legible por Server Components via headers())
  const nonce = generarNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Helper: respuesta NextResponse.next() con nonce propagado.
  // CSP solo en producción — en dev Turbopack y React necesitan eval() sin restricciones.
  function nextWithNonce(): NextResponse {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    if (process.env.NODE_ENV === "production") {
      res.headers.set("Content-Security-Policy", buildCsp(nonce));
    }
    return res;
  }

  // ── Páginas públicas de auth ─────────────────────────────────────────────
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/registro") ||
    pathname.startsWith("/recuperar-contrasena") ||
    pathname.startsWith("/invitacion");

  if (isAuthPage && session) {
    if (session.deviceToken) {
      return NextResponse.redirect(new URL("/panel", request.url));
    }
    return NextResponse.redirect(new URL("/verificar-dispositivo", request.url));
  }

  // ── Página de verificación de dispositivo ────────────────────────────────
  if (pathname === "/verificar-dispositivo") {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.deviceToken) {
      const deviceCookie = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
      if (deviceCookie && deviceCookie === session.deviceToken) {
        return NextResponse.redirect(new URL("/panel", request.url));
      }
    }
    return nextWithNonce();
  }

  // ── Rutas del panel ──────────────────────────────────────────────────────
  if (pathname.startsWith("/panel")) {
    // Sin sesión, o con una que ya superó su tope absoluto. El JWT caducado por
    // inactividad ya llega como `session === null` desde verifyToken.
    if (!session || sesionAgotada(session)) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      if (token) response.cookies.set(COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 });
      return response;
    }

    const isPerfilPage = pathname.startsWith("/panel/perfil");
    if (!isPerfilPage && session.perfilCompleto === false) {
      return NextResponse.redirect(new URL("/panel/perfil?setup=1", request.url));
    }

    // ADR-0013 (cuentas multi-usuario) — /panel/equipo es exclusiva del
    // Manager. session.rol viaja en el JWT firmado, no requiere consulta a BD.
    if (pathname.startsWith("/panel/equipo") && session.rol !== "manager") {
      return NextResponse.redirect(new URL("/panel", request.url));
    }

    // /panel/corredora edita datos de facturación de la empresa (giro, domicilio,
    // cuenta bancaria); es del Manager, igual criterio que Equipo.
    if (pathname.startsWith("/panel/corredora") && session.rol !== "manager") {
      return NextResponse.redirect(new URL("/panel", request.url));
    }

    // ADR-0013 (Fase D) — Estadísticas es business intelligence de cartera
    // completa (turnover, retención, comparables de mercado); no se recorta
    // por propiedad asignada, así que es exclusiva del Manager, igual que Equipo.
    if (pathname.startsWith("/panel/estadisticas") && session.rol !== "manager") {
      return NextResponse.redirect(new URL("/panel", request.url));
    }

    const deviceCookie = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
    const jwtDevice    = session.deviceToken;

    if (!jwtDevice || !deviceCookie || deviceCookie !== jwtDevice) {
      return NextResponse.redirect(new URL("/verificar-dispositivo", request.url));
    }
  }

  // ── Portal de autoconsulta — /portal/contrato/* ─────────────────────────
  if (pathname.startsWith("/portal/contrato")) {
    const portalToken   = request.cookies.get(PORTAL_COOKIE_NAME)?.value;
    const portalSession = portalToken ? await verifyPortalToken(portalToken) : null;
    if (!portalSession || sesionPortalAgotada(portalSession)) {
      const response = NextResponse.redirect(new URL("/portal", request.url));
      if (portalToken) response.cookies.set(PORTAL_COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 });
      return response;
    }
    return await conSesionRenovada(nextWithNonce(), null, portalSession);
  }

  return await conSesionRenovada(nextWithNonce(), session, null);
}

export const config = {
  matcher: [
    "/panel/:path*",
    "/verificar-dispositivo",
    "/login/:path*", "/login",
    "/registro",
    "/recuperar-contrasena",
    "/invitacion",
    "/portal/contrato/:path*",
  ],
};
