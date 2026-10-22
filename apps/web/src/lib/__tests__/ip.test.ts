import { describe, it, expect, afterEach, vi } from "vitest";
import { getClientIpFromHeaders } from "../ip";

/** Simula el tipo ReadonlyHeaders con un Map simple */
function makeHeaders(obj: Record<string, string>) {
  return { get: (name: string) => obj[name] ?? null };
}

const ip = (obj: Record<string, string>) => getClientIpFromHeaders(makeHeaders(obj) as never);

describe("getClientIpFromHeaders() — un proxy de confianza (por defecto)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("toma el ÚLTIMO hop de x-forwarded-for (lo agrega el proxy propio)", () => {
    expect(ip({ "x-forwarded-for": "203.0.113.1, 10.0.0.1, 192.168.1.1" })).toBe("192.168.1.1");
  });

  it("previene bypass del rate limit via header forjado (primer hop)", () => {
    expect(ip({ "x-forwarded-for": "attacker-ip, real-proxy-ip" })).toBe("real-proxy-ip");
  });

  it("ignora x-real-ip: en AWS el cliente puede enviarlo tal cual", () => {
    expect(ip({ "x-real-ip": "1.3.3.7", "x-forwarded-for": "9.9.9.9" })).toBe("9.9.9.9");
    expect(ip({ "x-real-ip": "1.3.3.7" })).toBe("127.0.0.1");
  });

  it("maneja x-forwarded-for con un solo valor y hace trim", () => {
    expect(ip({ "x-forwarded-for": "  5.5.5.5  " })).toBe("5.5.5.5");
  });

  it("retorna 127.0.0.1 sin headers o con x-forwarded-for vacío", () => {
    expect(ip({})).toBe("127.0.0.1");
    expect(ip({ "x-forwarded-for": "" })).toBe("127.0.0.1");
    expect(ip({ "x-forwarded-for": " , " })).toBe("127.0.0.1");
  });
});

describe("getClientIpFromHeaders() — CloudFront + App Runner (PROXIES_CONFIABLES=2)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("toma el penúltimo: el último es la IP de CloudFront, compartida por muchos usuarios", () => {
    vi.stubEnv("PROXIES_CONFIABLES", "2");
    expect(ip({ "x-forwarded-for": "1.3.3.7, 200.1.1.1, 130.176.0.5" })).toBe("200.1.1.1");
  });

  it("un valor inyectado por el cliente a la izquierda no cambia el resultado", () => {
    vi.stubEnv("PROXIES_CONFIABLES", "2");
    expect(ip({ "x-forwarded-for": "6.6.6.6, 7.7.7.7, 200.1.1.1, 130.176.0.5" })).toBe("200.1.1.1");
  });

  it("con menos valores que proxies, usa el más a la izquierda disponible", () => {
    vi.stubEnv("PROXIES_CONFIABLES", "2");
    expect(ip({ "x-forwarded-for": "130.176.0.5" })).toBe("130.176.0.5");
  });

  it.each(["0", "-1", "abc", "1.5"])("un valor inválido (%s) cae al seguro: 1 proxy", (valor) => {
    vi.stubEnv("PROXIES_CONFIABLES", valor);
    expect(ip({ "x-forwarded-for": "attacker-ip, real-proxy-ip" })).toBe("real-proxy-ip");
  });
});
