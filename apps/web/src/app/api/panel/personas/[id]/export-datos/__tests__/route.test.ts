/**
 * GET /api/panel/personas/[id]/export-datos — derecho de acceso/portabilidad.
 * Cubre el gate (manager-only), el id no-UUID, el formato y que el export
 * quede registrado en la auditoría del equipo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", () => ({ getActor: mockGetActor }));

const mockConstruir = vi.fn();
vi.mock("@/lib/export-datos-persona", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/export-datos-persona")>();
  return { ...actual, construirExportDatosPersona: mockConstruir };
});

vi.mock(import("@react-pdf/renderer"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, renderToBuffer: vi.fn(async () => Buffer.from("%PDF-fake")) };
});

const mockAuditoriaCreate = vi.fn().mockResolvedValue({});
vi.mock("@/lib/tenant-db", () => ({
  withTenant: vi.fn((_t: string, cb: (tx: unknown) => unknown) =>
    cb({ auditoriaEquipo: { create: mockAuditoriaCreate } }),
  ),
}));

const { GET } = await import("../route");

const ID = "22222222-2222-4222-8222-222222222222";
const DATOS = {
  meta: { generadoEl: "x", fundamento: "Ley 21.719", responsable: { nombre: "C", rut: "1-9" }, alcance: "x" },
  identidad: { nombre: "P", rut: "11111111-1", email: null, telefono: null, canalDeAccesoPreferido: null, registradaEl: "x" },
  contratos: [], cuentasBancarias: [], documentos: [], comunicaciones: [],
  registrosDeAcceso: [], solicitudesDeCodigoDeAcceso: [], reservas: [],
  preferenciaDeNotificacion: null, valoraciones: [],
};

function req(id = ID, formato = "json") {
  return GET(
    new Request(`http://localhost/api/panel/personas/${id}/export-datos?formato=${formato}`) as never,
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConstruir.mockResolvedValue(DATOS);
});

describe("GET /api/panel/personas/[id]/export-datos", () => {
  it("401 sin sesión", async () => {
    mockGetActor.mockRejectedValue(new Error("no session"));
    expect((await req()).status).toBe(401);
  });

  it("403 si el actor no es manager", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "colaborador" });
    const res = await req();
    expect(res.status).toBe(403);
    expect(mockConstruir).not.toHaveBeenCalled();
  });

  it("404 sin tocar la BD si el id no es UUID", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "manager" });
    const res = await req("' OR 1=1--");
    expect(res.status).toBe(404);
    expect(mockConstruir).not.toHaveBeenCalled();
  });

  it("200 JSON con Content-Disposition de descarga y no-store", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "manager" });
    const res = await req(ID, "json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
    expect(res.headers.get("Cache-Control")).toBe("no-store, private");
    const body = JSON.parse(await res.text());
    expect(body.identidad.rut).toBe("11111111-1");
  });

  it("200 PDF cuando formato=pdf", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "manager" });
    const res = await req(ID, "pdf");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("registra el export en la auditoría del equipo", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "manager" });
    await req(ID, "json");
    expect(mockAuditoriaCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditoriaCreate.mock.calls[0][0].data.accion).toBe("exportar_datos_persona");
  });

  it("404 si la persona no existe en la corredora", async () => {
    const { PersonaNoEncontrada } = await import("@/lib/export-datos-persona");
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "manager" });
    mockConstruir.mockRejectedValue(new PersonaNoEncontrada());
    expect((await req()).status).toBe(404);
  });

  it("E2 — un export fallido NO escribe auditoría", async () => {
    const { PersonaNoEncontrada } = await import("@/lib/export-datos-persona");
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "manager" });
    mockConstruir.mockRejectedValue(new PersonaNoEncontrada());
    await req();
    expect(mockAuditoriaCreate).not.toHaveBeenCalled();
  });

  it("D2 — un `formato` arbitrario se trata como JSON, no rompe", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "u1", tenantId: "t1", rol: "manager" });
    const res = await req(ID, "..%2F..%2Fetc%2Fpasswd");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
  });

  it("E3 — rate limit: al superar 20 exports/hora del usuario → 429", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "rl-user", tenantId: "t1", rol: "manager" });
    let last = 200;
    for (let i = 0; i < 25; i++) last = (await req()).status;
    expect(last).toBe(429);
  });
});
