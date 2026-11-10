import { describe, expect, it, vi } from "vitest";
import { cargarIndicadores, type DbSeries } from "../cargar";
import { SERIE_IPC, SERIE_UF, type Observacion, type PedirSerie } from "../bcch";

const d = (y: number, m: number, dia = 1) => new Date(Date.UTC(y, m - 1, dia));
const AHORA = d(2026, 11, 9);

function mayor(m: Map<number, number>): [Date, number] | null {
  const k = [...m.keys()].sort((a, b) => b - a)[0];
  return k === undefined ? null : [new Date(k), m.get(k)!];
}

/** Base falsa con las dos tablas, que respeta `skipDuplicates` como Prisma. */
function crearDb(uf: [Date, number][] = [], ipc: [Date, number][] = []) {
  const ufs = new Map(uf.map(([f, v]) => [f.getTime(), v]));
  const ipcs = new Map(ipc.map(([f, v]) => [f.getTime(), v]));
  const db: DbSeries = {
    serieUf: {
      findFirst: async () => {
        const u = mayor(ufs);
        return u ? { fecha: u[0], valorClp: u[1] } : null;
      },
      createMany: async ({ data }) => {
        let n = 0;
        for (const r of data) {
          if (!ufs.has(r.fecha.getTime())) { ufs.set(r.fecha.getTime(), r.valorClp); n++; }
        }
        return { count: n };
      },
    },
    serieIpc: {
      findFirst: async () => {
        const u = mayor(ipcs);
        return u ? { periodo: u[0], indice: u[1] } : null;
      },
      createMany: async ({ data }) => {
        let n = 0;
        for (const r of data) {
          if (!ipcs.has(r.periodo.getTime())) { ipcs.set(r.periodo.getTime(), r.indice); n++; }
        }
        return { count: n };
      },
    },
  };
  return { db, ufs, ipcs };
}

const fuente = (porSerie: Record<string, Observacion[] | Error>) =>
  vi.fn(async (serie: string) => {
    const r = porSerie[serie];
    if (r instanceof Error) throw r;
    return r ?? [];
  }) as unknown as PedirSerie & ReturnType<typeof vi.fn>;

const llamadaDe = (pedir: ReturnType<typeof fuente>, serie: string) =>
  (pedir as unknown as { mock: { calls: [string, Date, Date][] } }).mock.calls.find((c) => c[0] === serie)!;

describe("cargarIndicadores — UF", () => {
  it("con la tabla vacía pide 3 años hacia atrás y 45 días hacia adelante", async () => {
    const { db } = crearDb();
    const pedir = fuente({});
    await cargarIndicadores(db, pedir, AHORA);
    const [, desde, hasta] = llamadaDe(pedir, SERIE_UF);
    expect(desde).toEqual(d(2023, 11, 9));
    expect(hasta).toEqual(d(2026, 12, 24));
  });

  it("con datos pide desde 14 días antes del último, para rellenar huecos", async () => {
    const { db } = crearDb([[d(2026, 11, 20), 40000]]);
    const pedir = fuente({});
    await cargarIndicadores(db, pedir, AHORA);
    expect(llamadaDe(pedir, SERIE_UF)[1]).toEqual(d(2026, 11, 6));
  });

  it("inserta lo nuevo y NO pisa lo que ya estaba", async () => {
    const { db, ufs } = crearDb([[d(2026, 11, 9), 39000]]);
    const r = await cargarIndicadores(db, fuente({
      [SERIE_UF]: [{ fecha: d(2026, 11, 9), valor: 11111 }, { fecha: d(2026, 11, 10), valor: 39010 }],
    }), AHORA);
    expect(r.uf.insertados).toBe(1);
    expect(ufs.get(d(2026, 11, 9).getTime())).toBe(39000);
    expect(r.uf.hasta).toBe("2026-11-10");
  });

  it("descarta valores fuera de rango de cordura", async () => {
    const { db, ufs } = crearDb();
    await cargarIndicadores(db, fuente({ [SERIE_UF]: [{ fecha: d(2026, 11, 9), valor: 39.5 }] }), AHORA);
    expect(ufs.size).toBe(0);
  });
});

describe("cargarIndicadores — IPC", () => {
  it("normaliza el período al día 1 del mes", async () => {
    const { db, ipcs } = crearDb();
    await cargarIndicadores(db, fuente({ [SERIE_IPC]: [{ fecha: d(2026, 9, 15), valor: 125.1 }] }), AHORA);
    expect([...ipcs.keys()]).toEqual([d(2026, 9, 1).getTime()]);
  });

  it("rechaza un salto de más de 5 % (posible cambio de base) y no inserta nada", async () => {
    const { db, ipcs } = crearDb([], [[d(2026, 8, 1), 125]]);
    const r = await cargarIndicadores(db, fuente({
      [SERIE_IPC]: [{ fecha: d(2026, 9, 1), valor: 100 }, { fecha: d(2026, 10, 1), valor: 100.4 }],
    }), AHORA);
    expect(r.ipc.error).toMatch(/cambio de base/i);
    expect(r.ipc.insertados).toBe(0);
    expect(ipcs.size).toBe(1);
  });

  it("acepta una variación mensual normal", async () => {
    const { db } = crearDb([], [[d(2026, 8, 1), 125]]);
    const r = await cargarIndicadores(db, fuente({ [SERIE_IPC]: [{ fecha: d(2026, 9, 1), valor: 125.6 }] }), AHORA);
    expect(r.ipc).toEqual({ insertados: 1, hasta: "2026-09-01" });
  });
});

describe("cargarIndicadores — fallos", () => {
  it("si falla la UF igual carga el IPC, y el error queda en la UF", async () => {
    const { db, ipcs } = crearDb();
    const r = await cargarIndicadores(db, fuente({
      [SERIE_UF]: new Error("El Banco Central respondió 503"),
      [SERIE_IPC]: [{ fecha: d(2026, 9, 1), valor: 125 }],
    }), AHORA);
    expect(r.uf.error).toMatch(/503/);
    expect(r.ipc.insertados).toBe(1);
    expect(ipcs.size).toBe(1);
  });

  it("es idempotente: una segunda corrida no inserta nada", async () => {
    const { db } = crearDb();
    const pedir = fuente({
      [SERIE_UF]: [{ fecha: d(2026, 11, 9), valor: 39000 }],
      [SERIE_IPC]: [{ fecha: d(2026, 9, 1), valor: 125 }],
    });
    await cargarIndicadores(db, pedir, AHORA);
    const r2 = await cargarIndicadores(db, pedir, AHORA);
    expect(r2.uf.insertados + r2.ipc.insertados).toBe(0);
  });
});
