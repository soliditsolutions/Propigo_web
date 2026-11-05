/**
 * Cierre de sesión: redirige con una Location relativa (el navegador la
 * resuelve contra el dominio real) y borra ambas cookies.
 *
 * Antes la URL se armaba con req.url, que en el servidor standalone es
 * localhost:PUERTO: detrás de un proxy, cerrar sesión llevaba a
 * https://localhost:3100/login.
 */
import { describe, it, expect, vi } from "vitest";

const { mockClearPortal } = vi.hoisted(() => ({ mockClearPortal: vi.fn() }));
vi.mock("@/lib/portal-auth", () => ({ clearPortalCookie: mockClearPortal }));

import { GET, POST } from "../route";
import { GET as GET_PORTAL } from "../../../portal/logout/route";
import { COOKIE_NAME, DEVICE_COOKIE_NAME } from "@/lib/auth";

describe("/api/auth/logout", () => {
  it("POST responde 303 a /login (relativo) y borra sesión y dispositivo", async () => {
    const r = await POST();
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/login");
    expect(r.cookies.get(COOKIE_NAME)?.value).toBe("");
    expect(r.cookies.get(DEVICE_COOKIE_NAME)?.value).toBe("");
    expect(r.headers.get("clear-site-data")).toContain("cookies");
  });

  it("GET responde 307 a /login (relativo)", async () => {
    const r = await GET();
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("/login");
  });
});

describe("/api/portal/logout", () => {
  it("borra la cookie del portal y vuelve a /portal (relativo)", async () => {
    const r = await GET_PORTAL();
    expect(mockClearPortal).toHaveBeenCalled();
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("/portal");
  });
});
