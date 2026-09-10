/**
 * Tests: cobros/actions — BL-RC1 (simularPago) + BL-RC2 (cerrarLiquidacion)
 *
 * Verifica la protección contra doble-submit (race condition) mediante la
 * compuerta atómica updateMany + estado en transacciones interactivas Prisma.
 * Cuando count=0, la TX se revierte y se retorna un error descriptivo al cliente.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetActor = vi.fn();
vi.mock("@/lib/queries", () => ({ getActor: mockGetActor }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Mock del cliente Prisma — la TX interactiva se simula llamando al callback con mockTx
const mockPrismaTransaction = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: mockPrismaTransaction },
}));

// Mock de las funciones puras de @housing/core para controlar el flujo en cada test
const mockConciliar    = vi.fn();
const mockCalcLiq      = vi.fn();
vi.mock("@housing/core", () => ({
  calcularMora:       vi.fn().mockReturnValue({ diasAtraso: 0, interesCLP: 0 }),
  conciliar:          mockConciliar,
  calcularLiquidacion: mockCalcLiq,
  convertirUfAClp:    vi.fn().mockReturnValue(500000),
  redondearPeso:      vi.fn().mockReturnValue(500000),
  esPeriodoDeReajuste: vi.fn().mockReturnValue(false),
  aplicarReajusteIpc: vi.fn(),
  variacionIpc:       vi.fn(),
  // Lo usa el snapshot de liquidación (IVA de comisión). Implementación real y
  // simple: afecta si es persona jurídica, exenta si natural (DL 825 art. 12 E N°8).
  ivaComision: (comisionClp: number, esPJ: boolean) => {
    const ivaCLP = esPJ ? Math.round((comisionClp * 19) / 100) : 0;
    return { afecto: esPJ, baseImponibleCLP: comisionClp, ivaCLP, totalCLP: comisionClp + ivaCLP, deduccionAvaluoCLP: 0 };
  },
}));

// mockTx simula el objeto de transacción que Prisma pasa al callback interactivo.
// withTenant() (ADR-0011) ejecuta `tx.$executeRaw` (SET LOCAL app.current_tenant_id)
// antes del callback de negocio, así que el mock debe exponerlo.
const mockTx = {
  $executeRaw:       vi.fn().mockResolvedValue(undefined),
  periodoPago:       { findFirst: vi.fn(), updateMany: vi.fn() },
  serieUf:           { findFirst: vi.fn() },
  serieIpc:          { findUnique: vi.fn() },
  asientoLedger:     { findFirst: vi.fn(), create: vi.fn() },
  contrato:          { update: vi.fn() },
  voucher:           { create: vi.fn() },
  notificacion:      { create: vi.fn() },
  pagoEntrante:      { create: vi.fn() },
  ajusteLiquidacion: { create: vi.fn() },
  folioCounter:      { upsert: vi.fn() },
  cuentaBancaria:    { findFirst: vi.fn() },
};

// Datos del inmueble y las partes que el snapshot del comprobante congela
// (L-CP3). Se agregan a los contratos mock para que datosDocumento() no falle.
const partesMock = {
  propiedad:    { asignadoAId: null, direccion: "Calle Falsa 123", comuna: "Santiago", rol: "573-24", avaluoFiscal: null },
  arrendatario: { nombre: "Ana Arrendataria", rut: "11111111-1" },
  propietario:  { nombre: "Pedro Propietario", rut: "22222222-2" },
};

// Período base para tests de simularPago (contrato CLP, sin reajuste)
const periodoBase = {
  id: "periodo-123",
  numero: 3,
  fechaVencimiento: new Date("2026-05-05T00:00:00Z"),
  montoGastoComun: "0",
  contrato: {
    id: "contrato-123",
    denominacion: "CLP",
    valorArriendo: "500000",
    moraTasaPct: "0.033",
    moraDiasGracia: 3,
    comisionCorredorPct: "0.06",
    cobraGastoComun: false,
    arrendatarioId: "arrendatario-123",
    propietarioId: "propietario-123",
    reajuste: "ninguna",
    fechaInicio: new Date("2025-05-01T00:00:00Z"),
    ...partesMock,
  },
};

const { simularPago, cerrarLiquidacion } = await import("../actions");

// ── Suite ─────────────────────────────────────────────────────────────────────

describe("simularPago — validación de entrada (sin TX)", () => {
  it("retorna error cuando el monto es cero", async () => {
    const result = await simularPago("p1", "2026-06-18", 0);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/monto inválido/i) });
  });

  it("retorna error cuando el monto es negativo", async () => {
    const result = await simularPago("p1", "2026-06-18", -500);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/monto inválido/i) });
  });

  it("retorna error cuando la fecha no cumple el formato YYYY-MM-DD", async () => {
    const result = await simularPago("p1", "18-06-2026", 500000);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/fecha inválida/i) });
  });

  it("retorna error cuando la fecha es una cadena vacía", async () => {
    const result = await simularPago("p1", "", 500000);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/fecha inválida/i) });
  });
});

describe("simularPago — BL-RC1 (idempotencia contra doble-submit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: { id: "tenant-abc", nombre: "Corredora QA SpA", rut: "76123456-0", giro: "Corretaje", direccion: "Av. Siempre Viva 100", esPersonaJuridica: true } });
    // Simula TX interactiva llamando al callback con mockTx
    mockPrismaTransaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx),
    );
    mockTx.folioCounter.upsert.mockResolvedValue({ ultimo: 1 });
    mockTx.cuentaBancaria.findFirst.mockResolvedValue(null);
    mockConciliar.mockReturnValue({
      estado: "conciliado", totalEsperado: 500000, diferencia: 0,
    });
  });

  it("retorna error descriptivo cuando el período ya fue procesado simultáneamente (BL-RC1)", async () => {
    mockTx.periodoPago.findFirst.mockResolvedValue(periodoBase);
    // updateMany devuelve 0 → otra TX concurrente ya procesó este período
    mockTx.periodoPago.updateMany.mockResolvedValue({ count: 0 });

    const result = await simularPago("periodo-123", "2026-06-18", 500000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/simultáneamente/i);
    }
    // No se deben haber creado asientos
    expect(mockTx.asientoLedger.create).not.toHaveBeenCalled();
  });

  it("retorna error cuando el período no existe o no está en estado 'atrasado'", async () => {
    mockTx.periodoPago.findFirst.mockResolvedValue(null);

    const result = await simularPago("periodo-123", "2026-06-18", 500000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/ya fue procesado/i);
    }
  });

  it("crea los asientos cuando el gate devuelve count=1 (happy path TX)", async () => {
    mockTx.periodoPago.findFirst.mockResolvedValue(periodoBase);
    mockTx.periodoPago.updateMany.mockResolvedValue({ count: 1 });
    mockTx.asientoLedger.create.mockResolvedValue({});
    mockTx.voucher.create.mockResolvedValue({});
    mockTx.notificacion.create.mockResolvedValue({});

    const result = await simularPago("periodo-123", "2026-06-18", 500000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.estado).toBe("conciliado");
    }
    expect(mockTx.asientoLedger.create).toHaveBeenCalled();
  });
});

describe("cerrarLiquidacion — validación de entrada (sin TX)", () => {
  it("retorna error cuando un ajuste tiene monto cero", async () => {
    const result = await cerrarLiquidacion("p1", [
      { tipo: "cargo_arrendatario", montoCLP: 0, descripcion: "roto" },
    ]);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/monto de ajuste inválido/i) });
  });

  it("retorna error cuando un ajuste no tiene descripción", async () => {
    const result = await cerrarLiquidacion("p1", [
      { tipo: "cargo_arrendatario", montoCLP: 50000, descripcion: "  " },
    ]);
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/descripción/i) });
  });
});

describe("cerrarLiquidacion — BL-RC2 (idempotencia contra doble-submit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: { id: "tenant-abc", nombre: "Corredora QA SpA", rut: "76123456-0", giro: "Corretaje", direccion: "Av. Siempre Viva 100", esPersonaJuridica: true } });
    mockPrismaTransaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx),
    );
    mockTx.folioCounter.upsert.mockResolvedValue({ ultimo: 1 });
    mockTx.cuentaBancaria.findFirst.mockResolvedValue(null);
    mockCalcLiq.mockReturnValue({
      comisionCLP: 30000,
      ivaComisionCLP: 0,
      descuentoPropietarioCLP: 0,
      liquidacionNetaCLP: 470000,
    });
  });

  it("retorna error descriptivo cuando el período ya fue liquidado simultáneamente (BL-RC2)", async () => {
    mockTx.periodoPago.findFirst.mockResolvedValue({
      ...periodoBase,
      contrato: {
        id: "contrato-123",
        denominacion: "CLP",
        comisionCorredorPct: "0.06",
        arrendatarioId: "arrendatario-123",
        propietarioId: "propietario-123",
        ...partesMock,
      },
    });
    mockTx.asientoLedger.findFirst
      .mockResolvedValueOnce({
        montoClp: "500000",
        fechaEvento: new Date(),
        ufAplicada: null,
        valorOrigen: null,
      })
      .mockResolvedValueOnce(null);
    // gate devuelve 0 → otra TX ya liquidó
    mockTx.periodoPago.updateMany.mockResolvedValue({ count: 0 });

    const result = await cerrarLiquidacion("periodo-123", []);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/simultáneamente/i);
    }
    expect(mockTx.asientoLedger.create).not.toHaveBeenCalled();
  });

  it("retorna error cuando el período no existe o no está en estado 'pagado'", async () => {
    mockTx.periodoPago.findFirst.mockResolvedValue(null);

    const result = await cerrarLiquidacion("periodo-123", []);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/ya fue liquidado/i);
    }
  });
});

describe("cerrarLiquidacion — las notificaciones deben SALIR de verdad", () => {
  // Regresión: ambas notificaciones se creaban con estado "simulada", y el
  // despachador (enviarNotificacionesPendientes) solo toma las "pendiente".
  // Resultado: el voucher se generaba pero el propietario nunca recibía su
  // aviso de liquidación. Los tests existentes no miraban el estado, así que
  // el fallo era invisible — esto lo deja fijado.
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActor.mockResolvedValue({ usuarioId: "mgr-1", tenantId: "tenant-abc", rol: "manager", tenant: { id: "tenant-abc", nombre: "Corredora QA SpA", rut: "76123456-0", giro: "Corretaje", direccion: "Av. Siempre Viva 100", esPersonaJuridica: true } });
    mockPrismaTransaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx),
    );
    mockTx.folioCounter.upsert.mockResolvedValue({ ultimo: 1 });
    mockTx.cuentaBancaria.findFirst.mockResolvedValue(null);
    mockCalcLiq.mockReturnValue({
      comisionCLP: 30000,
      ivaComisionCLP: 0,
      descuentoPropietarioCLP: 0,
      liquidacionNetaCLP: 470000,
    });
    mockTx.periodoPago.findFirst.mockResolvedValue({
      ...periodoBase,
      contrato: {
        id: "contrato-123",
        denominacion: "CLP",
        comisionCorredorPct: "0.06",
        arrendatarioId: "arrendatario-123",
        propietarioId: "propietario-123",
        ...partesMock,
      },
    });
    mockTx.asientoLedger.findFirst
      .mockResolvedValueOnce({ montoClp: "500000", fechaEvento: new Date(), ufAplicada: null, valorOrigen: null })
      .mockResolvedValueOnce(null);
    mockTx.periodoPago.updateMany.mockResolvedValue({ count: 1 });
    mockTx.voucher.create.mockResolvedValue({});
    mockTx.notificacion.create.mockResolvedValue({});
  });

  it("crea ambas notificaciones como \"pendiente\", nunca \"simulada\"", async () => {
    await cerrarLiquidacion("periodo-123", []);

    const estados = mockTx.notificacion.create.mock.calls.map((c) => c[0].data.estado);
    expect(estados.length).toBeGreaterThanOrEqual(2);
    expect(estados).not.toContain("simulada");
    for (const e of estados) expect(e).toBe("pendiente");
  });

  it("el propietario recibe el desglose, no solo el total", async () => {
    await cerrarLiquidacion("periodo-123", []);

    const alPropietario = mockTx.notificacion.create.mock.calls
      .map((c) => c[0].data)
      .find((d) => d.tipo === "liquidacion_propietario");

    expect(alPropietario).toBeDefined();
    // Sin desglose el destinatario no puede cuadrar de dónde sale el neto.
    expect(alPropietario!.cuerpo).toMatch(/Arriendo:/);
    expect(alPropietario!.cuerpo).toMatch(/Comisión corredor:/);
    expect(alPropietario!.cuerpo).toMatch(/Neto a pagar:/);
  });

  it("crea el asiento IVA_COMISION cuando la corredora es persona jurídica (L-IV)", async () => {
    // La corredora del mock es persona jurídica, así que la comisión va afecta.
    // calcularLiquidacion (mockeado) devuelve el IVA; la acción debe escribir su
    // asiento aparte, con el monto que entregó el cálculo.
    mockCalcLiq.mockReturnValue({
      comisionCLP: 30000,
      ivaComisionCLP: 5700,      // 30.000 × 19%
      descuentoPropietarioCLP: 0,
      liquidacionNetaCLP: 464300, // 500.000 − 30.000 − 5.700
    });

    await cerrarLiquidacion("periodo-123", []);

    const asientos = mockTx.asientoLedger.create.mock.calls.map((c) => c[0].data);
    const ivaAsiento = asientos.find((d) => d.tipo === "IVA_COMISION");
    expect(ivaAsiento).toBeDefined();
    expect(ivaAsiento!.montoClp).toBe(5700);
    // Y la corredora recibe la afectación: calcularLiquidacion fue llamado con la marca.
    expect(mockCalcLiq).toHaveBeenCalledWith(expect.objectContaining({ comisionAfectaIva: true }));
  });

  it("NO crea asiento IVA_COMISION cuando el IVA es cero (persona natural)", async () => {
    mockCalcLiq.mockReturnValue({
      comisionCLP: 30000, ivaComisionCLP: 0,
      descuentoPropietarioCLP: 0, liquidacionNetaCLP: 470000,
    });
    await cerrarLiquidacion("periodo-123", []);
    const asientos = mockTx.asientoLedger.create.mock.calls.map((c) => c[0].data);
    expect(asientos.find((d) => d.tipo === "IVA_COMISION")).toBeUndefined();
  });

  it("congela la cuenta del propietario en el snapshot de la liquidación (L-DT6)", async () => {
    mockCalcLiq.mockReturnValue({
      comisionCLP: 30000, ivaComisionCLP: 0,
      descuentoPropietarioCLP: 0, liquidacionNetaCLP: 470000,
    });
    mockTx.cuentaBancaria.findFirst.mockResolvedValue({
      banco: "Banco Estado", tipo: "vista", numero: "12345678",
      titular: "Propietario QA", rutTitular: "16358920-6",
    });

    await cerrarLiquidacion("periodo-123", []);

    const voucherArg = mockTx.voucher.create.mock.calls.find((c) => c[0].data.tipo === "liquidacion");
    expect(voucherArg).toBeDefined();
    const snap = voucherArg![0].data.snapshot;
    expect(snap.cuentaPropietario).toBeDefined();
    expect(snap.cuentaPropietario.banco).toBe("Banco Estado");
    expect(snap.cuentaPropietario.numero).toBe("12345678");
  });
});

describe("simularPago — ownership (ADR-0013, Fase D)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaTransaction.mockImplementation(
      async (callback: (tx: typeof mockTx) => Promise<unknown>) => callback(mockTx),
    );
    mockTx.folioCounter.upsert.mockResolvedValue({ ultimo: 1 });
    mockTx.cuentaBancaria.findFirst.mockResolvedValue(null);
    mockConciliar.mockReturnValue({ estado: "conciliado", totalEsperado: 500000, diferencia: 0 });
  });

  it("rechaza si un Colaborador intenta conciliar el pago de una propiedad que no tiene asignada", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-x", tenantId: "tenant-abc", rol: "colaborador", tenant: { id: "tenant-abc", nombre: "Corredora QA SpA", rut: "76123456-0", giro: "Corretaje", direccion: "Av. Siempre Viva 100", esPersonaJuridica: true } });
    mockTx.periodoPago.findFirst.mockResolvedValue({
      ...periodoBase,
      contrato: { ...periodoBase.contrato, propiedad: { asignadoAId: "colab-1" } },
    });

    const result = await simularPago("periodo-123", "2026-06-18", 500000);

    expect(result).toEqual({ ok: false, error: expect.stringMatching(/no tienes acceso/i) });
    expect(mockTx.periodoPago.updateMany).not.toHaveBeenCalled();
  });

  it("permite al Colaborador dueño de la propiedad conciliar su propio pago", async () => {
    mockGetActor.mockResolvedValue({ usuarioId: "colab-1", tenantId: "tenant-abc", rol: "colaborador", tenant: { id: "tenant-abc", nombre: "Corredora QA SpA", rut: "76123456-0", giro: "Corretaje", direccion: "Av. Siempre Viva 100", esPersonaJuridica: true } });
    mockTx.periodoPago.findFirst.mockResolvedValue({
      ...periodoBase,
      contrato: { ...periodoBase.contrato, propiedad: { asignadoAId: "colab-1" } },
    });
    mockTx.periodoPago.updateMany.mockResolvedValue({ count: 1 });
    mockTx.asientoLedger.create.mockResolvedValue({});
    mockTx.voucher.create.mockResolvedValue({});
    mockTx.notificacion.create.mockResolvedValue({});

    const result = await simularPago("periodo-123", "2026-06-18", 500000);

    expect(result.ok).toBe(true);
  });
});
