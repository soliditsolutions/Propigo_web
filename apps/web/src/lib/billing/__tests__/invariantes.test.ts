/**
 * INVARIANTES DE BILLING — ADR-0014, fila P-A4 del rowMap.
 *
 * Estas pruebas no verifican una funcionalidad: verifican reglas que **nunca**
 * pueden romperse, por caras que salgan de descubrir en producción. Están
 * escritas ANTES que la lógica que podría violarlas, a propósito.
 *
 * Si una de estas falla, no se "arregla el test": se revisa por qué el código
 * intentó cruzar una línea que este ADR trazó a conciencia.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";

import { esReintentable, type CategoriaErrorCobro } from "../gateway";
import { FakeBillingGateway, crearGatewayDeEntorno } from "../fake-gateway";
import { getCupoUsuarios } from "../../plans";

const raizApp = resolve(__dirname, "../../../..");
const schemaPrisma = readFileSync(resolve(raizApp, "prisma/schema.prisma"), "utf8");
const setupSql = readFileSync(resolve(raizApp, "prisma/sql/setup.sql"), "utf8");

/** Extrae el cuerpo de un `enum X { ... }` o `model X { ... }` del schema. */
function bloqueDelSchema(tipo: "enum" | "model", nombre: string): string {
  const re = new RegExp(`${tipo}\\s+${nombre}\\s*\\{([\\s\\S]*?)\\n\\}`, "m");
  const match = schemaPrisma.match(re);
  if (!match) throw new Error(`No se encontró ${tipo} ${nombre} en schema.prisma`);
  return match[1];
}

describe("Invariante 1 — el ledger del arriendo y la contabilidad de Propigo no se mezclan", () => {
  // Es el invariante más importante del ADR. `AsientoLedger` modela plata entre
  // arrendatario, propietario y corredor; la comisión de Propigo es una deuda
  // del corredor CON Propigo. Si un asiento de comisión de plataforma entrara
  // al ledger del contrato, contaminaría la liquidación del propietario y las
  // vistas financieras — y se descubriría cuando un propietario reclame que le
  // descontaron algo que no le corresponde.

  it("TipoAsiento no incorpora conceptos de billing", () => {
    const tipoAsiento = bloqueDelSchema("enum", "TipoAsiento");
    expect(tipoAsiento).not.toMatch(/plataforma|suscripcion|suscripción|billing/i);
  });

  it("TipoConcepto no incorpora conceptos de billing", () => {
    const tipoConcepto = bloqueDelSchema("enum", "TipoConcepto");
    expect(tipoConcepto).not.toMatch(/plataforma|suscripcion|suscripción|billing/i);
  });

  it("AsientoLedger no tiene relación con ningún modelo de billing", () => {
    const asiento = bloqueDelSchema("model", "AsientoLedger");
    expect(asiento).not.toMatch(/ComisionPlataforma|CargoBilling|SuscripcionTenant/);
  });

  it("ComisionPlataforma no tiene relación con AsientoLedger", () => {
    const comision = bloqueDelSchema("model", "ComisionPlataforma");
    expect(comision).not.toMatch(/AsientoLedger/);
  });

  it("COMISION_CORREDOR sigue existiendo y es cosa distinta de la comisión de Propigo", () => {
    // Guarda contra que alguien "unifique" ambos conceptos por parecerse en el
    // nombre. COMISION_CORREDOR = lo que el corredor le cobra al propietario.
    const tipoAsiento = bloqueDelSchema("enum", "TipoAsiento");
    expect(tipoAsiento).toMatch(/COMISION_CORREDOR/);
    expect(schemaPrisma).toMatch(/model\s+ComisionPlataforma/);
  });
});

describe("Invariante 2 — no se puede cobrar dos veces lo mismo", () => {
  it("la base impide dos cargos no fallidos para el mismo tenant/tipo/período", () => {
    // Defensa de último recurso: aunque la lógica de aplicación falle, Postgres
    // rechaza el segundo cargo. Se verifica sobre setup.sql porque Prisma no
    // modela índices únicos parciales.
    expect(setupSql).toMatch(/uniq_cargo_por_tenant_tipo_periodo/);
    expect(setupSql).toMatch(/on cargo_billing \(tenant_id, tipo, periodo\)/);
  });

  it("la clave de idempotencia del cargo es única a nivel global", () => {
    const cargo = bloqueDelSchema("model", "CargoBilling");
    expect(cargo).toMatch(/idempotencyKey\s+String\s+@unique/);
  });

  it("un tenant no puede tener dos suscripciones vivas a la vez", () => {
    expect(setupSql).toMatch(/uniq_suscripcion_viva_por_tenant/);
  });

  it("un pago de arriendo devenga una sola comisión", () => {
    const comision = bloqueDelSchema("model", "ComisionPlataforma");
    expect(comision).toMatch(/pagoEntranteId\s+String\s+@unique/);
  });
});

describe("Invariante 3 — el webhook es idempotente", () => {
  it("el id del evento del proveedor es único", () => {
    // Los proveedores reenvían el mismo evento si no reciben 200 a tiempo.
    // Sin esta unicidad, un reenvío acreditaría el pago dos veces.
    const evento = bloqueDelSchema("model", "EventoGatewayPago");
    expect(evento).toMatch(/idExterno\s+String\s+@unique/);
  });

  it("reintentar un cobro con la misma clave no cobra de nuevo", async () => {
    const gateway = new FakeBillingGateway();
    const solicitud = {
      idempotencyKey: "clave-fija-001",
      tenantId: "t1",
      medioPago: "medio_x",
      monto: { netoClp: 10000, ivaClp: 1900, totalClp: 11900, montoUf: null, ufAplicada: null },
      descripcion: "Suscripción",
    };

    const primero = await gateway.cobrar(solicitud);
    const segundo = await gateway.cobrar(solicitud);

    expect(primero.estado).toBe("aprobado");
    expect(segundo.estado).toBe("aprobado");
    if (primero.estado === "aprobado" && segundo.estado === "aprobado") {
      // Misma transacción: no se generó un cobro nuevo.
      expect(segundo.referenciaTransaccion).toBe(primero.referenciaTransaccion);
    }
  });
});

describe("Invariante 4 — nunca se devuelve más de lo cobrado", () => {
  let gateway: FakeBillingGateway;

  beforeEach(() => {
    gateway = new FakeBillingGateway();
  });

  it("rechaza un reembolso mayor al monto cobrado", async () => {
    const cobro = await gateway.cobrar({
      idempotencyKey: "k1",
      tenantId: "t1",
      medioPago: "m1",
      monto: { netoClp: 10000, ivaClp: 1900, totalClp: 11900, montoUf: null, ufAplicada: null },
      descripcion: "Suscripción",
    });
    expect(cobro.estado).toBe("aprobado");
    if (cobro.estado !== "aprobado") return;

    const resultado = await gateway.reembolsar({
      idempotencyKey: "r1",
      referenciaTransaccion: cobro.referenciaTransaccion,
      montoClp: 11901, // un peso más de lo cobrado
    });
    expect(resultado.estado).toBe("rechazado");
  });

  it("rechaza reembolsos parciales que en total superen lo cobrado", async () => {
    const cobro = await gateway.cobrar({
      idempotencyKey: "k2",
      tenantId: "t1",
      medioPago: "m1",
      monto: { netoClp: 10000, ivaClp: 1900, totalClp: 11900, montoUf: null, ufAplicada: null },
      descripcion: "Suscripción",
    });
    if (cobro.estado !== "aprobado") throw new Error("el cobro debió aprobarse");

    const primero = await gateway.reembolsar({
      idempotencyKey: "r1",
      referenciaTransaccion: cobro.referenciaTransaccion,
      montoClp: 10000,
    });
    const segundo = await gateway.reembolsar({
      idempotencyKey: "r2",
      referenciaTransaccion: cobro.referenciaTransaccion,
      montoClp: 5000, // 10000 + 5000 > 11900
    });

    expect(primero.estado).toBe("reembolsado");
    expect(segundo.estado).toBe("rechazado");
  });
});

describe("Invariante 5 — un fallo de billing nunca abre permisos", () => {
  it("un plan desconocido cae al cupo más bajo, no a ilimitado", () => {
    const bronze = getCupoUsuarios("bronze");
    for (const planInvalido of [null, "", "Gratuito", "enterprise", "diamond_v2", "DIAMOND"]) {
      expect(getCupoUsuarios(planInvalido)).toBe(bronze);
    }
  });

  it("el cupo del plan más bajo no es ilimitado", () => {
    expect(getCupoUsuarios("bronze")).toBeGreaterThan(0);
    expect(Number.isFinite(getCupoUsuarios("bronze"))).toBe(true);
  });
});

describe("Invariante 6 — los errores de cobro dicen si vale la pena reintentar", () => {
  // Sin esta clasificación el dunning no puede ser correcto: reintentar una
  // tarjeta vencida molesta al cliente sin cambiar nada, y NO reintentar un
  // timeout pierde plata que sí se podía cobrar.
  it("clasifica cada categoría de forma explícita", () => {
    const esperado: Record<CategoriaErrorCobro, boolean> = {
      rechazo: true,        // reintentar en días (el dunning lo hace)
      temporal: true,       // reintentar pronto
      medio_invalido: false, // hay que pedir otra tarjeta
      configuracion: false,  // es un bug nuestro: avisar a un humano
    };
    for (const [categoria, reintentable] of Object.entries(esperado)) {
      expect(esReintentable(categoria as CategoriaErrorCobro)).toBe(reintentable);
    }
  });
});

describe("Invariante 7 — el aislamiento por tenant cubre billing", () => {
  it("las tablas de billing con tenant están bajo RLS", () => {
    // Un corredor jamás debe ver los cobros ni las comisiones de otro.
    const rls = setupSql.match(/foreach t in array array\[([\s\S]*?)\]\s*loop/);
    expect(rls).not.toBeNull();
    const lista = rls![1];
    expect(lista).toMatch(/'suscripcion_tenant'/);
    expect(lista).toMatch(/'cargo_billing'/);
    expect(lista).toMatch(/'comision_plataforma'/);
  });

  it("evento_gateway_pago queda fuera del RLS por tenant, y sin tenant_id", () => {
    // Es correcto y deliberado: al recibir el webhook todavía no se sabe de qué
    // tenant es. El test lo fija para que nadie lo "arregle" agregándole un
    // tenant_id que en ese momento no existe.
    const rls = setupSql.match(/foreach t in array array\[([\s\S]*?)\]\s*loop/);
    expect(rls![1]).not.toMatch(/'evento_gateway_pago'/);
    const evento = bloqueDelSchema("model", "EventoGatewayPago");
    expect(evento).not.toMatch(/tenantId/);
  });
});

describe("Invariante 8 — el adaptador fake no llega a producción", () => {
  it("crearGatewayDeEntorno falla en producción en vez de cobrar en falso", () => {
    const original = process.env.NODE_ENV;
    try {
      // NODE_ENV es readonly en los tipos de Node, pero en runtime se puede
      // reasignar — es la única forma de ejercitar esta guarda.
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(() => crearGatewayDeEntorno()).toThrow(/producción|production/i);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = original ?? "test";
    }
  });

  it("fuera de producción entrega un gateway usable", () => {
    expect(crearGatewayDeEntorno().nombre).toBe("fake");
  });
});

describe("Invariante 9 — la firma del webhook se valida de verdad", () => {
  it("rechaza un webhook sin firma válida", () => {
    const gateway = new FakeBillingGateway();
    const cuerpo = JSON.stringify({ id: "evt_1", tipo: "cobro_aprobado" });
    expect(gateway.verificarFirmaWebhook(cuerpo, {})).toBe(false);
    expect(gateway.verificarFirmaWebhook(cuerpo, { "x-fake-signature": "otra" })).toBe(false);
    expect(gateway.verificarFirmaWebhook(cuerpo, { "x-fake-signature": "firma-valida" })).toBe(true);
  });

  it("un payload ilegible no se interpreta a medias", () => {
    const gateway = new FakeBillingGateway();
    expect(gateway.parsearEvento("no es json")).toBeNull();
    expect(gateway.parsearEvento(JSON.stringify({ sin: "id" }))).toBeNull();
  });
});
