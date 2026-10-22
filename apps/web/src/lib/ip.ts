/**
 * Resolución de IP del cliente — centralizada y resistente a spoofing.
 *
 * SEGURIDAD:
 * - `x-forwarded-for` lo arma una cadena: el cliente puede escribir lo que
 *   quiera al inicio, y cada proxy de confianza AGREGA al final la IP de quien
 *   le habló. Por eso la IP real del cliente está a N posiciones del final,
 *   donde N es la cantidad de proxies propios delante de la app:
 *     · solo App Runner (o un balanceador)  → N = 1 → último valor
 *     · CloudFront + App Runner             → N = 2 → penúltimo valor
 *   Tomar el primer valor (o uno más a la izquierda de N) deja al cliente
 *   elegir su IP y saltarse los rate limits.
 * - `x-real-ip` NO se usa: solo es confiable si el borde lo sobrescribe
 *   (Vercel/Cloudflare); en AWS pasa tal cual lo envíe el cliente.
 * - En desarrollo sin proxy, devolvemos "127.0.0.1" como fallback.
 *
 * Configuración: PROXIES_CONFIABLES (entero ≥ 1, por defecto 1).
 * Ref: OWASP A05:2021 – Security Misconfiguration (CWE-441)
 */
import type { NextRequest } from "next/server";
import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

/** Extrae la IP real del cliente desde un `NextRequest` (API Routes / Middleware). */
export function getClientIp(req: NextRequest): string {
  return resolveIp(req.headers);
}

/**
 * Extrae la IP real del cliente desde `headers()` de Next.js
 * (Server Actions / Server Components).
 */
export function getClientIpFromHeaders(headers: ReadonlyHeaders): string {
  return resolveIp(headers);
}

function proxiesConfiables(): number {
  const n = Number(process.env.PROXIES_CONFIABLES ?? "1");
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function resolveIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    // Si la cadena es más corta que los proxies esperados, el valor más a la
    // izquierda ya lo agregó un proxy propio: es el más confiable disponible.
    const ip = ips[Math.max(0, ips.length - proxiesConfiables())];
    if (ip) return ip;
  }
  return "127.0.0.1";
}
