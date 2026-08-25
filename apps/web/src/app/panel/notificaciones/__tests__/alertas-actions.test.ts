/**
 * Tests: permisos de las alertas personalizadas.
 *
 * El reparto (ADR-0013) es la mitad del diseño de esta función: definir una
 * alerta es administración —queda disponible para toda la cuenta— pero
 * enviarla es trabajo diario de cualquier corredor. Si un Colaborador pudiera
 * editar la plantilla, estaría cambiando lo que sus compañeros mandan a sus
 * propios clientes sin que nadie lo apruebe.
 *
 * Se prueba el límite, no el camino feliz: que el rechazo ocurra ANTES de
 * tocar la base.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted: vitest eleva los vi.mock por encima de las declaraciones, así
// que los dobles deben existir antes. Sin esto, la fábrica del mock corre
// cuando la const todavía no está inicializada.
const { mockGetActor, mockPropiedadIdsVisibles } = vi.hoisted(() => ({
  mockGetActor: vi.fn(),
  mockPropiedadIdsVisibles: vi.fn(),
}));
vi.mock("@/lib/queries", () => ({
  getActor: mockGetActor,
  propiedadIdsVisibles: mockPropiedadIdsVisibles,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

const {
  mockAlertaCreate, mockAlertaUpdateMany, mockAlertaFindFirst,
  mockContratoFindFirst, mockNotifCreate,
} = vi.hoisted(() => ({
  mockAlertaCreate: vi.fn(),
  mockAlertaUpdateMany: vi.fn(),
  mockAlertaFindFirst: vi.fn(),
  mockContratoFindFirst: vi.fn(),
  mockNotifCreate: vi.fn(),
}));

vi.mock("@/lib/tenant-db", () => ({
  withTenant: (_t: string, fn: (tx: unknown) => unknown) => fn({
    alertaPersonalizada: {
      create: mockAlertaCreate,
      updateMany: mockAlertaUpdateMany,
      findFirst: mockAlertaFindFirst,
    },
    contrato:     { findFirst: mockContratoFindFirst },
    notificacion: { create: mockNotifCreate },
  }),
}));

import { crearAlerta, actualizarAlerta, cambiarEstadoAlerta, enviarAlerta } from "../alertas-actions";

const ALERTA_OK = {
  nombre: "Aviso", asunto: "Hola", cuerpo: "Mensaje",
  destinatario: "arrendatario" as const, disparador: null, diasOffset: null,
};

const MANAGER     = { usuarioId: "u1", tenantId: "t1", rol: "manager",     tenant: { id: "t1", nombre: "Corredora" } };
const COLABORADOR = { usuarioId: "u2", tenantId: "t1", rol: "colaborador", tenant: { id: "t1", nombre: "Corredora" } };

beforeEach(() => {
  vi.clearAllMocks();
  mockPropiedadIdsVisibles.mockResolvedValue(null);
  mockAlertaCreate.mockResolvedValue({});
  mockAlertaUpdateMany.mockResolvedValue({ count: 1 });
  mockNotifCreate.mockResolvedValue({});
});

describe("definir alertas es exclusivo del Manager", () => {
  it.each([
    ["crear",             () => crearAlerta(ALERTA_OK)],
    ["editar",            () => actualizarAlerta("a1", ALERTA_OK)],
    ["activar/desactivar", () => cambiarEstadoAlerta("a1", false)],
  ])("un Colaborador no puede %s", async (_caso, accion) => {
    mockGetActor.mockResolvedValue(COLABORADOR);

    const r = await accion();

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/administrador/i);
    // El rechazo ocurre antes de tocar la base, no después.
    expect(mockAlertaCreate).not.toHaveBeenCalled();
    expect(mockAlertaUpdateMany).not.toHaveBeenCalled();
  });

  it("el Manager sí puede crear", async () => {
    mockGetActor.mockResolvedValue(MANAGER);
    const r = await crearAlerta(ALERTA_OK);
    expect(r.ok).toBe(true);
    expect(mockAlertaCreate).toHaveBeenCalled();
  });

  it("una alerta inválida se rechaza aunque la pida el Manager", async () => {
    mockGetActor.mockResolvedValue(MANAGER);
    const r = await crearAlerta({ ...ALERTA_OK, cuerpo: "Usa {{inventado}}" });
    expect(r.ok).toBe(false);
    expect(mockAlertaCreate).not.toHaveBeenCalled();
  });
});

describe("enviar alertas lo puede hacer cualquier corredor", () => {
  const CONTRATO = {
    id: "c1", valorArriendo: 450000, denominacion: "CLP",
    arrendatarioId: "p1", propietarioId: "p2",
    arrendatario: { id: "p1", nombre: "Ana" },
    propietario:  { id: "p2", nombre: "Luis" },
    propiedad:    { direccion: "Calle 1" },
    periodos:     [{ id: "per1", fechaVencimiento: new Date("2026-09-05T00:00:00Z") }],
  };

  it("un Colaborador puede enviar sobre un contrato que ve", async () => {
    mockGetActor.mockResolvedValue(COLABORADOR);
    mockAlertaFindFirst.mockResolvedValue({ id: "a1", activa: true, destinatario: "arrendatario", asunto: "Hola {{arrendatario}}", cuerpo: "Monto {{monto}}" });
    mockContratoFindFirst.mockResolvedValue(CONTRATO);

    const r = await enviarAlerta("a1", "c1");

    expect(r.ok).toBe(true);
    const data = mockNotifCreate.mock.calls[0][0].data;
    // Se crea PENDIENTE: "simulada" equivaldría a no enviarla nunca.
    expect(data.estado).toBe("pendiente");
    expect(data.asunto).toBe("Hola Ana");
    expect(data.alertaId).toBe("a1");
  });

  it("no puede enviar sobre un contrato que no tiene asignado", async () => {
    mockGetActor.mockResolvedValue(COLABORADOR);
    mockPropiedadIdsVisibles.mockResolvedValue(["otra-propiedad"]);
    mockAlertaFindFirst.mockResolvedValue({ id: "a1", activa: true, destinatario: "arrendatario", asunto: "x", cuerpo: "y" });
    mockContratoFindFirst.mockResolvedValue(null);   // el filtro por propiedad no lo encontró

    const r = await enviarAlerta("a1", "c1");

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no tienes acceso/i);
    expect(mockNotifCreate).not.toHaveBeenCalled();
  });

  it("una alerta desactivada no se envía", async () => {
    mockGetActor.mockResolvedValue(MANAGER);
    mockAlertaFindFirst.mockResolvedValue({ id: "a1", activa: false, destinatario: "arrendatario", asunto: "x", cuerpo: "y" });

    const r = await enviarAlerta("a1", "c1");

    expect(r.ok).toBe(false);
    expect(mockNotifCreate).not.toHaveBeenCalled();
  });
});
