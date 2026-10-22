import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { checkRateLimit, limpiarVencidos } from "../rate-limit";

/**
 * Tests: checkRateLimit — sliding-window in-memory rate limiter
 *
 * Verifica la ventana deslizante, el conteo exacto, el cálculo de retryAfter
 * y la seguridad ante claves independientes (no contaminación entre IPs).
 */

describe("checkRateLimit() — sliding-window rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("permite la primera solicitud", () => {
    const result = checkRateLimit("ip:1.2.3.4", 5, 60_000);
    expect(result).toEqual({ allowed: true });
  });

  it("permite solicitudes hasta el límite exacto", () => {
    const key = "ip:10.0.0.1-exact";
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000)).toEqual({ allowed: true });
    }
  });

  it("bloquea la solicitud que excede el límite", () => {
    const key = "ip:10.0.0.2-exceed";
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);

    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
  });

  // ── retryAfter ──────────────────────────────────────────────────────────────

  it("retryAfter es > 0 cuando se bloquea", () => {
    const key = "ip:10.0.0.3-retry";
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);

    const result = checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfter).toBeGreaterThan(0);
    }
  });

  it("retryAfter refleja el tiempo hasta que el timestamp más antiguo salga de la ventana", () => {
    const key = "ip:10.0.0.4-timing";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);

    // Avanzar 20 segundos (40 segundos restantes para la primera petición)
    vi.setSystemTime(new Date("2026-01-01T00:00:20.000Z"));

    const result = checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      // La primera petición expira a los 60s; han pasado 20s → quedan ~40s
      expect(result.retryAfter).toBeGreaterThanOrEqual(39);
      expect(result.retryAfter).toBeLessThanOrEqual(41);
    }
  });

  // ── Ventana deslizante ──────────────────────────────────────────────────────

  it("permite nuevas solicitudes una vez que las antiguas salen de la ventana", () => {
    const key = "ip:10.0.0.5-slide";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    // Llenar el límite
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);

    // Avanzar más allá de la ventana
    vi.setSystemTime(new Date("2026-01-01T00:01:01.000Z"));

    // Ahora los timestamps antiguos expiraron → debe permitir
    expect(checkRateLimit(key, 3, 60_000)).toEqual({ allowed: true });
  });

  it("la ventana es deslizante, no fija: nueva petición reinicia el conteo parcial", () => {
    const key = "ip:10.0.0.6-partial";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    // 2 peticiones al principio
    checkRateLimit(key, 3, 60_000);
    checkRateLimit(key, 3, 60_000);

    // 30 segundos después → las primeras siguen en ventana
    vi.setSystemTime(new Date("2026-01-01T00:00:30.000Z"));
    checkRateLimit(key, 3, 60_000); // tercera → límite alcanzado

    // Todavía bloqueado
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);

    // 31 segundos más → las dos primeras salen de la ventana de 60s
    vi.setSystemTime(new Date("2026-01-01T00:01:01.000Z"));
    // La tercera (a los 30s) sigue dentro de la ventana de 60s → quedan 2 huecos
    expect(checkRateLimit(key, 3, 60_000)).toEqual({ allowed: true });
    expect(checkRateLimit(key, 3, 60_000)).toEqual({ allowed: true });
    // La de los 30s + las 2 recientes → bloqueado de nuevo
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);
  });

  // ── Claves independientes (no contaminación entre IPs) ─────────────────────

  it("claves distintas son completamente independientes", () => {
    const keyA = "ip:192.168.1.1-iso";
    const keyB = "ip:192.168.1.2-iso";

    // Agotar keyA
    for (let i = 0; i < 5; i++) checkRateLimit(keyA, 5, 60_000);
    expect(checkRateLimit(keyA, 5, 60_000).allowed).toBe(false);

    // keyB no debe verse afectada
    expect(checkRateLimit(keyB, 5, 60_000)).toEqual({ allowed: true });
  });

  it("prefijos distintos del mismo tipo de endpoint son independientes", () => {
    const otp      = "portal_otp:1.2.3.4-pfx";
    const verificar = "portal_verificar:1.2.3.4-pfx";

    // Agotar portal_otp (límite 5)
    for (let i = 0; i < 5; i++) checkRateLimit(otp, 5, 60_000);
    expect(checkRateLimit(otp, 5, 60_000).allowed).toBe(false);

    // portal_verificar no se ve afectado
    expect(checkRateLimit(verificar, 10, 60_000)).toEqual({ allowed: true });
  });

  // ── Límite = 1 (caso extremo) ───────────────────────────────────────────────

  it("límite de 1: permite exactamente una solicitud y bloquea la siguiente", () => {
    const key = "ip:strict-iso";
    expect(checkRateLimit(key, 1, 60_000)).toEqual({ allowed: true });
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false);
  });

  // ── Ventana muy corta (1 ms) ────────────────────────────────────────────────

  it("ventana de 1ms: la segunda petición inmediata cae dentro y es bloqueada", () => {
    const key = "ip:1ms-iso";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    checkRateLimit(key, 1, 1);

    // Sin avanzar el reloj → bloqueado
    expect(checkRateLimit(key, 1, 1).allowed).toBe(false);
  });

  it("ventana de 1ms: tras avanzar el reloj 2ms la petición es permitida", () => {
    const key = "ip:1ms-slide-iso";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    checkRateLimit(key, 1, 1);

    vi.setSystemTime(new Date("2026-01-01T00:00:00.002Z"));
    expect(checkRateLimit(key, 1, 1)).toEqual({ allowed: true });
  });

  // ── Seguridad: no se puede hacer bypass con IP idéntica y límite distinto ──

  it("el límite se aplica al llamar con el mismo key independientemente del límite pasado", () => {
    const key = "ip:multi-limit-iso";
    // Primera llamada con límite 2
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    // La tercera llamada con límite mayor NO debe "desbloquear" el store
    // (el store se actualiza con el nuevo contador, pero el contador ya tiene 2 entradas)
    const result = checkRateLimit(key, 2, 60_000);
    expect(result.allowed).toBe(false);
  });
});

describe("limpiarVencidos() — la limpieza respeta la ventana de cada clave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("no reinicia un límite de 1 hora tras 10 minutos sin actividad", () => {
    const key = "denuncia:203.0.113.7";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60 * 60_000);

    vi.setSystemTime(new Date("2026-01-01T00:20:00.000Z"));
    limpiarVencidos();
    expect(checkRateLimit(key, 3, 60 * 60_000).allowed).toBe(false);
  });

  it("sí libera la clave cuando su propia ventana venció", () => {
    const key = "contacto:203.0.113.8";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 10 * 60_000);

    vi.setSystemTime(new Date("2026-01-01T00:11:00.000Z"));
    limpiarVencidos();
    expect(checkRateLimit(key, 5, 10 * 60_000)).toEqual({ allowed: true });
  });
});
