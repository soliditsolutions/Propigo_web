import { describe, expect, it, vi } from "vitest";
import { crearPedirSerieBcch, parsearSerieBcch, SERIE_IPC, SERIE_UF } from "../bcch";

const resp = (obs: object[]) => ({ Codigo: 0, Descripcion: "Success", Series: { seriesId: SERIE_UF, Obs: obs } });

describe("parsearSerieBcch", () => {
  it("lee fecha DD-MM-YYYY y valor como número", () => {
    const r = parsearSerieBcch(resp([{ indexDateString: "10-11-2026", value: "39654.42", statusCode: "OK" }]));
    expect(r).toEqual([{ fecha: new Date(Date.UTC(2026, 10, 10)), valor: 39654.42 }]);
  });

  it("descarta los días sin dato (NaN / ND)", () => {
    const r = parsearSerieBcch(resp([
      { indexDateString: "01-10-2024", value: "NaN", statusCode: "ND" },
      { indexDateString: "02-10-2024", value: "100", statusCode: "OK" },
    ]));
    expect(r).toHaveLength(1);
  });

  it("descarta ceros, negativos, texto y fechas imposibles", () => {
    const r = parsearSerieBcch(resp([
      { indexDateString: "01-10-2024", value: "0", statusCode: "OK" },
      { indexDateString: "02-10-2024", value: "-5", statusCode: "OK" },
      { indexDateString: "03-10-2024", value: "abc", statusCode: "OK" },
      { indexDateString: "31-02-2024", value: "10", statusCode: "OK" },
      { indexDateString: "2024-10-04", value: "10", statusCode: "OK" },
    ]));
    expect(r).toEqual([]);
  });

  it("lanza si la estructura no es la esperada o el código no es 0", () => {
    expect(() => parsearSerieBcch(null)).toThrow();
    expect(() => parsearSerieBcch({ Codigo: -1, Descripcion: "Error" })).toThrow();
    expect(() => parsearSerieBcch({ Codigo: 0, Series: {} })).toThrow();
  });
});

describe("crearPedirSerieBcch", () => {
  const desde = new Date(Date.UTC(2026, 0, 1));
  const hasta = new Date(Date.UTC(2026, 0, 31));
  const comoFetch = (f: unknown) => f as typeof fetch;

  it("arma la URL con token, serie y fechas ISO", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => resp([]) });
    await crearPedirSerieBcch("tok en", comoFetch(f))(SERIE_IPC, desde, hasta);
    const url = new URL(f.mock.calls[0][0]);
    expect(url.searchParams.get("token")).toBe("tok en");
    expect(url.searchParams.get("timeseries")).toBe(SERIE_IPC);
    expect(url.searchParams.get("firstdate")).toBe("2026-01-01");
    expect(url.searchParams.get("lastdate")).toBe("2026-01-31");
  });

  it("un fallo de red no filtra el token en el mensaje", async () => {
    const f = vi.fn().mockRejectedValue(new Error("fetch failed https://x/?token=SECRETO123"));
    const err = await crearPedirSerieBcch("SECRETO123", comoFetch(f))(SERIE_UF, desde, hasta).catch((e: Error) => e);
    expect((err as Error).message).not.toContain("SECRETO123");
  });

  it("un HTTP no exitoso lanza con el código y sin el token", async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const err = await crearPedirSerieBcch("SECRETO123", comoFetch(f))(SERIE_UF, desde, hasta).catch((e: Error) => e);
    expect((err as Error).message).toMatch(/503/);
    expect((err as Error).message).not.toContain("SECRETO123");
  });

  it("un cuerpo que no es JSON lanza en vez de cargar basura", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("x"); } });
    await expect(crearPedirSerieBcch("t", comoFetch(f))(SERIE_UF, desde, hasta)).rejects.toThrow();
  });
});
