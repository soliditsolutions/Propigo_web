/**
 * Tests: proxy.ts — CSP con nonce en todas las páginas (auditoría 2026-10, riesgo 1).
 *
 * Las páginas públicas (portada, marketplace, legales, /portal) recibían la CSP
 * de respaldo con `script-src 'unsafe-inline'`. Ahora pasan por el proxy solo
 * para recibir la CSP con nonce, sin tocar la sesión: navegar el sitio público
 * no debe renovar la inactividad del panel. Las rutas con sesión conservan su
 * protección, incluidas las precargas de <Link> (no se excluyen del matcher).
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy, config } from "@/proxy";
import { signSession, COOKIE_NAME, DEVICE_COOKIE_NAME } from "@/lib/auth";

const BASE = "http://localhost:3000";
const DEVICE = "0f3c1b8e-6a4d-4e0b-9d1f-2b7a5c9e8d10";

beforeAll(() => {
  vi.stubEnv("AUTH_SECRET", "x".repeat(48));
});
afterEach(() => {
  vi.useRealTimers();
});

function req(path: string, cookies: Record<string, string> = {}): NextRequest {
  const r = new NextRequest(BASE + path);
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

/** Sesión del panel emitida hace 2 minutos: vieja para renovarse (REFRESCO_MINIMO = 60 s). */
async function sesionConDispositivo(): Promise<string> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() - 120_000);
  const token = await signSession({
    sub: "u-1", tenantId: "t-1", rol: "manager", nombre: "María", email: "m@x.cl",
    perfilCompleto: true, deviceToken: DEVICE,
  });
  vi.useRealTimers();
  return token;
}

describe("proxy — CSP en páginas públicas", () => {
  it.each(["/", "/marketplace", "/privacidad", "/portal", "/nueva-contrasena"])(
    "%s recibe la CSP con nonce en producción, sin 'unsafe-inline' en script-src",
    async (path) => {
      vi.stubEnv("NODE_ENV", "production");
      const res = await proxy(req(path));
      vi.unstubAllEnvs();
      vi.stubEnv("AUTH_SECRET", "x".repeat(48));
      const csp = res.headers.get("content-security-policy") ?? "";
      const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
      expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("cada respuesta lleva un nonce distinto", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const a = (await proxy(req("/"))).headers.get("content-security-policy");
    const b = (await proxy(req("/"))).headers.get("content-security-policy");
    vi.unstubAllEnvs();
    vi.stubEnv("AUTH_SECRET", "x".repeat(48));
    expect(a).not.toBe(b);
  });

  it("navegar el sitio público no renueva la sesión del panel", async () => {
    const token = await sesionConDispositivo();
    const res = await proxy(req("/marketplace", { [COOKIE_NAME]: token, [DEVICE_COOKIE_NAME]: DEVICE }));
    expect(res.cookies.getAll()).toHaveLength(0);
  });

  it("el panel sí renueva la misma sesión (control: la anterior no es un falso negativo)", async () => {
    const token = await sesionConDispositivo();
    const res = await proxy(req("/panel", { [COOKIE_NAME]: token, [DEVICE_COOKIE_NAME]: DEVICE }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get(COOKIE_NAME)?.value).toBeTruthy();
  });
});

describe("proxy — rutas con sesión siguen protegidas", () => {
  it("/panel sin sesión redirige a /login", async () => {
    const res = await proxy(req("/panel/contratos"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("/portal/contrato sin sesión de portal redirige a /portal", async () => {
    const res = await proxy(req("/portal/contrato/abc"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/portal");
  });

  it("/panel con sesión pero sin cookie de dispositivo va a verificar el dispositivo", async () => {
    const token = await sesionConDispositivo();
    const res = await proxy(req("/panel", { [COOKIE_NAME]: token }));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/verificar-dispositivo");
  });
});

describe("proxy — matcher", () => {
  const entradas = config.matcher;
  const textos = entradas.filter((m): m is string => typeof m === "string");
  const comodin = entradas.find((m) => typeof m !== "string") as { source: string; missing: unknown[] };

  it("las rutas con sesión van como entradas propias, sin excluir precargas", () => {
    for (const r of ["/panel/:path*", "/verificar-dispositivo", "/login", "/registro", "/recuperar-contrasena", "/invitacion", "/portal/contrato/:path*"]) {
      expect(textos).toContain(r);
    }
  });

  it("el comodín público excluye API, estáticos, uploads y archivos con extensión", () => {
    const re = new RegExp("^" + comodin.source + "$");
    for (const p of ["/", "/marketplace", "/marketplace/b7bab2b4", "/privacidad", "/portal"]) expect(re.test(p)).toBe(true);
    for (const p of ["/api/contratos/1", "/_next/static/chunks/a.js", "/_next/image", "/uploads/x.jpg", "/brand/logo.svg", "/robots.txt"]) {
      expect(re.test(p)).toBe(false);
    }
    expect(comodin.missing).toHaveLength(2);
  });
});
