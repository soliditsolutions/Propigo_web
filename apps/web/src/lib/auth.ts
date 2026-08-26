/**
 * Gestión de sesión JWT — firmado con HS256 vía jose.
 * Cookie: __Host-hw_session (prod) / hw_session (dev).
 *
 * Caduca por inactividad (el `exp` del JWT) y tiene además un tope absoluto
 * desde el login. El proxy la renueva mientras haya actividad; los tiempos y el
 * porqué están en `sesion-cookies.ts`.
 *
 * Abrir esta sesión cierra la del portal: son personas distintas y el navegador
 * no puede quedar con dos identidades a la vez.
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import {
  COOKIE_PANEL, COOKIE_PORTAL, COOKIE_DEVICE, COOKIE_BASE,
  PANEL_INACTIVIDAD, PANEL_MAXIMO, superaMaximo,
} from "./sesion-cookies";

export type SessionPayload = JWTPayload & {
  sub:            string; // usuarioId
  tenantId:       string;
  rol:            "manager" | "colaborador";
  nombre:         string;
  email:          string;
  perfilCompleto: boolean;
  deviceToken?:   string; // UUID del dispositivo confiable (en plano — comparado contra hw_device cookie)
  /** Instante del login original. Sobrevive a las renovaciones (ver sesion-cookies). */
  ini?:           number;
};

export const COOKIE_NAME = COOKIE_PANEL;
const SESSION_TTL = PANEL_INACTIVIDAD;

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error("AUTH_SECRET debe tener al menos 32 caracteres.");
  }
  return new TextEncoder().encode(raw);
}

export async function signSession(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({
    ...payload,
    // Si el llamador no trae `ini`, esto es un login nuevo y el tope absoluto
    // empieza a correr ahora.
    ini: payload.ini ?? Math.floor(Date.now() / 1000),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(getSecret());
}

/** True si la sesión agotó su tope absoluto, por mucha actividad que haya habido. */
export function sesionAgotada(session: SessionPayload, ahora = Date.now()): boolean {
  return superaMaximo(session, PANEL_MAXIMO, ahora);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Lee la sesión desde las cookies del request actual (Server Components / Actions). */
export async function getSession(): Promise<SessionPayload | null> {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Escribe la cookie de sesión respetando las directivas de seguridad del doc. */
export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, { ...COOKIE_BASE, maxAge: SESSION_TTL });
  // Entrar como corredor cierra la sesión del portal. Va acá y no en cada
  // pantalla de login para que una entrada nueva no pueda olvidarse.
  jar.set(COOKIE_PORTAL, "", { ...COOKIE_BASE, maxAge: 0 });
}

/** Borra la cookie de sesión (Server Action / API Route). */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 });
}

// ── Dispositivo confiable ────────────────────────────────────────────────────

export const DEVICE_COOKIE_NAME = COOKIE_DEVICE;
const DEVICE_TTL = 365 * 24 * 60 * 60; // 1 año en segundos

/** Escribe la cookie de dispositivo confiable (httpOnly, 1 año). */
export async function setDeviceCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE_NAME, token, { ...COOKIE_BASE, maxAge: DEVICE_TTL });
}

/** Borra la cookie de dispositivo (fuerza re-verificación al próximo login). */
export async function clearDeviceCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(DEVICE_COOKIE_NAME, "", { ...COOKIE_BASE, maxAge: 0 });
}

/** Refresca el JWT embebiendo el deviceToken confirmado. */
export async function refreshSessionWithDevice(
  session: SessionPayload,
  deviceToken: string,
): Promise<string> {
  // `ini` NO se descarta: el tope absoluto cuenta desde el login original,
  // no desde la verificación del dispositivo.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se destructuran para excluirlos de `rest`, no para usarlos
  const { iat: _iat, exp: _exp, ...rest } = session;
  return signSession({ ...rest, deviceToken });
}

/**
 * Versión reforzada de getSession() que además verifica que la cookie hw_device
 * coincida con el deviceToken del JWT. Usar en rutas de gestión de dispositivos
 * para exigir que el propio acceso esté verificado.
 */
export async function getVerifiedSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session?.deviceToken) return null;

  const jar         = await cookies();
  const deviceCookie = jar.get(DEVICE_COOKIE_NAME)?.value;
  if (!deviceCookie || deviceCookie !== session.deviceToken) return null;

  return session;
}
