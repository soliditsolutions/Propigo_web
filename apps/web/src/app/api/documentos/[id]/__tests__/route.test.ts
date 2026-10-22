/**
 * GET /api/documentos/[id] — autorización (ADR-0013).
 * Antes usaba solo getSession: un Colaborador descargaba cédulas y contratos de
 * propiedades no asignadas, y un usuario desactivado seguía descargando.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", () => ({ getActor: mockGetActor }));
const mockFindFirst = vi.fn();
vi.mock("@/lib/tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) =>
    fn({ documento: { findFirst: mockFindFirst }, accesoLog: { create: vi.fn().mockResolvedValue({}) } }),
}));
vi.mock("fs/promises", () => ({ readFile: vi.fn(async () => Buffer.from("%PDF-1.4")) }));

const { GET } = await import("../route");

const ID = "11111111-1111-4111-8111-111111111111";
const pedir = () => GET(new Request(`http://x/api/documentos/${ID}`) as never, { params: Promise.resolve({ id: ID }) });
const doc = (asignadoAId: string | null) => ({
  id: ID, tenantId: "t1", nombre: "cedula.pdf", storageKey: "abc.pdf",
  propiedad: null, reserva: null, periodo: null, voucher: null, comentario: null,
  contrato: { propiedad: { asignadoAId } },
});

describe("GET /api/documentos/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 si getActor falla (sin sesión o usuario desactivado)", async () => {
    mockGetActor.mockRejectedValue(new Error("NEXT_REDIRECT"));
    expect((await pedir()).status).toBe(401);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("404 para un colaborador sin la propiedad asignada", async () => {
    mockGetActor.mockResolvedValue({ tenantId: "t1", rol: "colaborador", usuarioId: "u-colab" });
    mockFindFirst.mockResolvedValue(doc("u-otro"));
    expect((await pedir()).status).toBe(404);
  });

  it("200 para el colaborador asignado, como descarga", async () => {
    mockGetActor.mockResolvedValue({ tenantId: "t1", rol: "colaborador", usuarioId: "u-colab" });
    mockFindFirst.mockResolvedValue(doc("u-colab"));
    const res = await pedir();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
  });

  it("200 para el manager", async () => {
    mockGetActor.mockResolvedValue({ tenantId: "t1", rol: "manager", usuarioId: "u-m" });
    mockFindFirst.mockResolvedValue(doc(null));
    expect((await pedir()).status).toBe(200);
  });
});
