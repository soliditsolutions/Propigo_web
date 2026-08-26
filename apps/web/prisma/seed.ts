/**
 * Seed del MVP Housing (v2 — incluye garantía, ajustes, config de tenant).
 * Ejecutar: npm run db:seed -w @housing/web
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  generarCalendario,
  convertirUfAClp,
  aplicarReajusteIpc,
  esPeriodoDeReajuste,
  redondearPeso,
} from "@housing/core";

/** PBKDF2-SHA256 — misma lógica que src/lib/password.ts */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt    = crypto.getRandomValues(new Uint8Array(16));
  const key     = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits    = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" }, key, 256);
  return `pbkdf2v1$${Buffer.from(salt).toString("base64")}$${Buffer.from(bits).toString("base64")}`;
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const HOY = new Date(Date.UTC(2026, 5, 4)); // referencia: 2026-06-04
const ym = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`;

async function main() {
  console.log("Limpiando datos previos…");
  await prisma.$executeRawUnsafe(
    "TRUNCATE tenant, serie_uf, serie_ipc RESTART IDENTITY CASCADE;",
  );

  // ── Series temporales (26 meses desde dic-2024) ─────────────────
  const ufMap = new Map<string, number>();
  const ipcMap = new Map<string, number>();
  const seriesUf: { fecha: Date; valorClp: number }[] = [];
  const seriesIpc: { periodo: Date; indice: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const d = new Date(Date.UTC(2024, 11 + i, 1));
    const uf = redondearPeso(37000 * Math.pow(1.0035, i));
    const ipc = Math.round(100 * Math.pow(1.0035, i) * 10000) / 10000;
    ufMap.set(ym(d), uf);
    ipcMap.set(ym(d), ipc);
    seriesUf.push({ fecha: d, valorClp: uf });
    seriesIpc.push({ periodo: d, indice: ipc });
  }
  await prisma.serieUf.createMany({ data: seriesUf });
  await prisma.serieIpc.createMany({ data: seriesIpc });

  // ── Corredora + corredor (con config de ventana y recordatorio) ──
  const tenant = await prisma.tenant.create({
    data: {
      nombre: "Corredora Demo SpA",
      rut: "76.123.456-0", // DV corregido (mod-11); el original -7 no validaba
      plan: "demo",
      ventanaLiquidacionDias: 10,   // ADR-0008: hasta el día 10 para liquidar
      recordatorioDiasAntes: 5,     // ADR-0008: avisar 5 días antes del vencimiento
    },
  });

  const corredor = await prisma.usuario.create({
    data: {
      tenantId: tenant.id, rol: "manager",
      nombre:       "María Corredora",
      email:        "maria@corredorademo.cl",
      telefono:     "+56 9 1111 1111",
      passwordHash: await hashPassword("Demo1234!"),
    },
  });

  // ── Personas ────────────────────────────────────────────────────
  const mkPersona = (rut: string, nombre: string, email: string) =>
    prisma.persona.create({
      data: { tenantId: tenant.id, rut, nombre, email, canalAccesoPref: "email" },
    });
  // RUT en forma canónica (sin puntos) — debe coincidir con normalizarRut() del
  // portal (api/portal/solicitar-otp), que siempre busca sin puntos. Dígitos
  // verificadores recalculados (mod-11): los originales no validaban con validarRut().
  const prop1 = await mkPersona("12345678-5", "Juan Propietario", "juan@example.cl");
  const prop2 = await mkPersona("9876543-3",  "Ana Dueña",         "ana@example.cl");
  const arr1  = await mkPersona("15111222-6", "Pedro Arrendatario","pedro@example.cl");
  const arr2  = await mkPersona("16444555-0", "Lucía Inquilina",   "lucia@example.cl");

  // ── Propiedades ─────────────────────────────────────────────────
  const mkProp = (data: Record<string, unknown>) =>
    prisma.propiedad.create({ data: { tenantId: tenant.id, ...data } as never });

  /**
   * Cuentas de servicios básicos de una propiedad.
   *
   * Los 4 servicios del set canónico quedan SIEMPRE declarados, que es lo que
   * exige el alta real (G-02 + G-05). Los datos demo ejercitan a propósito el
   * caso "no aplica" —la cabaña sin gas de red, la casa sin gastos comunes—
   * para que ese camino no quede sin probar nunca.
   */
  const mkCuentas = (
    propiedadId: string,
    opts: { sinGas?: boolean; sinGC?: boolean; empresaLuz?: string; empresaAgua?: string } = {},
  ) =>
    prisma.cuentaServicio.createMany({
      data: [
        {
          tenantId: tenant.id, propiedadId, tipo: "agua", estado: "registrada",
          numero: String(10_000_000 + Math.floor(Math.random() * 8_999_999)),
          empresa: opts.empresaAgua ?? "Aguas Andinas", paga: "arrendatario",
        },
        {
          tenantId: tenant.id, propiedadId, tipo: "luz", estado: "registrada",
          numero: String(20_000_000 + Math.floor(Math.random() * 8_999_999)),
          empresa: opts.empresaLuz ?? "Enel Distribución", paga: "arrendatario",
        },
        opts.sinGas
          ? { tenantId: tenant.id, propiedadId, tipo: "gas" as const, estado: "no_aplica" as const, paga: "arrendatario" as const }
          : {
              tenantId: tenant.id, propiedadId, tipo: "gas" as const, estado: "registrada" as const,
              numero: String(30_000_000 + Math.floor(Math.random() * 8_999_999)),
              empresa: "Metrogas", paga: "arrendatario" as const,
            },
        opts.sinGC
          ? { tenantId: tenant.id, propiedadId, tipo: "gastos_comunes" as const, estado: "no_aplica" as const, paga: "propietario" as const }
          : {
              tenantId: tenant.id, propiedadId, tipo: "gastos_comunes" as const, estado: "registrada" as const,
              numero: String(Math.floor(Math.random() * 900) + 100),
              empresa: "Administración del edificio", paga: "propietario" as const,
            },
      ] as never,
    });

  const casaCLP = await mkProp({
    propietarioId: prop1.id, tipo: "casa", estado: "arrendada",
    rol: "2145-18",
    direccion: "Los Aromos 1234", comuna: "Ñuñoa", region: "Región Metropolitana de Santiago",
    orientacion: "NP", antiguedadAnios: 12, m2Construidos: 120, m2Totales: 200,
    esCondominio: false, plantas: 2, piezas: 4, banos: 2, estacionamientos: 1,
    pagaGastosComunes: false,
  });
  const deptoUF = await mkProp({
    propietarioId: prop2.id, tipo: "departamento", estado: "arrendada",
    rol: "871-42",
    direccion: "Av. Providencia 2020, depto 805", comuna: "Providencia",
    region: "Región Metropolitana de Santiago", orientacion: "SP", antiguedadAnios: 5,
    m2Construidos: 65, m2Totales: 72, esCondominio: true, plantas: 1,
    piezas: 2, banos: 2, estacionamientos: 1,
    pagaGastosComunes: true, valorGastosComunes: 85000,
  });
  const cabanaDisp = await mkProp({
    propietarioId: prop1.id, tipo: "cabana", estado: "disponible",
    rol: "1502-7",
    direccion: "Camino al Lago km 4", comuna: "Pucón", region: "Región de la Araucanía",
    orientacion: "P", antiguedadAnios: 8, m2Construidos: 90, m2Totales: 5000,
    esCondominio: false, plantas: 1, piezas: 3, banos: 2, estacionamientos: 2,
    pagaGastosComunes: false,
  });
  const deptoReservado = await mkProp({
    propietarioId: prop2.id, tipo: "departamento", estado: "reservada",
    rol: "3390-115",
    direccion: "Av. Apoquindo 5500, depto 1502", comuna: "Las Condes",
    region: "Región Metropolitana de Santiago", orientacion: "N", antiguedadAnios: 3,
    m2Construidos: 80, m2Totales: 90, esCondominio: true, plantas: 1,
    piezas: 3, banos: 2, estacionamientos: 2,
    pagaGastosComunes: true, valorGastosComunes: 120000,
  });

  // ── Cuentas de servicios y roles complementarios ────────────────
  await mkCuentas(casaCLP.id,        { sinGC: true });                    // casa: no hay GC
  await mkCuentas(deptoUF.id);
  await mkCuentas(cabanaDisp.id,     { sinGas: true, sinGC: true,        // rural: gas de balón
                                       empresaAgua: "Aguas Araucanía",
                                       empresaLuz: "CGE" });
  await mkCuentas(deptoReservado.id);

  // En edificios cada unidad tiene rol propio (G-06): el depto uno, el
  // estacionamiento otro, la bodega otro — de ahí la manzana compartida.
  await prisma.rolComplementario.createMany({
    data: [
      { tenantId: tenant.id, propiedadId: deptoUF.id,        tipo: "estacionamiento", rol: "871-143",  descripcion: "Estacionamiento 43" },
      { tenantId: tenant.id, propiedadId: deptoUF.id,        tipo: "bodega",          rol: "871-244",  descripcion: "Bodega B-12" },
      { tenantId: tenant.id, propiedadId: deptoReservado.id, tipo: "estacionamiento", rol: "3390-216", descripcion: "Estacionamiento 216" },
    ] as never,
  });

  // ── Publicaciones ───────────────────────────────────────────────
  await prisma.publicacion.create({
    data: {
      tenantId: tenant.id, propiedadId: cabanaDisp.id, estado: "publicada",
      titulo: "Cabaña frente al lago en Pucón", denominacionPrecio: "CLP",
      precioReferencia: 850000, descripcion: "Ideal verano, 3 dormitorios.",
      publicadaEn: new Date(),
    },
  });
  await prisma.publicacion.create({
    data: {
      tenantId: tenant.id, propiedadId: deptoReservado.id, estado: "bajada",
      titulo: "Depto Las Condes 3D2B", denominacionPrecio: "UF",
      precioReferencia: 28, descripcion: "Reservado.",
    },
  });

  // ── Reserva ─────────────────────────────────────────────────────
  await prisma.reserva.create({
    data: {
      tenantId: tenant.id, propiedadId: deptoReservado.id, personaId: arr2.id,
      vigenteHasta: new Date(Date.UTC(2026, 6, 1)), estado: "activa",
      notas: "Reserva con pie pagado, pendiente firma de contrato.",
    },
  });

  // ── Contratos ───────────────────────────────────────────────────
  // Contrato 1: CLP, con garantía de 1 mes, reajuste IPC anual
  await seedContrato({
    propiedadId: casaCLP.id, arrendatarioId: arr1.id, propietarioId: prop1.id,
    denominacion: "CLP", valorArriendo: 500000, diaVencimiento: 5,
    comisionPct: 8, reajuste: "anual", cobraGastoComun: false, montoGc: 0,
    garantiaMeses: 1, garantiaMontoCLP: 500000,
    fechaInicio: new Date(Date.UTC(2025, 0, 5)), fechaFin: new Date(Date.UTC(2026, 11, 5)),
    tenantId: tenant.id, corredor, ufMap, ipcMap,
  });

  // Contrato 2: UF, con garantía de 1 mes, gasto común, sin reajuste IPC
  await seedContrato({
    propiedadId: deptoUF.id, arrendatarioId: arr2.id, propietarioId: prop2.id,
    denominacion: "UF", valorArriendo: 12, diaVencimiento: 10,
    comisionPct: 10, reajuste: "ninguna", cobraGastoComun: true, montoGc: 85000,
    garantiaMeses: 1, garantiaMontoCLP: 444000,
    fechaInicio: new Date(Date.UTC(2025, 8, 10)), fechaFin: new Date(Date.UTC(2026, 7, 10)),
    tenantId: tenant.id, corredor, ufMap, ipcMap,
  });

  console.log("Seed completado ✅");
}

interface ContratoSeed {
  tenantId: string; propiedadId: string; arrendatarioId: string; propietarioId: string;
  denominacion: "UF" | "CLP"; valorArriendo: number; diaVencimiento: number;
  comisionPct: number; reajuste: "anual" | "semestral" | "ninguna";
  cobraGastoComun: boolean; montoGc: number;
  garantiaMeses: number; garantiaMontoCLP: number;
  fechaInicio: Date; fechaFin: Date;
  corredor: { id: string };
  ufMap: Map<string, number>; ipcMap: Map<string, number>;
}

async function seedContrato(c: ContratoSeed) {
  const contrato = await prisma.contrato.create({
    data: {
      tenantId: c.tenantId, propiedadId: c.propiedadId,
      arrendatarioId: c.arrendatarioId, propietarioId: c.propietarioId,
      estado: "vigente", denominacion: c.denominacion,
      valorArriendo: c.valorArriendo,
      diaVencimiento: c.diaVencimiento,
      comisionCorredorPct: c.comisionPct,
      reajuste: c.reajuste,
      moraTasaPct: 1.5, moraDiasGracia: 5,
      cobraGastoComun: c.cobraGastoComun,
      garantiaMeses: c.garantiaMeses,         // ADR-0009
      garantiaMontoCLP: c.garantiaMontoCLP,   // ADR-0009
      fechaInicio: c.fechaInicio, fechaFin: c.fechaFin,
    },
  });

  // Asiento: garantía recibida al inicio (passthrough)
  if (c.garantiaMontoCLP > 0) {
    await prisma.asientoLedger.create({
      data: {
        tenantId: c.tenantId, contratoId: contrato.id,
        arrendatarioId: c.arrendatarioId, propietarioId: c.propietarioId,
        tipo: "GARANTIA_RECIBIDA", concepto: "garantia",
        montoClp: c.garantiaMontoCLP,
        monedaOrigen: c.denominacion,
        fechaEvento: c.fechaInicio,
        descripcion: `Depósito de garantía — ${c.garantiaMeses} mes(es)`,
      },
    });
  }

  const periodos = generarCalendario({
    fechaInicio: c.fechaInicio, fechaFin: c.fechaFin,
    diaVencimiento: c.diaVencimiento, montoArriendo: c.valorArriendo,
    denominacion: c.denominacion, montoGastoComun: c.cobraGastoComun ? c.montoGc : 0,
  });

  // Reajuste de IPC en el aniversario (solo CLP).
  let baseReajustada = c.valorArriendo;
  if (c.denominacion === "CLP" && c.reajuste !== "ninguna") {
    const ipcIni = c.ipcMap.get(ym(periodos[0]!.fechaInicio))!;
    for (const per of periodos) {
      if (esPeriodoDeReajuste(per.numero)) {
        const ipcAniv = c.ipcMap.get(ym(per.fechaInicio))!;
        baseReajustada = aplicarReajusteIpc(c.valorArriendo, ipcIni, ipcAniv);
      }
      if (per.numero >= 13) per.montoBase = baseReajustada;
    }
  }

  const totalVencidos = periodos.filter(p => p.fechaVencimiento <= HOY).length;
  // Distribución de estados para una demo realista (ADR-0008, flujo en 2 pasos):
  //   [0 .. total-6)  → liquidado (paso 1 + paso 2 completo, sin saldo pendiente)
  //   [total-6 .. total-3)  → pagado = conciliado (paso 1 hecho, paso 2 pendiente → GENERA BILLETERA)
  //   [total-3 .. total)  → atrasado (sin pago)
  const limLiquidado = totalVencidos - 6;   // hasta aquí: liquidado
  const limPagado    = totalVencidos - 3;   // hasta aquí: pagado (conciliado, no liquidado)
  let elapsed = 0;
  let primerAjuste = true;

  for (const per of periodos) {
    const vencida = per.fechaVencimiento <= HOY;
    let arriendoClp: number;
    let ufAplicada: number | null = null;
    if (c.denominacion === "UF") {
      ufAplicada = c.ufMap.get(ym(per.fechaVencimiento))!;
      arriendoClp = convertirUfAClp(per.montoBase, ufAplicada);
    } else {
      arriendoClp = redondearPeso(per.montoBase);
    }

    const liquidado = vencida && elapsed < limLiquidado;
    const pagado    = vencida && elapsed >= limLiquidado && elapsed < limPagado;
    const estado    = liquidado ? "liquidado" : pagado ? "pagado" : vencida ? "atrasado" : "pendiente";

    const periodo = await prisma.periodoPago.create({
      data: {
        tenantId: c.tenantId, contratoId: contrato.id, numero: per.numero,
        fechaInicio: per.fechaInicio, fechaVencimiento: per.fechaVencimiento,
        montoBase: per.montoBase, montoGastoComun: per.montoGastoComun,
        estado,
        fechaPagoReal: (liquidado || pagado) ? per.fechaVencimiento : null,
      },
    });
    if (vencida) elapsed++;

    const base = {
      tenantId: c.tenantId, contratoId: contrato.id, periodoId: periodo.id,
      arrendatarioId: c.arrendatarioId, propietarioId: c.propietarioId,
      fechaEvento: per.fechaVencimiento,
      monedaOrigen: c.denominacion,
      valorOrigen: c.denominacion === "UF" ? per.montoBase : null,
      ufAplicada,
    };

    if (!vencida) continue;

    // Cargos del período (siempre que esté vencido)
    await prisma.asientoLedger.create({
      data: { ...base, tipo: "CARGO_ARRIENDO", concepto: "arriendo", montoClp: arriendoClp },
    });
    if (c.cobraGastoComun && per.montoGastoComun > 0) {
      await prisma.asientoLedger.create({
        data: { ...base, tipo: "CARGO_GASTO_COMUN", concepto: "gasto_comun", montoClp: per.montoGastoComun },
      });
    }

    // PASO 1 — Conciliar (tanto para 'pagado' como 'liquidado')
    if (pagado || liquidado) {
      await prisma.asientoLedger.create({
        data: { ...base, tipo: "PAGO_RECIBIDO", concepto: "arriendo", montoClp: arriendoClp },
      });
      if (c.cobraGastoComun && per.montoGastoComun > 0) {
        await prisma.asientoLedger.create({
          data: { ...base, tipo: "PAGO_RECIBIDO", concepto: "gasto_comun", montoClp: per.montoGastoComun },
        });
      }
    }

    // PASO 2 — Cerrar liquidación (solo para 'liquidado')
    if (liquidado) {
      let montoLiquidacionProp = arriendoClp;

      // Ajuste demo en período 3: reparación cargada al propietario
      if (primerAjuste && per.numero === 3) {
        const montoAjuste = 45000;
        await prisma.ajusteLiquidacion.create({
          data: {
            tenantId: c.tenantId, periodoId: periodo.id,
            tipo: "descuento_propietario", montoCLP: montoAjuste,
            descripcion: "Reparación cañería baño — cotización Fontanería Cruz",
            creadoPorId: c.corredor.id,
          },
        });
        await prisma.asientoLedger.create({
          data: { ...base, tipo: "AJUSTE_LIQUIDACION", concepto: "ajuste",
            montoClp: montoAjuste, descripcion: "Desc. reparación cañería baño" },
        });
        montoLiquidacionProp -= montoAjuste;
        primerAjuste = false;
      }

      const comision = redondearPeso((arriendoClp * c.comisionPct) / 100);
      await prisma.asientoLedger.create({
        data: { ...base, tipo: "COMISION_CORREDOR", concepto: "arriendo", montoClp: comision },
      });
      await prisma.asientoLedger.create({
        data: { ...base, tipo: "LIQUIDACION_PROPIETARIO", concepto: "arriendo",
          montoClp: montoLiquidacionProp - comision,
          descripcion: `Liquidación período ${per.numero}` },
      });
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
