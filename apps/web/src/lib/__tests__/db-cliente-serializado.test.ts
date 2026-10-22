import { describe, it, expect, vi, afterEach } from "vitest";
import pg from "pg";
import { ClienteSerializado } from "../pg-adaptador";

describe("ClienteSerializado", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ejecuta en fila las consultas con promesa lanzadas en paralelo, en el orden de llegada", async () => {
    let enCurso = 0;
    let maximo = 0;
    const orden: string[] = [];
    vi.spyOn(pg.Client.prototype, "query").mockImplementation((async (sql: string) => {
      enCurso++;
      maximo = Math.max(maximo, enCurso);
      await new Promise((r) => setTimeout(r, 5));
      orden.push(sql);
      enCurso--;
      return { rows: [sql] };
    }) as never);

    const cliente = new ClienteSerializado();
    const resultados = await Promise.all([
      cliente.query("A"),
      cliente.query("B"),
      cliente.query("C"),
    ]);

    expect(maximo).toBe(1);
    expect(orden).toEqual(["A", "B", "C"]);
    expect(resultados.map((r: { rows: string[] }) => r.rows[0])).toEqual(["A", "B", "C"]);
  });

  it("un error no bloquea las consultas siguientes y se propaga a quien lo provocó", async () => {
    vi.spyOn(pg.Client.prototype, "query").mockImplementation((async (sql: string) => {
      if (sql === "MALA") throw new Error("falló");
      return { rows: [sql] };
    }) as never);

    const cliente = new ClienteSerializado();
    const mala = cliente.query("MALA");
    const buena = cliente.query("BUENA");

    await expect(mala).rejects.toThrow("falló");
    await expect(buena).resolves.toEqual({ rows: ["BUENA"] });
  });

  it("la forma con callback pasa directo, sin encolarse", () => {
    const original = vi.spyOn(pg.Client.prototype, "query").mockImplementation((() => undefined) as never);
    const cb = () => undefined;
    new ClienteSerializado().query("X", cb);
    expect(original).toHaveBeenCalledWith("X", cb);
  });
});
