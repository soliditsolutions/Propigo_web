import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Importar dinámicamente para poder mockear process.env antes de la importación
async function importRunStartupChecks() {
  // Limpiar cache del módulo para re-ejecutar la verificación con nuevas vars
  vi.resetModules();
  const mod = await import("../startup-check");
  return mod.runStartupChecks;
}

describe("runStartupChecks() — Fix A2 (fail-fast en arranque)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Resetear a un estado de producción válido (con todas las vars requeridas) para cada test
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    process.env.AUTH_SECRET = "a".repeat(32);
    process.env.DATABASE_URL = "postgresql://user:pass@host:5432/db";
    process.env.GROQ_API_KEY = "gsk_test_key_abc123";
    process.env.CRON_SECRET  = "cron_secret_test_value_abc123";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.propigo.cl";
    // Variables que deben estar AUSENTES en la línea base válida: si un test
    // anterior las dejó "pegadas", afterEach (Object.assign) no las borra
    // porque no existían en originalEnv — hay que limpiarlas explícitamente.
    delete process.env.E2E_BYPASS_IDENTITY;
  });

  afterEach(() => {
    // Restaurar entorno original
    Object.assign(process.env, originalEnv);
  });

  it("no lanza en producción con configuración válida", async () => {
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).not.toThrow();
  });

  it("lanza en producción con NODE_TLS_REJECT_UNAUTHORIZED=0", async () => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/TLS/i);
  });

  it("lanza si AUTH_SECRET tiene menos de 32 caracteres", async () => {
    process.env.AUTH_SECRET = "corto";
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/AUTH_SECRET/i);
  });

  it("lanza si AUTH_SECRET está ausente", async () => {
    delete process.env.AUTH_SECRET;
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/AUTH_SECRET/i);
  });

  it("lanza si DATABASE_URL está ausente en producción", async () => {
    delete process.env.DATABASE_URL;
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/DATABASE_URL/i);
  });

  it("no lanza en desarrollo con NODE_TLS_REJECT_UNAUTHORIZED=0", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const runStartupChecks = await importRunStartupChecks();
    // En dev emite una advertencia pero no lanza
    expect(() => runStartupChecks()).not.toThrow();
  });

  it("lanza si CRON_SECRET no está configurado en producción", async () => {
    delete process.env.CRON_SECRET;
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/CRON_SECRET/i);
  });

  // BL-INIT1: GROQ_API_KEY requerida para verificación de identidad en registro
  it("lanza si GROQ_API_KEY está ausente", async () => {
    delete process.env.GROQ_API_KEY;
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/GROQ_API_KEY/i);
  });

  it("no lanza cuando GROQ_API_KEY está configurada", async () => {
    process.env.GROQ_API_KEY = "gsk_live_test_key_abc123";
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).not.toThrow();
  });

  // AUD-07: E2E_BYPASS_IDENTITY jamás debe sobrevivir en producción — omitiría
  // la verificación de identidad por cédula en /registro.
  it("lanza si E2E_BYPASS_IDENTITY está definida en producción", async () => {
    process.env.E2E_BYPASS_IDENTITY = "1";
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/E2E_BYPASS_IDENTITY/i);
  });

  it("no lanza en desarrollo con E2E_BYPASS_IDENTITY definida", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.E2E_BYPASS_IDENTITY = "1";
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).not.toThrow();
  });

  // Caso real: "cerrar sesión" del portal redirigía a un puerto muerto porque
  // NEXT_PUBLIC_APP_URL no estaba configurada y el fallback de email.ts
  // apuntaba a localhost. Ahora es obligatoria en producción.
  it("lanza si NEXT_PUBLIC_APP_URL está ausente en producción", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).toThrow(/NEXT_PUBLIC_APP_URL/i);
  });

  it("no lanza en desarrollo sin NEXT_PUBLIC_APP_URL (usa fallback local)", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_APP_URL;
    const runStartupChecks = await importRunStartupChecks();
    expect(() => runStartupChecks()).not.toThrow();
  });
});
