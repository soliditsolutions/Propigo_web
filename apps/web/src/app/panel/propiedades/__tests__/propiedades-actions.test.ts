/**
 * Tests: buscarOCrearPersona — BL-RC3
 *
 * Verifica que la función usa `upsert` en lugar de findFirst+create,
 * eliminando la race condition check-then-act cuando dos requests
 * concurrentes intentan crear la misma persona (mismo RUT+tenantId).
 *
 * También cubre la validación de `asignadoAId` (ADR-0013, Fase C) en
 * `crearPropiedad`/`actualizarPropiedad`: exclusiva del Manager, con
 * rechazo server-side (mismo patrón ROL-SEC-3) para un Colaborador que
 * intente cambiarla, y registro en AuditoriaEquipo cuando sí cambia.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetTenant = vi.fn();
const mockGetActor  = vi.fn();
vi.mock("@/lib/queries", () => ({ getTenant: mockGetTenant, getActor: mockGetActor }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Map()) }));
vi.mock("@/lib/ip", () => ({ getClientIpFromHeaders: vi.fn(() => "203.0.113.1") }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("@/lib/geocoding", () => ({ geocodificarDireccion: vi.fn().mockResolvedValue(null) }));

const mockValidarRut = vi.fn();
vi.mock("@propigo/core", () => ({
  validarRut: mockValidarRut,
  // formatearRut: requerido por la fachada @/lib/rut.ts (canonicalRut/formatRut
  // son alias sobre @propigo/core) — sin este export el módulo lanza al cargar.
  formatearRut: vi.fn((r: string) => r),
  // Resto de exports que puedan importarse desde el módulo
  validarEmail: vi.fn(),
  esRegionValida: vi.fn(() => true),
  esComunaValidaEnRegion: vi.fn(() => true),
  esOrientacionValida: vi.fn(() => true),
}));

const mockPersonaUpsert       = vi.fn();
const mockPersonaFindFirst    = vi.fn();
const mockPersonaCreate       = vi.fn();
const mockPropiedadCreate     = vi.fn();
const mockPropiedadUpdate     = vi.fn();
const mockPropiedadFindFirst  = vi.fn();
/** Cupo de propiedades del plan (Fase B0) — por defecto, tenant muy por debajo
 * del límite para que estos tests sigan probando lo suyo (asignación y
 * auditoría) y no el cupo, que tiene sus propios tests. */
const mockPropiedadCount      = vi.fn().mockResolvedValue(0);
const mockUsuarioFindFirst    = vi.fn();
const mockAuditoriaCreate     = vi.fn();
const mockImagenDeleteMany    = vi.fn().mockResolvedValue(undefined);
const mockImagenCreateMany    = vi.fn().mockResolvedValue(undefined);
const mockCuentaCreateMany   = vi.fn().mockResolvedValue({});
const mockRolCompCreateMany  = vi.fn().mockResolvedValue({});
const mockPublicacionFindFirst  = vi.fn();
const mockPublicacionUpdate     = vi.fn().mockResolvedValue({});
const mockPublicacionCreate     = vi.fn().mockResolvedValue({});
const mockPublicacionUpdateMany = vi.fn().mockResolvedValue({});

// buscarOCrearPersona/crearPropiedad/actualizarPropiedad corren dentro de
// withTenant() (ADR-0011): $transaction invoca el callback con un tx que
// expone $executeRaw (SET LOCAL) y los modelos. Se comparten las mismas
// instancias mock entre acceso directo y el tx.
vi.mock("@/lib/db", () => {
  const models = {
    persona:         { upsert: mockPersonaUpsert, findFirst: mockPersonaFindFirst, create: mockPersonaCreate },
    propiedad:       { create: mockPropiedadCreate, update: mockPropiedadUpdate, findFirst: mockPropiedadFindFirst, findMany: vi.fn(), count: mockPropiedadCount },
    imagenPropiedad: { deleteMany: mockImagenDeleteMany, createMany: mockImagenCreateMany },
    cuentaServicio:    { createMany: mockCuentaCreateMany, deleteMany: vi.fn().mockResolvedValue({}) },
    rolComplementario: { createMany: mockRolCompCreateMany, deleteMany: vi.fn().mockResolvedValue({}) },
    usuario:         { findFirst: mockUsuarioFindFirst },
    auditoriaEquipo: { create: mockAuditoriaCreate },
    publicacion:     { findFirst: mockPublicacionFindFirst, update: mockPublicacionUpdate, create: mockPublicacionCreate, updateMany: mockPublicacionUpdateMany },
  };
  return {
    prisma: {
      ...models,
      $transaction: vi.fn((cb: (tx: unknown) => unknown) =>
        cb({ $executeRaw: vi.fn().mockResolvedValue(undefined), ...models }),
      ),
    },
  };
});

const { buscarOCrearPersona, crearPropiedad, actualizarPropiedad, activarPropiedad, desactivarPropiedad } = await import("../actions");

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("buscarOCrearPersona — validación de entrada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error cuando el nombre está vacío", async () => {
    const result = await buscarOCrearPersona({ nombre: "  ", rut: "11.111.111-1" });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/nombre es obligatorio/i) });
    expect(mockPersonaUpsert).not.toHaveBeenCalled();
  });

  it("retorna error cuando el RUT está vacío", async () => {
    const result = await buscarOCrearPersona({ nombre: "Juan García", rut: "" });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/rut es obligatorio/i) });
    expect(mockPersonaUpsert).not.toHaveBeenCalled();
  });

  it("retorna error cuando el RUT no es válido (dígito verificador incorrecto)", async () => {
    mockValidarRut.mockReturnValue(false);
    const result = await buscarOCrearPersona({ nombre: "Juan García", rut: "12.345.678-0" });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/dígito verificador/i) });
    expect(mockPersonaUpsert).not.toHaveBeenCalled();
  });
});

describe("buscarOCrearPersona — BL-RC3 (upsert en lugar de findFirst+create)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTenant.mockResolvedValue({ id: "tenant-abc" });
    mockValidarRut.mockReturnValue(true);
  });

  it("llama a prisma.persona.upsert (NO findFirst+create) para eliminar la race condition", async () => {
    mockPersonaUpsert.mockResolvedValue({ id: "persona-123" });

    await buscarOCrearPersona({ nombre: "Juan García", rut: "11.111.111-1" });

    expect(mockPersonaUpsert).toHaveBeenCalledTimes(1);
  });

  it("el upsert usa el compound unique tenantId_rut como where, con el RUT en forma canónica", async () => {
    mockPersonaUpsert.mockResolvedValue({ id: "persona-123" });

    await buscarOCrearPersona({ nombre: "Juan García", rut: "11.111.111-1" });

    // AUD-03/06: el RUT se guarda SIN puntos — debe coincidir con el formato
    // que usa el portal de autoconsulta (normalizarRut) al buscar por RUT.
    expect(mockPersonaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_rut: { tenantId: "tenant-abc", rut: "11111111-1" } },
      }),
    );
  });

  it("AUD-03/06 (regresión): un RUT ingresado con puntos se guarda canónico (sin puntos)", async () => {
    mockPersonaUpsert.mockResolvedValue({ id: "persona-nueva-999" });

    // Mismo RUT en dos formatos distintos — con puntos (como lo autoformatea
    // la UI) y sin puntos — deben producir exactamente el mismo valor
    // canónico, tanto en el "where" de búsqueda como en el "create".
    await buscarOCrearPersona({ nombre: "Pedro Arrendatario", rut: "15.111.222-6" });
    const llamadaConPuntos = mockPersonaUpsert.mock.calls[0][0];

    vi.clearAllMocks();
    mockGetTenant.mockResolvedValue({ id: "tenant-abc" });
    mockValidarRut.mockReturnValue(true);
    mockPersonaUpsert.mockResolvedValue({ id: "persona-nueva-999" });

    await buscarOCrearPersona({ nombre: "Pedro Arrendatario", rut: "15111222-6" });
    const llamadaSinPuntos = mockPersonaUpsert.mock.calls[0][0];

    expect(llamadaConPuntos.where.tenantId_rut.rut).toBe("15111222-6");
    expect(llamadaConPuntos.create.rut).toBe("15111222-6");
    expect(llamadaSinPuntos.where.tenantId_rut.rut).toBe("15111222-6");
    expect(llamadaConPuntos).toEqual(llamadaSinPuntos);
  });

  it("el upsert tiene update:{} para no sobreescribir datos existentes", async () => {
    mockPersonaUpsert.mockResolvedValue({ id: "persona-existente-456" });

    await buscarOCrearPersona({ nombre: "Juan García", rut: "11.111.111-1" });

    expect(mockPersonaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });

  it("retorna el id de la persona (nueva o existente) que devuelve upsert", async () => {
    mockPersonaUpsert.mockResolvedValue({ id: "persona-existente-456" });

    const result = await buscarOCrearPersona({ nombre: "Juan García", rut: "11.111.111-1" });

    expect(result).toEqual({ ok: true, id: "persona-existente-456" });
  });

  it("propaga email y teléfono al bloque create del upsert", async () => {
    mockPersonaUpsert.mockResolvedValue({ id: "persona-nueva-789" });

    await buscarOCrearPersona({
      nombre: "María López", rut: "11.111.111-1",
      email: "maria@correo.cl", telefono: "+56912345678",
    });

    expect(mockPersonaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          email: "maria@correo.cl",
          telefono: "+56912345678",
        }),
      }),
    );
  });

  it("retorna error genérico si el upsert lanza (ej. violación de constraint inesperada)", async () => {
    mockPersonaUpsert.mockRejectedValue(new Error("DB error"));

    const result = await buscarOCrearPersona({ nombre: "Juan García", rut: "11.111.111-1" });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/intenta nuevamente/i) });
  });
});

// ── ADR-0013 (Fase C) — asignadoAId en actualizarPropiedad ──────────────────────

const DATA_EDITAR_BASE = {
  tipo: "casa",
  direccion: "Av. Siempre Viva 742",
  // El rol y las cuentas son obligatorios también al editar: editar no puede
  // dejar una propiedad en un estado que el alta no habría aceptado.
  rol: "573-24",
  cuentas: (["agua", "luz", "gas", "gastos_comunes"] as const).map((tipo) => ({
    tipo, estado: "no_aplica" as const, paga: "arrendatario" as const,
  })),
  esCondominio: false,
  pagaGastosComunes: false,
  aceptaMascotas: false,
  mostrarUbicacionExacta: false,
};

describe("actualizarPropiedad — asignadoAId (ROL-UI-5 / ROL-SEC-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropiedadUpdate.mockResolvedValue({});
    mockAuditoriaCreate.mockResolvedValue({});
  });

  it("rechaza server-side si un Colaborador intenta cambiar la asignación a otro valor (dueño de la propiedad)", async () => {
    // ADR-0013 (Fase D): el chequeo de ownership exige que el actor sea el
    // dueño actual para siquiera llegar a esta lógica — de lo contrario lo
    // rechaza antes por "No tienes acceso" (ver test de Fase D más abajo).
    mockGetActor.mockResolvedValue({ usuarioId: "colab-1", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1" });

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, asignadoAId: "colab-2" });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/solo el administrador/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
    expect(mockAuditoriaCreate).not.toHaveBeenCalled();
  });

  it("un Colaborador que reenvía el mismo asignadoAId actual (sin cambio real) no es bloqueado", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-1", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1" });

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, asignadoAId: "colab-1" });

    expect(result).toEqual({ ok: true });
    expect(mockPropiedadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asignadoAId: "colab-1" }) }),
    );
    expect(mockAuditoriaCreate).not.toHaveBeenCalled();
  });

  it("el campo ausente (Colaborador — la UI no lo renderiza) deja la asignación intacta sin chequear rol", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-1", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1" });

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE }); // sin asignadoAId

    expect(result).toEqual({ ok: true });
    expect(mockPropiedadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asignadoAId: "colab-1" }) }),
    );
    expect(mockAuditoriaCreate).not.toHaveBeenCalled();
  });

  it("ADR-0013 (Fase D): rechaza si un Colaborador intenta editar una propiedad que NO tiene asignada", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-x", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1" }); // asignada a OTRO colaborador

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/no tienes acceso/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
  });

  it("el Manager asigna una propiedad a un colaborador válido — persiste y audita asignar_propiedad", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: null });
    mockUsuarioFindFirst.mockResolvedValue({ id: "colab-1" });

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, asignadoAId: "colab-1" });

    expect(result).toEqual({ ok: true });
    expect(mockUsuarioFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "colab-1", tenantId: "tenant-abc", rol: "colaborador", desactivadoEn: null }),
      }),
    );
    expect(mockPropiedadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asignadoAId: "colab-1" }) }),
    );
    expect(mockAuditoriaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "asignar_propiedad", objetivoId: "colab-1", propiedadId: "prop-1" }),
      }),
    );
  });

  it("el Manager desasigna explícitamente ('Sin asignar') — persiste null y audita desasignar_propiedad con el colaborador anterior", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1" });

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, asignadoAId: "" });

    expect(result).toEqual({ ok: true });
    expect(mockPropiedadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asignadoAId: null }) }),
    );
    expect(mockAuditoriaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "desasignar_propiedad", objetivoId: "colab-1" }),
      }),
    );
  });

  it("el Manager reasigna directo de un colaborador a otro (sin pasar por 'sin asignar') — audita con el nuevo colaborador (ROL-FLU-1)", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1" });
    mockUsuarioFindFirst.mockResolvedValue({ id: "colab-2" });

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, asignadoAId: "colab-2" });

    expect(result).toEqual({ ok: true });
    expect(mockPropiedadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asignadoAId: "colab-2" }) }),
    );
    expect(mockAuditoriaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "asignar_propiedad", objetivoId: "colab-2" }),
      }),
    );
  });

  it("rechaza si el Manager intenta asignar a un colaborador inválido (otro tenant, desactivado, o inexistente)", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: null });
    mockUsuarioFindFirst.mockResolvedValue(null);

    const result = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, asignadoAId: "colab-ajeno" });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/no es válido/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
    expect(mockAuditoriaCreate).not.toHaveBeenCalled();
  });
});

// ── ADR-0013 (Fase C) — asignadoAId en crearPropiedad ───────────────────────────

/** Las 4 cuentas obligatorias, declaradas (G-02 + G-05). */
const CUENTAS_OK = [
  { tipo: "agua"           as const, estado: "registrada" as const, numero: "1", paga: "arrendatario" as const },
  { tipo: "luz"            as const, estado: "registrada" as const, numero: "2", paga: "arrendatario" as const },
  { tipo: "gas"            as const, estado: "no_aplica"  as const, numero: null, paga: "arrendatario" as const },
  { tipo: "gastos_comunes" as const, estado: "registrada" as const, numero: "4", paga: "propietario"  as const },
];

const DATA_CREAR_BASE = {
  tipo: "casa",
  direccion: "Av. Siempre Viva 742",
  rol: "573-24",
  cuentas: CUENTAS_OK,
  esCondominio: false,
  pagaGastosComunes: false,
  aceptaMascotas: false,
  mostrarUbicacionExacta: false,
  propietarioNombre: "Juan Propietario",
  propietarioRut: "11.111.111-1",
};

describe("crearPropiedad — rol y cuentas obligatorios (grupo 1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidarRut.mockReturnValue(true);
    mockPersonaFindFirst.mockResolvedValue({ id: "persona-1" });
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadCreate.mockResolvedValue({ id: "prop-1" });
    mockCuentaCreateMany.mockResolvedValue({});
    mockRolCompCreateMany.mockResolvedValue({});
  });

  it("guarda el rol normalizado, no como lo escribió el corredor", async () => {
    await crearPropiedad({ ...DATA_CREAR_BASE, rol: " 573 - 24 " });

    expect(mockPropiedadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol: "573-24" }) }),
    );
  });

  it("rechaza un rol inválido SIN tocar la base", async () => {
    const r = await crearPropiedad({ ...DATA_CREAR_BASE, rol: "no-es-rol" });

    expect(r.ok).toBe(false);
    expect(mockPropiedadCreate).not.toHaveBeenCalled();
    expect(mockCuentaCreateMany).not.toHaveBeenCalled();
  });

  it("rechaza si falta declarar un servicio obligatorio", async () => {
    const sinLuz = CUENTAS_OK.filter((c) => c.tipo !== "luz");
    const r = await crearPropiedad({ ...DATA_CREAR_BASE, cuentas: sinLuz });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/luz/i);
    expect(mockPropiedadCreate).not.toHaveBeenCalled();
  });

  it("persiste las cuatro cuentas en la misma transacción que la propiedad", async () => {
    await crearPropiedad({ ...DATA_CREAR_BASE });

    expect(mockCuentaCreateMany).toHaveBeenCalledTimes(1);
    const filas = mockCuentaCreateMany.mock.calls[0][0].data;
    expect(filas).toHaveLength(4);
    expect(filas.every((f: { propiedadId: string }) => f.propiedadId === "prop-1")).toBe(true);
  });

  it("un servicio 'no aplica' se guarda sin número", async () => {
    // Un número huérfano bajo un "no aplica" lo lee alguien después como dato bueno.
    await crearPropiedad({
      ...DATA_CREAR_BASE,
      cuentas: CUENTAS_OK.map((c) =>
        c.tipo === "gas" ? { ...c, estado: "no_aplica" as const, numero: "123" } : c),
    });

    const gas = mockCuentaCreateMany.mock.calls[0][0].data.find((f: { tipo: string }) => f.tipo === "gas");
    expect(gas.numero).toBeNull();
  });

  it("sin roles complementarios no se escribe esa tabla", async () => {
    await crearPropiedad({ ...DATA_CREAR_BASE });
    expect(mockRolCompCreateMany).not.toHaveBeenCalled();
  });

  it("guarda los roles complementarios normalizados cuando se declaran", async () => {
    await crearPropiedad({
      ...DATA_CREAR_BASE,
      rolesComplementarios: [{ tipo: "bodega" as const, rol: " 573 - 26 ", descripcion: "Bodega 7" }],
    });

    const filas = mockRolCompCreateMany.mock.calls[0][0].data;
    expect(filas[0].rol).toBe("573-26");
    expect(filas[0].tipo).toBe("bodega");
  });

  it("rechaza dos complementos con el mismo rol", async () => {
    const r = await crearPropiedad({
      ...DATA_CREAR_BASE,
      rolesComplementarios: [
        { tipo: "bodega" as const,          rol: "573-26" },
        { tipo: "estacionamiento" as const, rol: "573-26" },
      ],
    });

    expect(r.ok).toBe(false);
    expect(mockPropiedadCreate).not.toHaveBeenCalled();
  });
});

describe("crearPropiedad — asignadoAId (ROL-UI-5 / ROL-SEC-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidarRut.mockReturnValue(true);
    mockPersonaFindFirst.mockResolvedValue({ id: "persona-1" });
    mockAuditoriaCreate.mockResolvedValue({});
  });

  it("rechaza si un Colaborador intenta asignar una propiedad recién creada", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-x", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });

    const result = await crearPropiedad({ ...DATA_CREAR_BASE, asignadoAId: "colab-1" });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/solo el administrador/i) });
    expect(mockPropiedadCreate).not.toHaveBeenCalled();
  });

  it("el Manager crea una propiedad ya asignada a un colaborador válido — persiste y audita asignar_propiedad", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockUsuarioFindFirst.mockResolvedValue({ id: "colab-1" });
    mockPropiedadCreate.mockResolvedValue({ id: "prop-nueva-1" });

    const result = await crearPropiedad({ ...DATA_CREAR_BASE, asignadoAId: "colab-1" });

    expect(result).toEqual({ ok: true, id: "prop-nueva-1" });
    expect(mockPropiedadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asignadoAId: "colab-1" }) }),
    );
    expect(mockAuditoriaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accion: "asignar_propiedad", objetivoId: "colab-1", propiedadId: "prop-nueva-1" }),
      }),
    );
  });

  it("una propiedad creada sin asignadoAId queda sin asignar y no genera auditoría", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadCreate.mockResolvedValue({ id: "prop-nueva-2" });

    const result = await crearPropiedad({ ...DATA_CREAR_BASE });

    expect(result).toEqual({ ok: true, id: "prop-nueva-2" });
    expect(mockPropiedadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ asignadoAId: null }) }),
    );
    expect(mockAuditoriaCreate).not.toHaveBeenCalled();
  });
});

// ── ADR-0013 (Fase D) — un Colaborador crea, activa y desactiva solo lo suyo ────

describe("crearPropiedad — exclusivo del Manager (Fase D)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rechaza si un Colaborador intenta crear una propiedad (aunque no envíe asignadoAId)", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-1", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });

    const result = await crearPropiedad({ ...DATA_CREAR_BASE });

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/solo el administrador/i) });
    expect(mockPropiedadCreate).not.toHaveBeenCalled();
  });
});

describe("activarPropiedad / desactivarPropiedad — ownership (Fase D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropiedadUpdate.mockResolvedValue({});
  });

  it("desactivarPropiedad rechaza si el Colaborador no es el dueño asignado", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-x", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1", direccion: "Calle 1" });

    const result = await desactivarPropiedad("prop-1");

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/no tienes acceso/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
  });

  it("desactivarPropiedad permite al Colaborador dueño de la propiedad", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-1", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1", direccion: "Calle 1" });

    const result = await desactivarPropiedad("prop-1");

    expect(result).toEqual({ ok: true });
    expect(mockPropiedadUpdate).toHaveBeenCalled();
  });

  it("activarPropiedad rechaza si el Colaborador no es el dueño asignado", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-x", tenantId: "tenant-abc", rol: "colaborador", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1", direccion: "Calle 1" });

    const result = await activarPropiedad("prop-1");

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/no tienes acceso/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
  });

  it("activarPropiedad permite al Manager sobre cualquier propiedad del tenant", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: "colab-1", direccion: "Calle 1" });
    mockPublicacionFindFirst.mockResolvedValue(null);

    const result = await activarPropiedad("prop-1");

    expect(result).toEqual({ ok: true });
    expect(mockPropiedadUpdate).toHaveBeenCalled();
  });
});

describe("actualizarPropiedad — rol y cuentas (hallazgo QA 2026-08-26)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPropiedadUpdate.mockResolvedValue({});
    mockCuentaCreateMany.mockResolvedValue({});
    mockRolCompCreateMany.mockResolvedValue({});
    mockGetActor.mockResolvedValue({ usuarioId: "manager-1", tenantId: "tenant-abc", rol: "manager", tenant: {} });
    mockPropiedadFindFirst.mockResolvedValue({ id: "prop-1", asignadoAId: null });
  });

  it("guarda el rol editado", async () => {
    // Se comprobó en el navegador: el formulario de edición mostraba el rol
    // nuevo, el guardado decía que había salido bien, y la base conservaba el
    // valor anterior. La acción ni siquiera recibía el campo.
    const r = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, rol: "4242-99" });

    expect(r).toEqual({ ok: true });
    expect(mockPropiedadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol: "4242-99" }) }),
    );
  });

  it("normaliza el rol antes de guardarlo, igual que al crear", async () => {
    await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, rol: " 4242 – 99 " });
    expect(mockPropiedadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol: "4242-99" }) }),
    );
  });

  it("reemplaza las cuentas de servicios", async () => {
    await actualizarPropiedad("prop-1", {
      ...DATA_EDITAR_BASE,
      cuentas: [
        { tipo: "agua", estado: "registrada", numero: "AA-1", paga: "arrendatario" },
        { tipo: "luz",  estado: "no_aplica",  paga: "propietario" },
        { tipo: "gas",  estado: "no_aplica",  paga: "arrendatario" },
        { tipo: "gastos_comunes", estado: "no_aplica", paga: "propietario" },
      ],
    });

    const guardadas = mockCuentaCreateMany.mock.calls[0][0].data;
    expect(guardadas).toHaveLength(4);
    expect(guardadas[0]).toMatchObject({ tipo: "agua", numero: "AA-1" });
    // El "no aplica" no arrastra número, ni siquiera si venía en la petición.
    expect(guardadas[1]).toMatchObject({ tipo: "luz", numero: null });
  });

  it("rechaza un rol inválido sin tocar la base", async () => {
    const r = await actualizarPropiedad("prop-1", { ...DATA_EDITAR_BASE, rol: "0-0" });

    expect(r).toEqual({ ok: false, error: expect.stringMatching(/cero/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
  });

  it("rechaza dejar una propiedad sin la cuenta de gas al editar", async () => {
    // Editar no puede ser la puerta de atrás para un estado que el alta habría
    // rechazado.
    const r = await actualizarPropiedad("prop-1", {
      ...DATA_EDITAR_BASE,
      cuentas: DATA_EDITAR_BASE.cuentas.filter((c) => c.tipo !== "gas"),
    });

    expect(r).toEqual({ ok: false, error: expect.stringMatching(/gas/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
  });

  it("rechaza un complemento con el mismo rol que la propiedad", async () => {
    const r = await actualizarPropiedad("prop-1", {
      ...DATA_EDITAR_BASE,
      rol: "573-24",
      rolesComplementarios: [{ tipo: "bodega", rol: "573-24" }],
    });

    expect(r).toEqual({ ok: false, error: expect.stringMatching(/es el de la propiedad/i) });
    expect(mockPropiedadUpdate).not.toHaveBeenCalled();
  });
});
