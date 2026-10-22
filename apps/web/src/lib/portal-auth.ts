/**
 * Gestión de sesión JWT para el Portal de Autoconsulta (ADR-0007).
 * Sesión de solo lectura, separada del sistema de panel.
 * Cookie: __Host-pgo_portal (prod) / pgo_portal (dev).
 *
 * Caduca por inactividad (el `exp` del JWT) y tiene un tope absoluto desde el
 * login; los tiempos y el porqué están en `sesion-cookies.ts`.
 *
 * Abrir esta sesión cierra la del panel: el portal lo usa el arrendatario o el
 * propietario, no el corredor, y el navegador no puede quedar con las dos
 * identidades a la vez.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import {
  COOKIE_PANEL, COOKIE_PORTAL, COOKIE_BASE,
  PORTAL_INACTIVIDAD, PORTAL_MAXIMO, superaMaximo,
} from "./sesion-cookies";

export type PortalPayload = JWTPayload & {
  personaId:   string;
  propiedadId: string;
  tenantId:    string;
  rol:         "arrendatario" | "propietario";
  /** Instante del login original. Sobrevive a las renovaciones. */
  ini?:        number;
};

export const PORTAL_COOKIE_NAME = COOKIE_PORTAL;
const PORTAL_TTL = PORTAL_INACTIVIDAD;

function getPortalSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) throw new Error("AUTH_SECRET demasiado corto");
  // Prefix "portal:" separa este dominio del JWT de panel — misma clave, distinto ámbito
  return new TextEncoder().encode("portal:" + raw);
}

export async function signPortalSession(
  payload: Omit<PortalPayload, "iat" | "exp">,
): Promise<string> {
  return new SignJWT({
    ...payload,
    ini: payload.ini ?? Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_TTL}s`)
    .sign(getPortalSecret());
}

export async function verifyPortalToken(token: string): Promise<PortalPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getPortalSecret(), { algorithms: ["HS256"] });
    return payload as PortalPayload;
  } catch {
    return null;
  }
}

/** True si la sesión agotó su tope absoluto, por mucha actividad que haya habido. */
export function sesionPortalAgotada(session: PortalPayload, ahora = Date.now()): boolean {
  return superaMaximo(session, PORTAL_MAXIMO, ahora);
}

export async function getPortalSession(): Promise<PortalPayload | null> {
  const jar   = await cookies();
  const token = jar.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyPortalToken(token);
}

export async function setPortalCookie(token: string): Promise<void> {
  const jar = await cookies();
  // SEC/FIX: antes iba con `path: "/portal"`. Acotar el alcance suena bien, pero
  // el prefijo `__Host-` exige `Path=/`, así que en producción el navegador
  // habría rechazado la cookie entera y el portal no habría funcionado. En local
  // nunca se vio porque el prefijo solo se usa cuando NODE_ENV es production.
  jar.set(PORTAL_COOKIE_NAME, token, { ...COOKIE_BASE, maxAge: PORTAL_TTL });
  // Entrar al portal cierra la sesión del corredor, por el mismo motivo que a
  // la inversa: son personas distintas compartiendo el mismo navegador.
  jar.set(COOKIE_PANEL, "", { ...COOKIE_BASE, maxAge: 0 });
}

export async function clearPortalCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(PORTAL_COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 });
  // Las sesiones anteriores al cambio de `path` viven en "/portal"; sin este
  // borrado quedarían huérfanas y el navegador seguiría mandándolas.
  jar.set(PORTAL_COOKIE_NAME, "", { ...COOKIE_BASE, path: "/portal", maxAge: 0 });
}
