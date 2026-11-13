import { describe, expect, it, vi } from "vitest";
import { ErrorIa, hayCupoDiarioIa, iaConfigurada, pedirChat } from "../cloudflare";
import type { AlmacenUsoIa, FilaUsoIa } from "../uso";

const ENV = { CLOUDFLARE_ACCOUNT_ID: "cuenta-123", CLOUDFLARE_API_TOKEN: "token-secreto-xyz" };
const MODELO = "@cf/meta/llama-4-scout-17b-16e-instruct";

function almacen(gastadas = 0) {
  const filas: FilaUsoIa[] = [];
  const a: AlmacenUsoIa = {
    neuronasDesde: async () => gastadas,
    registrar: async (f) => { filas.push(f); },
  };
  return { a, filas };
}

const base = (extra: Partial<Parameters<typeof pedirChat>[0]> = {}) => ({
  flujo: "registro_cedula" as const,
  modelo: MODELO,
  mensajes: [{ role: "user" as const, content: "hola" }],
  maxTokens: 80,
  timeoutMs: 5_000,
  env: ENV,
  ...extra,
});

const respuesta = (cuerpo: unknown, estado = 200) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado }));

describe("iaConfigurada", () => {
  it("exige las dos variables", () => {
    expect(iaConfigurada(ENV)).toBe(true);
    expect(iaConfigurada({ CLOUDFLARE_ACCOUNT_ID: "x" })).toBe(false);
    expect(iaConfigurada({ CLOUDFLARE_API_TOKEN: "x" })).toBe(false);
    expect(iaConfigurada({ CLOUDFLARE_ACCOUNT_ID: " ", CLOUDFLARE_API_TOKEN: " " })).toBe(false);
  });
});

describe("pedirChat", () => {
  it("llama al endpoint compatible con OpenAI con el token en la cabecera", async () => {
    const { a } = almacen();
    const fetchFn = vi.fn(() => respuesta({ choices: [{ message: { content: "ok" } }] }));
    await pedirChat(base({ almacen: a, fetchFn: fetchFn as never }));

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/cuenta-123/ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-secreto-xyz");
    const cuerpo = JSON.parse(init.body as string);
    expect(cuerpo).toMatchObject({ model: MODELO, max_tokens: 80, temperature: 0 });
    expect(cuerpo).not.toHaveProperty("response_format");
  });

  it("devuelve el texto y registra tokens y neuronas, sin contenido", async () => {
    const { a, filas } = almacen();
    const fetchFn = () => respuesta({
      choices: [{ message: { content: "  {\"a\":1}  " } }],
      usage: { prompt_tokens: 1750, completion_tokens: 50 },
    });
    const r = await pedirChat(base({ almacen: a, fetchFn: fetchFn as never }));

    expect(r.texto).toBe("{\"a\":1}");
    expect(r.uso).toEqual({ tokensEntrada: 1750, tokensSalida: 50, neuronas: 47 });
    expect(filas).toEqual([{ flujo: "registro_cedula", modelo: MODELO, tokensEntrada: 1750, tokensSalida: 50, neuronas: 47, ok: true }]);
    expect(JSON.stringify(filas)).not.toContain("hola");
  });

  it("sin variables lanza no_configurada y no llama a nadie", async () => {
    const fetchFn = vi.fn();
    await expect(pedirChat(base({ env: {}, fetchFn: fetchFn as never }))).rejects.toMatchObject({ codigo: "no_configurada" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("con el tope diario agotado lanza cupo_diario sin llamar a Cloudflare", async () => {
    const { a } = almacen(10_000);
    const fetchFn = vi.fn();
    await expect(pedirChat(base({ almacen: a, fetchFn: fetchFn as never }))).rejects.toMatchObject({ codigo: "cupo_diario" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("si el conteo de uso falla, la llamada sigue", async () => {
    const a: AlmacenUsoIa = { neuronasDesde: async () => { throw new Error("db caída"); }, registrar: async () => {} };
    const fetchFn = () => respuesta({ choices: [{ message: { content: "ok" } }] });
    await expect(pedirChat(base({ almacen: a, fetchFn: fetchFn as never }))).resolves.toMatchObject({ texto: "ok" });
  });

  it("si registrar el uso falla, el resultado no se pierde", async () => {
    const a: AlmacenUsoIa = { neuronasDesde: async () => 0, registrar: async () => { throw new Error("db caída"); } };
    const fetchFn = () => respuesta({ choices: [{ message: { content: "ok" } }] });
    await expect(pedirChat(base({ almacen: a, fetchFn: fetchFn as never }))).resolves.toMatchObject({ texto: "ok" });
  });

  it("un 429 es limite_proveedor y queda registrado como fallo", async () => {
    const { a, filas } = almacen();
    const fetchFn = () => respuesta({ errors: [{ code: 4006 }] }, 429);
    await expect(pedirChat(base({ almacen: a, fetchFn: fetchFn as never }))).rejects.toMatchObject({ codigo: "limite_proveedor", estadoHttp: 429 });
    expect(filas[0]).toMatchObject({ ok: false, neuronas: 0 });
  });

  it("otros errores HTTP son http", async () => {
    const { a } = almacen();
    const fetchFn = () => respuesta({}, 500);
    await expect(pedirChat(base({ almacen: a, fetchFn: fetchFn as never }))).rejects.toMatchObject({ codigo: "http", estadoHttp: 500 });
  });

  it("un tiempo agotado es timeout", async () => {
    const { a } = almacen();
    const fetchFn = () => Promise.reject(Object.assign(new Error("agotado"), { name: "TimeoutError" }));
    await expect(pedirChat(base({ almacen: a, fetchFn: fetchFn as never }))).rejects.toMatchObject({ codigo: "timeout" });
  });

  it("una respuesta vacía o sin forma es respuesta_invalida", async () => {
    const { a } = almacen();
    for (const cuerpo of [{}, { choices: [] }, { choices: [{ message: { content: "   " } }] }, { choices: [{ message: { content: 7 } }] }]) {
      await expect(pedirChat(base({ almacen: a, fetchFn: (() => respuesta(cuerpo)) as never }))).rejects.toMatchObject({ codigo: "respuesta_invalida" });
    }
  });

  it("el token nunca aparece en el mensaje de un error", async () => {
    const { a } = almacen();
    const casos: (() => Promise<Response>)[] = [
      () => respuesta({}, 401),
      () => Promise.reject(new Error("fallo con token-secreto-xyz en la url")),
    ];
    for (const caso of casos) {
      const e = await pedirChat(base({ almacen: a, fetchFn: caso as never })).catch((x) => x);
      expect(e).toBeInstanceOf(ErrorIa);
      expect(String(e.message)).not.toContain("token-secreto-xyz");
    }
  });
});

describe("hayCupoDiarioIa", () => {
  it("refleja el tope y, si el conteo falla, deja pasar", async () => {
    expect(await hayCupoDiarioIa("registro_cedula", ENV, almacen(10_000).a)).toBe(false);
    expect(await hayCupoDiarioIa("registro_cedula", ENV, almacen(100).a)).toBe(true);
    const roto: AlmacenUsoIa = { neuronasDesde: async () => { throw new Error("x"); }, registrar: async () => {} };
    expect(await hayCupoDiarioIa("registro_cedula", ENV, roto)).toBe(true);
  });
});
