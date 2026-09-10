/**
 * Tests: GET /api/contratos/[id]/pdf — borrador de contrato (ítem #9, ADR-0009 rev. 2026-07-30).
 * Cubre el guard de ownership (ADR-0013 Fase D, mismo criterio que contratos/[id]/page.tsx:
 * 404 en vez de 403 para no revelar la existencia del contrato a un Colaborador sin acceso).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", () => ({ getActor: mockGetActor }));

// Solo se mockea renderToBuffer (layout/fuentes real, lento) — Document/Page/
// Text/View/StyleSheet quedan reales porque contrato-pdf.tsx los usa para
// construir el árbol de elementos. El render en sí ya se verificó aparte,
// generando PDFs reales con distintos datos (con/sin garantía, plazo fijo/indefinido).
vi.mock(import("@react-pdf/renderer"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, renderToBuffer: vi.fn(async () => Buffer.from("fake-pdf")) };
});

const mockContratoFindFirst = vi.fn();

vi.mock("@/lib/db", () => {
  const models = { contrato: { findFirst: mockContratoFindFirst } };
  return {
    prisma: {
      ...models,
      $transaction: vi.fn((cb: (tx: unknown) => unknown) =>
        cb({ $executeRaw: vi.fn().mockResolvedValue(undefined), ...models }),
      ),
    },
  };
});

const { GET } = await import("../route");

const ID_VALIDO = "11111111-1111-4111-8111-111111111111";

const CONTRATO_BASE = {
  id: "contrato-1", estado: "borrador", denominacion: "UF", valorArriendo: "24.5", diaVencimiento: 5,
  reajuste: "anual", moraTasaPct: "3", moraDiasGracia: 5,
  garantiaMeses: "0", garantiaDenominacion: null, garantiaMontoBase: null,
  fechaInicio: new Date("2026-01-01"), fechaFin: null,
  propiedad: {
    direccion: "Av. Test 123", comuna: "Ñuñoa", region: "RM", tipo: "departamento",
    asignadoAId: "colab-owner", rol: "573-24",
    rolesComplementarios: [{ tipo: "estacionamiento", rol: "573-118", descripcion: "43" }],
  },
  arrendatario: { nombre: "Juan Arrendatario", rut: "11111111-1", email: null },
  propietario:  { nombre: "Ana Propietaria",  rut: "22222222-2", email: null },
};

function req(id = ID_VALIDO) {
  return GET(new Request(`http://localhost/api/contratos/${id}/pdf`), { params: Promise.resolve({ id }) });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/contratos/[id]/pdf", () => {
  it("401 si no hay sesión", async () => {
    mockGetActor.mockRejectedValue(new Error("no session"));
    const res = await req();
    expect(res.status).toBe(401);
  });

  it("404 sin tocar la BD si el id no es un UUID (evita el 500 de Prisma)", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "manager-1", tenantId: "tenant-1", rol: "manager", tenant: { nombre: "Corredora" } });
    const res = await req("' OR 1=1--");
    expect(res.status).toBe(404);
    expect(mockContratoFindFirst).not.toHaveBeenCalled();
  });

  it("404 si el contrato no existe o es de otro tenant", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "manager-1", tenantId: "tenant-1", rol: "manager", tenant: { nombre: "Corredora" } });
    mockContratoFindFirst.mockResolvedValue(null);
    const res = await req();
    expect(res.status).toBe(404);
  });

  it("404 si un Colaborador pide un contrato de una propiedad que no le pertenece (no revela existencia)", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-otro", tenantId: "tenant-1", rol: "colaborador", tenant: { nombre: "Corredora" } });
    mockContratoFindFirst.mockResolvedValue(CONTRATO_BASE);
    const res = await req();
    expect(res.status).toBe(404);
  });

  it("200 con Content-Type application/pdf si el Colaborador es el dueño de la propiedad", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-owner", tenantId: "tenant-1", rol: "colaborador", tenant: { nombre: "Corredora" } });
    mockContratoFindFirst.mockResolvedValue(CONTRATO_BASE);
    const res = await req();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment/);
  });

  it("200 para el Manager sin importar asignadoAId", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "manager-1", tenantId: "tenant-1", rol: "manager", tenant: { nombre: "Corredora" } });
    mockContratoFindFirst.mockResolvedValue(CONTRATO_BASE);
    const res = await req();
    expect(res.status).toBe(200);
  });

  it("409 si el contrato ya no está en borrador (ya se activó — la firma real ocurrió fuera del sistema)", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "manager-1", tenantId: "tenant-1", rol: "manager", tenant: { nombre: "Corredora" } });
    mockContratoFindFirst.mockResolvedValue({ ...CONTRATO_BASE, estado: "vigente" });
    const res = await req();
    expect(res.status).toBe(409);
  });

  it("el rol y los complementos llegan desde la consulta hasta el documento", async () => {
    // Cierra el circuito que ninguno de los otros tests cubre: contrato-pdf
    // sabe pintar el rol y la ruta sabe pedirlo, pero nada comprobaba que el
    // valor recorriera el camino completo. Se inspecciona el árbol que la ruta
    // le entrega a renderToBuffer.
    mockGetActor.mockResolvedValue({ usuarioId: "manager-1", tenantId: "tenant-1", rol: "manager", tenant: { nombre: "Corredora" } });
    mockContratoFindFirst.mockResolvedValue(CONTRATO_BASE);
    await req();

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const arbol = vi.mocked(renderToBuffer).mock.calls[0][0];
    const texto = textoDe(arbol);

    expect(texto).toContain("Rol de Avalúo N° 573-24");
    expect(texto).toContain("el estacionamiento 43, Rol de Avalúo N° 573-118.");
  });

  it("pide los roles complementarios en la consulta", async () => {
    // Sin el `include`, la propiedad llega sin ellos y la cláusula deja fuera
    // el estacionamiento y la bodega sin que nada falle a la vista.
    mockGetActor.mockResolvedValue({ usuarioId: "manager-1", tenantId: "tenant-1", rol: "manager", tenant: { nombre: "Corredora" } });
    mockContratoFindFirst.mockResolvedValue(CONTRATO_BASE);
    await req();

    const include = mockContratoFindFirst.mock.calls.at(-1)?.[0]?.include;
    expect(include?.propiedad?.include?.rolesComplementarios).toBeTruthy();
  });
});

/** Junta el texto de un árbol de elementos de @react-pdf. */
function textoDe(nodo: unknown): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDe).join("");
  if (typeof nodo === "object" && "props" in (nodo as { props?: unknown })) {
    return textoDe((nodo as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}
