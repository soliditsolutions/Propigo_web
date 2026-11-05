/**
 * Tests: proxy.ts — una server action sin sesión válida recibe 401 text/plain
 * con la marca SESION_EXPIRADA, no un redirect. Con redirect, fetch lo sigue,
 * el cliente recibe HTML y la página se rompe perdiendo lo escrito (M-14 de
 * la auditoría de mensajes 2026-11). Las navegaciones normales siguen
 * redirigiendo al login como antes.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { signSession, COOKIE_NAME, DEVICE_COOKIE_NAME } from "@/lib/auth";
import { PORTAL_COOKIE_NAME } from "@/lib/portal-auth";
import { SESION_EXPIRADA } from "@/lib/fallo-accion";

const BASE = "http://localhost:3000";
const DEVICE = "0f3c1b8e-6a4d-4e0b-9d1f-2b7a5c9e8d10";

beforeAll(() => {
  process.env.AUTH_SECRET = "x".repeat(48);
});

function accion(path: string, cookies: Record<string, string> = {}): NextRequest {
  const r = new NextRequest(BASE + path, { method: "POST", headers: { "next-action": "abc123" } });
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v);
  return r;
}

async function esperarSesionExpirada(res: Response) {
  expect(res.status).toBe(401);
  // El cliente de Next compara el Content-Type con igualdad estricta.
  expect(res.headers.get("content-type")).toBe("text/plain");
  expect(res.headers.get("location")).toBeNull();
  expect(await res.text()).toBe(SESION_EXPIRADA);
}

describe("proxy — server actions sin sesión", () => {
  it("panel sin cookie de sesión → 401 con la marca", async () => {
    await esperarSesionExpirada(await proxy(accion("/panel/cobros")));
  });

  it("panel con un JWT inválido → 401 y borra la cookie", async () => {
    const res = await proxy(accion("/panel/cobros", { [COOKIE_NAME]: "no-es-un-jwt" }));
    await esperarSesionExpirada(res);
    expect(res.headers.get("set-cookie") ?? "").toMatch(new RegExp(`${COOKIE_NAME}=;`));
  });

  it("panel con sesión pero sin el dispositivo confiable → 401", async () => {
    const token = await signSession({
      sub: "u-1", tenantId: "t-1", rol: "manager", nombre: "María", email: "m@x.cl",
      perfilCompleto: true, deviceToken: DEVICE,
    });
    await esperarSesionExpirada(await proxy(accion("/panel/cobros", { [COOKIE_NAME]: token })));
  });

  it("panel con sesión y dispositivo válidos → la acción pasa", async () => {
    const token = await signSession({
      sub: "u-1", tenantId: "t-1", rol: "manager", nombre: "María", email: "m@x.cl",
      perfilCompleto: true, deviceToken: DEVICE,
    });
    const res = await proxy(accion("/panel/cobros", { [COOKIE_NAME]: token, [DEVICE_COOKIE_NAME]: DEVICE }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("portal sin sesión → 401 con la marca", async () => {
    await esperarSesionExpirada(await proxy(accion("/portal/contrato/abc", { [PORTAL_COOKIE_NAME]: "x" })));
  });

  it("verificar-dispositivo sin sesión → 401", async () => {
    await esperarSesionExpirada(await proxy(accion("/verificar-dispositivo")));
  });

  it("una navegación normal sin sesión sigue redirigiendo al login", async () => {
    const res = await proxy(new NextRequest(BASE + "/panel/cobros"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${BASE}/login`);
  });
});
