/**
 * Los scripts que hacen TRUNCATE o crean cuentas conocidas no deben poder
 * correr contra una base remota por accidente (ej. con el .env de producción).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { verificarBaseLocal } from "../guard-base-local";

const URL_LOCAL = "postgresql://propigo:x@localhost:5433/propigo";
const URL_RDS = "postgresql://propigo:x@propigo.abc123.sa-east-1.rds.amazonaws.com:5432/propigo";

describe("verificarBaseLocal", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["localhost", "127.0.0.1", "host.docker.internal", "propigo-db"])("permite el host local %s", (host) => {
    expect(() => verificarBaseLocal(`postgresql://u:p@${host}:5432/propigo`, "seed")).not.toThrow();
  });

  it("cancela contra un host remoto y nombra el script y el host", () => {
    expect(() => verificarBaseLocal(URL_RDS, "db:seed")).toThrow(/db:seed[\s\S]*rds\.amazonaws\.com/);
  });

  it("no se deja engañar por un host que solo contiene 'localhost'", () => {
    expect(() => verificarBaseLocal("postgresql://u:p@localhost.atacante.com/propigo", "seed")).toThrow();
  });

  it("cancela si no hay URL", () => {
    expect(() => verificarBaseLocal(undefined, "seed")).toThrow(/no hay URL/);
  });

  it("ALLOW_REMOTE_SEED=1 lo permite de forma explícita", () => {
    vi.stubEnv("ALLOW_REMOTE_SEED", "1");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => verificarBaseLocal(URL_RDS, "seed")).not.toThrow();
  });

  it("cualquier otro valor de ALLOW_REMOTE_SEED no lo habilita", () => {
    vi.stubEnv("ALLOW_REMOTE_SEED", "true");
    expect(() => verificarBaseLocal(URL_RDS, "seed")).toThrow();
    expect(() => verificarBaseLocal(URL_LOCAL, "seed")).not.toThrow();
  });
});
