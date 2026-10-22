/**
 * GET /api/cron/recordatorios — autorización por CRON_SECRET (comparación en
 * tiempo constante) y obligatorio en producción.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/app/panel/notificaciones/actions", () => ({
  generarRecordatorios: vi.fn(async () => 0),
  enviarNotificacionesPendientes: vi.fn(async () => ({})),
}));
vi.mock("@/lib/queries", () => ({ getAllTenantsForSystem: vi.fn(async () => []) }));
vi.mock("@/lib/tenant-db", () => ({ withTenant: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const { GET } = await import("../route");
const pedir = (auth?: string) =>
  GET(new Request("http://x/api/cron/recordatorios", { headers: auth ? { authorization: auth } : {} }) as never);

describe("GET /api/cron/recordatorios", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("con secreto configurado: 401 sin encabezado, con otro secreto o con un prefijo del correcto", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-de-prueba-123");
    expect((await pedir()).status).toBe(401);
    expect((await pedir("Bearer otro")).status).toBe(401);
    expect((await pedir("Bearer secreto-de-prueba-12")).status).toBe(401);
    expect((await pedir("secreto-de-prueba-123")).status).toBe(401);
  });

  it("con el secreto correcto: 200", async () => {
    vi.stubEnv("CRON_SECRET", "secreto-de-prueba-123");
    const res = await pedir("Bearer secreto-de-prueba-123");
    expect(res.status).toBe(200);
  });

  it("en producción sin secreto configurado: 500, nunca abierto", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    expect((await pedir("Bearer cualquiera")).status).toBe(500);
  });
});
