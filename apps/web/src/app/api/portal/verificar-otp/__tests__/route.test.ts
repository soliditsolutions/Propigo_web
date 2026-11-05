/**
 * Mensaje de intentos del OTP del portal (M-27): singular y plural correctos,
 * y el último fallo pasa a AGOTADO.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockQueryRaw, mockUpdate } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockUpdate:   vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: mockQueryRaw } }));
vi.mock("@/lib/tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({ accesoOtp: { update: mockUpdate } }),
}));
vi.mock("@/lib/portal-auth", () => ({ signPortalSession: vi.fn(), setPortalCookie: vi.fn() }));
vi.mock("@/lib/ip", () => ({ getClientIp: () => "127.0.0.1" }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/codigo-verificacion", () => ({ hashCodigo: () => "hash-del-ingresado" }));

import { POST } from "../route";

const OTP_ID = "7d1f6e2a-1b2c-4d3e-8f90-123456789abc";

function pedir() {
  return new NextRequest("http://localhost/api/portal/verificar-otp", {
    method: "POST",
    body: JSON.stringify({ otpId: OTP_ID, codigo: "123456" }),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockUpdate.mockReset();
  mockQueryRaw.mockResolvedValue([{
    id: OTP_ID, tenant_id: "t1", persona_id: "p1", propiedad_id: "pr1",
    codigo_hash: "hash-real", expira_en: new Date(Date.now() + 60_000),
    intentos: 0, max_intentos: 3, usado_en: null,
  }]);
});

describe("POST /api/portal/verificar-otp — código incorrecto", () => {
  it("con 2 restantes usa el plural", async () => {
    mockUpdate.mockResolvedValue({ intentos: 1, maxIntentos: 3 });
    const body = await (await POST(pedir())).json();
    expect(body).toMatchObject({ errorCode: "INCORRECTO", intentosRestantes: 2 });
    expect(body.error).toBe("Código incorrecto. Te quedan 2 intentos.");
  });

  it("con 1 restante usa el singular: «Te queda 1 intento»", async () => {
    mockUpdate.mockResolvedValue({ intentos: 2, maxIntentos: 3 });
    const body = await (await POST(pedir())).json();
    expect(body).toMatchObject({ errorCode: "INCORRECTO", intentosRestantes: 1 });
    expect(body.error).toBe("Código incorrecto. Te queda 1 intento.");
  });

  it("sin intentos restantes responde AGOTADO", async () => {
    mockUpdate.mockResolvedValue({ intentos: 3, maxIntentos: 3 });
    const body = await (await POST(pedir())).json();
    expect(body).toMatchObject({ errorCode: "AGOTADO", intentosRestantes: 0 });
  });
});
