import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  // Primitivas
  convertirUfAClp, variacionIpc, aplicarReajusteIpc, redondearPeso,
  // Calendario
  generarCalendario, esPeriodoDeReajuste,
  // Motor financiero
  diasEntre, calcularMora,
  conciliar,
  calcularLiquidacion,
  esGarantiaValida, calcularTerminoGarantia, MAX_MESES_GARANTIA,
  ivaArriendo, ivaArriendoIncluido, ivaComision, deduccionAvaluo, IVA_PCT, DEDUCCION_AVALUO_PCT_ANUAL,
} from "./index";

// ─── Primitivas ───────────────────────────────────────────────────────────────

describe("convertirUfAClp", () => {
  test("redondea al peso", () => {
    assert.equal(convertirUfAClp(12, 37000), 444000);
    assert.equal(convertirUfAClp(10.5, 37123.45), redondearPeso(10.5 * 37123.45));
  });
  test("rechaza valores inválidos", () => {
    assert.throws(() => convertirUfAClp(-1, 37000));
    assert.throws(() => convertirUfAClp(12, 0));
  });
});

describe("IPC", () => {
  test("variacionIpc calcula la variación acumulada", () => {
    assert.ok(Math.abs(variacionIpc(105.3, 109.7) - (109.7 / 105.3 - 1)) < 1e-12);
  });
  test("aplicarReajusteIpc reajusta correctamente", () => {
    assert.equal(aplicarReajusteIpc(500000, 105.3, 109.7), 520893);
  });
});

// ─── Calendario ───────────────────────────────────────────────────────────────

describe("generarCalendario", () => {
  test("genera 12 períodos para un contrato de un año", () => {
    const ps = generarCalendario({
      fechaInicio: new Date(Date.UTC(2025, 0, 1)),
      fechaFin: new Date(Date.UTC(2025, 11, 1)),
      diaVencimiento: 5, montoArriendo: 500000, denominacion: "CLP",
    });
    assert.equal(ps.length, 12);
    assert.equal(ps[0]!.numero, 1);
    assert.equal(ps[0]!.fechaVencimiento.getUTCDate(), 5);
    assert.equal(ps[11]!.fechaInicio.getUTCMonth(), 11);
  });
  test("ajusta el día de vencimiento a fin de mes en febrero", () => {
    const ps = generarCalendario({
      fechaInicio: new Date(Date.UTC(2025, 1, 1)),
      fechaFin: new Date(Date.UTC(2025, 1, 1)),
      diaVencimiento: 31, montoArriendo: 12, denominacion: "UF",
    });
    assert.equal(ps[0]!.fechaVencimiento.getUTCDate(), 28);
  });
  test("rechaza fechas/días inválidos", () => {
    const base = { fechaInicio: new Date(Date.UTC(2025, 0, 1)), fechaFin: new Date(Date.UTC(2025, 5, 1)), montoArriendo: 100, denominacion: "CLP" as const };
    assert.throws(() => generarCalendario({ ...base, diaVencimiento: 0 }));
    assert.throws(() => generarCalendario({ ...base, diaVencimiento: 5, fechaFin: new Date(Date.UTC(2024, 0, 1)) }));
  });
  test("esPeriodoDeReajuste marca el aniversario (ciclo 12)", () => {
    assert.equal(esPeriodoDeReajuste(1), false);
    assert.equal(esPeriodoDeReajuste(12), false);
    assert.equal(esPeriodoDeReajuste(13), true);
    assert.equal(esPeriodoDeReajuste(25), true);
  });
});

// ─── Mora ─────────────────────────────────────────────────────────────────────

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

describe("calcularMora", () => {
  test("pago en la fecha de vencimiento → sin mora", () => {
    const r = calcularMora(500000, d(2026, 3, 5), d(2026, 3, 5), 1.5, 5);
    assert.equal(r.diasAtraso, 0);
    assert.equal(r.interesCLP, 0);
  });
  test("pago dentro del período de gracia → sin mora", () => {
    // Vence el 5, gracia 5 días, pago el 9 (4 días después)
    const r = calcularMora(500000, d(2026, 3, 5), d(2026, 3, 9), 1.5, 5);
    assert.equal(r.diasAtraso, 0);
    assert.equal(r.interesCLP, 0);
  });
  test("pago exactamente en el límite de gracia → sin mora", () => {
    // Vence el 5, gracia 5 días, pago el 10 = 5 días después = exactamente en gracia
    const r = calcularMora(500000, d(2026, 3, 5), d(2026, 3, 10), 1.5, 5);
    assert.equal(r.diasAtraso, 0);
    assert.equal(r.interesCLP, 0);
  });
  test("pago un día después de la gracia → 1 día de mora", () => {
    // Vence el 5, gracia 5 días, pago el 11 → 1 día efectivo de mora
    const r = calcularMora(500000, d(2026, 3, 5), d(2026, 3, 11), 1.5, 5);
    assert.equal(r.diasAtraso, 1);
    // 500.000 × 1.5% / 30 × 1 = 250
    assert.equal(r.interesCLP, 250);
  });
  test("pago 10 días después (5 de gracia) → 5 días de mora", () => {
    const r = calcularMora(521409, d(2026, 3, 5), d(2026, 3, 20), 1.5, 5);
    assert.equal(r.diasAtraso, 10);
    // 521.409 × 1.5 / 100 / 30 × 10 = 2607.045 → 2607
    const esperado = redondearPeso(521409 * 1.5 / 100 / 30 * 10);
    assert.equal(r.interesCLP, esperado);
  });
  test("tasa cero → sin interés aunque haya atraso", () => {
    const r = calcularMora(500000, d(2026, 3, 5), d(2026, 3, 20), 0, 0);
    assert.equal(r.interesCLP, 0);
    assert.equal(r.diasAtraso, 15);
  });
  test("sin gracia, pago anticipado → sin mora", () => {
    const r = calcularMora(500000, d(2026, 3, 5), d(2026, 3, 3), 1.5, 0);
    assert.equal(r.diasAtraso, 0);
    assert.equal(r.interesCLP, 0);
  });
  test("rechaza parámetros inválidos", () => {
    assert.throws(() => calcularMora(-1, d(2026, 3, 5), d(2026, 3, 10), 1.5, 5));
    assert.throws(() => calcularMora(500000, d(2026, 3, 5), d(2026, 3, 10), -1, 5));
    assert.throws(() => calcularMora(500000, d(2026, 3, 5), d(2026, 3, 10), 1.5, -1));
  });
});

describe("diasEntre", () => {
  test("misma fecha → 0", () => {
    assert.equal(diasEntre(d(2026, 3, 5), d(2026, 3, 5)), 0);
  });
  test("5 días de diferencia", () => {
    assert.equal(diasEntre(d(2026, 3, 5), d(2026, 3, 10)), 5);
  });
  test("fecha anterior → negativo", () => {
    assert.equal(diasEntre(d(2026, 3, 10), d(2026, 3, 5)), -5);
  });
});

// ─── Conciliación ─────────────────────────────────────────────────────────────

describe("conciliar", () => {
  test("pago exacto sin mora ni GC → conciliado", () => {
    const r = conciliar({ montoPagadoCLP: 500000, arriendoCLP: 500000, montoGastoComun: 0, interesCLP: 0 });
    assert.equal(r.estado, "conciliado");
    assert.equal(r.totalEsperado, 500000);
  });
  test("pago exacto con mora → conciliado", () => {
    const r = conciliar({ montoPagadoCLP: 501000, arriendoCLP: 500000, montoGastoComun: 0, interesCLP: 1000 });
    assert.equal(r.estado, "conciliado");
    assert.equal(r.totalEsperado, 501000);
  });
  test("pago exacto con GC → conciliado", () => {
    const r = conciliar({ montoPagadoCLP: 585000, arriendoCLP: 500000, montoGastoComun: 85000, interesCLP: 0 });
    assert.equal(r.estado, "conciliado");
    assert.equal(r.totalEsperado, 585000);
  });
  test("pago exacto con mora Y GC → conciliado", () => {
    const r = conciliar({ montoPagadoCLP: 586250, arriendoCLP: 500000, montoGastoComun: 85000, interesCLP: 1250 });
    assert.equal(r.estado, "conciliado");
  });
  test("pago de menos → en_revision, diferencia negativa", () => {
    const r = conciliar({ montoPagadoCLP: 490000, arriendoCLP: 500000, montoGastoComun: 0, interesCLP: 0 });
    assert.equal(r.estado, "en_revision");
    if (r.estado === "en_revision") {
      assert.equal(r.diferencia, -10000);
    }
  });
  test("pago de más → en_revision, diferencia positiva", () => {
    const r = conciliar({ montoPagadoCLP: 510000, arriendoCLP: 500000, montoGastoComun: 0, interesCLP: 0 });
    assert.equal(r.estado, "en_revision");
    if (r.estado === "en_revision") {
      assert.equal(r.diferencia, 10000);
    }
  });
  test("rechaza montos negativos", () => {
    assert.throws(() => conciliar({ montoPagadoCLP: 500000, arriendoCLP: -1, montoGastoComun: 0, interesCLP: 0 }));
  });
});

// ─── Liquidación ──────────────────────────────────────────────────────────────

describe("calcularLiquidacion", () => {
  test("sin ajustes: comisión y neto al propietario", () => {
    const r = calcularLiquidacion({ arriendoCLP: 500000, ajustes: [], comisionPct: 8 });
    assert.equal(r.comisionCLP, 40000);   // 500.000 × 8%
    assert.equal(r.descuentoPropietarioCLP, 0);
    assert.equal(r.liquidacionNetaCLP, 460000);
    assert.equal(r.cargoArrendatarioCLP, 0);
  });
  test("con descuento_propietario: reduce el neto", () => {
    const r = calcularLiquidacion({
      arriendoCLP: 500000,
      ajustes: [{ tipo: "descuento_propietario", montoCLP: 45000 }],
      comisionPct: 8,
    });
    assert.equal(r.comisionCLP, 40000);
    assert.equal(r.descuentoPropietarioCLP, 45000);
    assert.equal(r.liquidacionNetaCLP, 415000); // 500.000 - 40.000 - 45.000
  });
  test("con cargo_arrendatario: no afecta el neto al propietario", () => {
    const r = calcularLiquidacion({
      arriendoCLP: 500000,
      ajustes: [{ tipo: "cargo_arrendatario", montoCLP: 30000 }],
      comisionPct: 8,
    });
    assert.equal(r.liquidacionNetaCLP, 460000);  // igual que sin ajuste
    assert.equal(r.cargoArrendatarioCLP, 30000); // se contabiliza aparte
    assert.equal(r.descuentoPropietarioCLP, 0);
  });
  test("con retencion: reduce el neto", () => {
    const r = calcularLiquidacion({
      arriendoCLP: 500000,
      ajustes: [{ tipo: "retencion", montoCLP: 50000 }],
      comisionPct: 10,
    });
    assert.equal(r.descuentoPropietarioCLP, 50000);
    assert.equal(r.liquidacionNetaCLP, 400000); // 500.000 - 50.000 - 50.000
  });
  test("comisión 0%: propietario recibe el íntegro (menos descuentos)", () => {
    const r = calcularLiquidacion({ arriendoCLP: 444000, ajustes: [], comisionPct: 0 });
    assert.equal(r.comisionCLP, 0);
    assert.equal(r.liquidacionNetaCLP, 444000);
  });

  test("comisión afecta a IVA: el propietario soporta el IVA (se descuenta del neto)", () => {
    const r = calcularLiquidacion({
      arriendoCLP: 500000, ajustes: [], comisionPct: 8, comisionAfectaIva: true,
    });
    assert.equal(r.comisionCLP, 40000);        // 500.000 × 8%
    assert.equal(r.ivaComisionCLP, 7600);      // 40.000 × 19%
    assert.equal(r.liquidacionNetaCLP, 452400); // 500.000 − 40.000 − 7.600
  });

  test("persona natural (default): comisión exenta, IVA cero, neto sin cambio", () => {
    const r = calcularLiquidacion({ arriendoCLP: 500000, ajustes: [], comisionPct: 8 });
    assert.equal(r.ivaComisionCLP, 0);
    assert.equal(r.liquidacionNetaCLP, 460000);
  });

  test("cuadre L-IV3: arriendo = neto + comisión + IVA + descuentos", () => {
    // El invariante que garantiza que la plata del arrendatario se reparte sin
    // fugarse ni aparecer de la nada.
    const casos = [
      { arriendoCLP: 500000, comisionPct: 8,  afecta: true,  ajustes: [] },
      { arriendoCLP: 521409, comisionPct: 10, afecta: true,  ajustes: [{ tipo: "descuento_propietario" as const, montoCLP: 45000 }] },
      { arriendoCLP: 730000, comisionPct: 12, afecta: false, ajustes: [{ tipo: "retencion" as const, montoCLP: 30000 }] },
    ];
    for (const c of casos) {
      const r = calcularLiquidacion({
        arriendoCLP: c.arriendoCLP, ajustes: c.ajustes, comisionPct: c.comisionPct, comisionAfectaIva: c.afecta,
      });
      assert.equal(
        r.liquidacionNetaCLP + r.comisionCLP + r.ivaComisionCLP + r.descuentoPropietarioCLP,
        c.arriendoCLP,
        `cuadre falla para arriendo ${c.arriendoCLP}`,
      );
    }
  });
  test("ajustes mixtos: combina correctamente", () => {
    const r = calcularLiquidacion({
      arriendoCLP: 521409,
      ajustes: [
        { tipo: "descuento_propietario", montoCLP: 45000 },  // reduce neto propietario
        { tipo: "cargo_arrendatario", montoCLP: 20000 },     // no reduce neto
      ],
      comisionPct: 8,
    });
    const comision = redondearPeso(521409 * 0.08);
    assert.equal(r.comisionCLP, comision);
    assert.equal(r.descuentoPropietarioCLP, 45000);
    assert.equal(r.cargoArrendatarioCLP, 20000);
    assert.equal(r.liquidacionNetaCLP, 521409 - comision - 45000);
  });
  test("rechaza comisionPct fuera de rango", () => {
    assert.throws(() => calcularLiquidacion({ arriendoCLP: 500000, ajustes: [], comisionPct: -1 }));
    assert.throws(() => calcularLiquidacion({ arriendoCLP: 500000, ajustes: [], comisionPct: 101 }));
  });
  test("rechaza ajuste con monto negativo", () => {
    assert.throws(() => calcularLiquidacion({
      arriendoCLP: 500000,
      ajustes: [{ tipo: "descuento_propietario", montoCLP: -1000 }],
      comisionPct: 8,
    }));
  });
});

// ─── Garantía ─────────────────────────────────────────────────────────────────

describe("garantia", () => {
  test("MAX_MESES_GARANTIA es 2 (límite legal Chile)", () => {
    assert.equal(MAX_MESES_GARANTIA, 2);
  });

  describe("esGarantiaValida", () => {
    test("1 mes de garantía sobre arriendo $500.000 → válido", () => {
      assert.equal(esGarantiaValida(500000, 500000), true);
    });
    test("2 meses de garantía → válido (tope legal)", () => {
      assert.equal(esGarantiaValida(1000000, 500000), true);
    });
    test("más de 2 meses → inválido", () => {
      assert.equal(esGarantiaValida(1000001, 500000), false);
    });
    test("arriendo ≤ 0 → inválido", () => {
      assert.equal(esGarantiaValida(500000, 0), false);
    });
  });

  describe("calcularTerminoGarantia", () => {
    test("sin retención: se devuelve todo", () => {
      const r = calcularTerminoGarantia({ montoDepositoCLP: 500000 });
      assert.equal(r.retenidoCLP, 0);
      assert.equal(r.devueltoCLP, 500000);
    });
    test("retención parcial: se devuelve el resto", () => {
      const r = calcularTerminoGarantia({ montoDepositoCLP: 500000, montoRetencionCLP: 120000 });
      assert.equal(r.retenidoCLP, 120000);
      assert.equal(r.devueltoCLP, 380000);
    });
    test("retención igual al depósito: se devuelve cero", () => {
      const r = calcularTerminoGarantia({ montoDepositoCLP: 500000, montoRetencionCLP: 500000 });
      assert.equal(r.retenidoCLP, 500000);
      assert.equal(r.devueltoCLP, 0);
    });
    test("retención mayor al depósito: se topa al depósito", () => {
      const r = calcularTerminoGarantia({ montoDepositoCLP: 500000, montoRetencionCLP: 700000 });
      assert.equal(r.retenidoCLP, 500000); // no puede retener más de lo que tiene
      assert.equal(r.devueltoCLP, 0);
    });
    test("rechaza depósito negativo", () => {
      assert.throws(() => calcularTerminoGarantia({ montoDepositoCLP: -1 }));
    });
    test("rechaza retención negativa", () => {
      assert.throws(() => calcularTerminoGarantia({ montoDepositoCLP: 500000, montoRetencionCLP: -1 }));
    });
  });
});

// ─── Integración: flujo completo conciliar → liquidar ─────────────────────────

describe("flujo completo (conciliar → liquidar)", () => {
  test("pago puntual de renta CLP sin GC → liquidación correcta", () => {
    // Contrato CLP: $521.409, vence el 5, gracia 5 días, pagó el 5 → sin mora
    const arriendoCLP = 521409;
    const { diasAtraso, interesCLP } = calcularMora(
      arriendoCLP, d(2026, 3, 5), d(2026, 3, 5), 1.5, 5,
    );
    assert.equal(diasAtraso, 0);
    assert.equal(interesCLP, 0);

    const conc = conciliar({ montoPagadoCLP: arriendoCLP, arriendoCLP, montoGastoComun: 0, interesCLP });
    assert.equal(conc.estado, "conciliado");

    const liq = calcularLiquidacion({
      arriendoCLP, ajustes: [], comisionPct: 8,
    });
    assert.equal(liq.comisionCLP, redondearPeso(521409 * 0.08));
    assert.equal(liq.liquidacionNetaCLP, arriendoCLP - liq.comisionCLP);
  });

  test("pago tardío de UF con GC y mora → conciliado con mora incluida", () => {
    // Depto UF: 12 UF × $37.519/UF = $450.228 CLP, vence el 10, gracia 5 días
    // Pagó el 20 (10 días después, 5 efectivos de mora)
    const ufDelDia = 37519;
    const arriendoCLP = convertirUfAClp(12, ufDelDia);
    const montoGastoComun = 85000;

    const { interesCLP } = calcularMora(arriendoCLP, d(2026, 4, 10), d(2026, 4, 20), 1.5, 5);
    assert.ok(interesCLP > 0, "debe haber interés por mora");

    const totalEsperado = arriendoCLP + montoGastoComun + interesCLP;
    const conc = conciliar({ montoPagadoCLP: totalEsperado, arriendoCLP, montoGastoComun, interesCLP });
    assert.equal(conc.estado, "conciliado");

    const liq = calcularLiquidacion({
      arriendoCLP,
      ajustes: [{ tipo: "descuento_propietario", montoCLP: 45000 }],
      comisionPct: 10,
    });
    assert.ok(liq.liquidacionNetaCLP < arriendoCLP, "el neto debe ser menor al bruto");
    assert.equal(liq.liquidacionNetaCLP, arriendoCLP - liq.comisionCLP - 45000);
  });
});

// ─── IVA del arriendo y de la comisión (DL 825) ───────────────────────────────

describe("ivaArriendo", () => {
  test("el arriendo no amoblado es exento y no necesita avalúo", () => {
    const r = ivaArriendo({ esAmoblado: false, rentaCLP: 800_000 });
    assert.equal(r.afecto, false);
    assert.equal(r.ivaCLP, 0);
    assert.equal(r.totalCLP, 800_000);
    assert.equal(r.deduccionAvaluoCLP, 0);
  });

  test("el amoblado descuenta el 11 % anual del avalúo antes de aplicar la tasa", () => {
    // Avalúo 45.000.000 ⇒ 11 % anual = 4.950.000 ⇒ mensual 412.500.
    // Base = 800.000 − 412.500 = 387.500 ⇒ IVA = 73.625.
    const r = ivaArriendo({
      esAmoblado: true, rentaCLP: 800_000, avaluoFiscalCLP: 45_000_000,
    });
    assert.equal(r.afecto, true);
    assert.equal(r.deduccionAvaluoCLP, 412_500);
    assert.equal(r.baseImponibleCLP, 387_500);
    assert.equal(r.ivaCLP, 73_625);
    assert.equal(r.totalCLP, 873_625);
  });

  test("NO es renta × 19 %: la deducción del art. 17 baja el impuesto", () => {
    // Este es el error que el módulo existe para evitar. Sin la deducción el
    // IVA sería 152.000 y se le estaría cobrando de más al arrendatario.
    const r = ivaArriendo({
      esAmoblado: true, rentaCLP: 800_000, avaluoFiscalCLP: 45_000_000,
    });
    const sinDeduccion = Math.round((800_000 * IVA_PCT) / 100);
    assert.equal(sinDeduccion, 152_000);
    assert.ok(r.ivaCLP < sinDeduccion);
  });

  test("si la deducción supera la renta, la base es cero y no negativa", () => {
    // Un avalúo alto con una renta baja: el art. 17 permite descontar, no
    // generar un impuesto a favor del contribuyente.
    const r = ivaArriendo({
      esAmoblado: true, rentaCLP: 300_000, avaluoFiscalCLP: 45_000_000,
    });
    assert.equal(r.baseImponibleCLP, 0);
    assert.equal(r.ivaCLP, 0);
    assert.equal(r.totalCLP, 300_000);
  });

  test("un amoblado sin avalúo falla en vez de gravar la renta completa", () => {
    assert.throws(
      () => ivaArriendo({ esAmoblado: true, rentaCLP: 800_000 }),
      /avalúo fiscal/,
    );
    assert.throws(
      () => ivaArriendo({ esAmoblado: true, rentaCLP: 800_000, avaluoFiscalCLP: null }),
      /avalúo fiscal/,
    );
  });

  test("rechaza una renta negativa", () => {
    assert.throws(() => ivaArriendo({ esAmoblado: false, rentaCLP: -1 }));
  });
});

describe("deduccionAvaluo", () => {
  test("un año completo deduce el 11 % del avalúo", () => {
    assert.equal(deduccionAvaluo(45_000_000, 12), 4_950_000);
    assert.equal(DEDUCCION_AVALUO_PCT_ANUAL, 11);
  });

  test("prorratea períodos distintos de un año y redondea al peso", () => {
    // 38.750.000 × 11 % = 4.262.500; /12 = 355.208,33 ⇒ 355.208.
    assert.equal(deduccionAvaluo(38_750_000), 355_208);
    assert.equal(deduccionAvaluo(45_000_000, 6), 2_475_000);
  });

  test("rechaza avalúo negativo y período no positivo", () => {
    assert.throws(() => deduccionAvaluo(-1));
    assert.throws(() => deduccionAvaluo(45_000_000, 0));
    assert.throws(() => deduccionAvaluo(45_000_000, -3));
  });
});

describe("ivaComision", () => {
  test("la corredora persona jurídica emite comisión afecta", () => {
    const r = ivaComision(64_000, true);
    assert.equal(r.afecto, true);
    assert.equal(r.ivaCLP, 12_160);
    assert.equal(r.totalCLP, 76_160);
  });

  test("la corredora persona natural queda exenta (art. 12 E N° 8)", () => {
    const r = ivaComision(64_000, false);
    assert.equal(r.afecto, false);
    assert.equal(r.ivaCLP, 0);
    assert.equal(r.totalCLP, 64_000);
  });

  test("la comisión no lleva deducción de avalúo: esa regla es del arriendo", () => {
    assert.equal(ivaComision(64_000, true).deduccionAvaluoCLP, 0);
  });

  test("rechaza una comisión negativa", () => {
    assert.throws(() => ivaComision(-1, true));
  });
});

describe("ivaArriendoIncluido — IVA dentro del valor pactado", () => {
  test("no amoblado: todo es neto exento, sin IVA, total = renta", () => {
    const r = ivaArriendoIncluido({ esAmoblado: false, rentaCLP: 800_000 });
    assert.equal(r.afecto, false);
    assert.equal(r.ivaCLP, 0);
    assert.equal(r.netoCLP, 800_000);
    assert.equal(r.totalCLP, 800_000);
  });

  test("amoblado: el total NO cambia; el IVA se extrae de adentro", () => {
    // Avalúo 45.000.000 ⇒ deducción mensual 412.500 (exenta).
    // Gravado con IVA = 800.000 − 412.500 = 387.500.
    // neto = round(387.500 / 1,19) = 325.630; iva = 387.500 − 325.630 = 61.870.
    const r = ivaArriendoIncluido({ esAmoblado: true, rentaCLP: 800_000, avaluoFiscalCLP: 45_000_000 });
    assert.equal(r.totalCLP, 800_000);              // el arrendatario paga lo mismo
    assert.equal(r.exentoCLP, 412_500);
    assert.equal(r.netoCLP, 325_630);
    assert.equal(r.ivaCLP, 61_870);
    // Cuadre: exento + neto + iva = total.
    assert.equal(r.exentoCLP + r.netoCLP + r.ivaCLP, r.totalCLP);
  });

  test("cuadre siempre: exento + neto + iva = renta", () => {
    for (const [renta, avaluo] of [[800_000, 45_000_000], [650_000, 30_000_000], [1_200_000, 80_000_000]] as const) {
      const r = ivaArriendoIncluido({ esAmoblado: true, rentaCLP: renta, avaluoFiscalCLP: avaluo });
      assert.equal(r.exentoCLP + r.netoCLP + r.ivaCLP, renta, `cuadre falla ${renta}/${avaluo}`);
    }
  });

  test("avalúo alto que cubre toda la renta: todo exento, IVA cero", () => {
    const r = ivaArriendoIncluido({ esAmoblado: true, rentaCLP: 300_000, avaluoFiscalCLP: 45_000_000 });
    assert.equal(r.exentoCLP, 300_000);
    assert.equal(r.ivaCLP, 0);
    assert.equal(r.totalCLP, 300_000);
  });

  test("amoblado sin avalúo: falla en vez de inventar la base", () => {
    assert.throws(() => ivaArriendoIncluido({ esAmoblado: true, rentaCLP: 800_000 }), /avalúo fiscal/);
  });
});
