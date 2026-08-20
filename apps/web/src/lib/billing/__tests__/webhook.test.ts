/**
 * Webhook de pasarela — ADR-0014, fila P-A3.
 *
 * Se mockea `prisma` para poder ejercitar las ramas sin base de datos: lo que
 * se prueba acá es la máquina de decisión (qué código HTTP y si se persiste),
 * no el driver de Postgres. La idempotencia real la garantiza además el UNIQUE
 * de `id_externo` en la base — cubierto por el invariante 3.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const crearEvento = vi.fn();

vi.mock("../../db", () => ({
  prisma: {
    eventoGatewayPago: {
      get create() {
        return crearEvento;
      },
    },
  },
}));

const { procesarWebhook, _internals } = await import("../webhook");
const { FakeBillingGateway } = await import("../fake-gateway");

const FIRMA_OK = { "x-fake-signature": "firma-valida" };

function cuerpo(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "evt_001",
    tipo: "cobro_aprobado",
    trx: "trx_001",
    ts: new Date().toISOString(),
    ...extra,
  });
}

/** Error con forma de violación de UNIQUE, como el que tira Prisma/Postgres. */
function errorDuplicado(code: string) {
  return Object.assign(new Error("duplicate key"), { code });
}

describe("Webhook de pasarela", () => {
  let gateway: InstanceType<typeof FakeBillingGateway>;

  beforeEach(() => {
    gateway = new FakeBillingGateway();
    crearEvento.mockReset();
    crearEvento.mockResolvedValue({ id: "row_1" });
  });

  describe("autenticación por firma", () => {
    it("rechaza sin firma y no persiste nada", async () => {
      const r = await procesarWebhook(gateway, cuerpo(), {});
      expect(r.status).toBe(401);
      expect(crearEvento).not.toHaveBeenCalled();
    });

    it("rechaza con firma incorrecta", async () => {
      const r = await procesarWebhook(gateway, cuerpo(), { "x-fake-signature": "falsa" });
      expect(r.status).toBe(401);
      expect(crearEvento).not.toHaveBeenCalled();
    });

    it("acepta con firma válida", async () => {
      const r = await procesarWebhook(gateway, cuerpo(), FIRMA_OK);
      expect(r.status).toBe(200);
      expect(crearEvento).toHaveBeenCalledOnce();
    });

    it("valida la firma ANTES de parsear — un payload basura firmado mal da 401, no 400", async () => {
      // Importa el orden: si parseáramos primero, un atacante podría hacernos
      // gastar CPU o disparar rutas de error con contenido no autenticado.
      const r = await procesarWebhook(gateway, "{{{ no es json", {});
      expect(r.status).toBe(401);
    });
  });

  describe("payload", () => {
    it("rechaza un cuerpo ilegible con firma válida (400, no reintentar)", async () => {
      const r = await procesarWebhook(gateway, "no es json", FIRMA_OK);
      expect(r.status).toBe(400);
      expect(crearEvento).not.toHaveBeenCalled();
    });

    it("rechaza un cuerpo sin los campos mínimos", async () => {
      const r = await procesarWebhook(gateway, JSON.stringify({ falta: "todo" }), FIRMA_OK);
      expect(r.status).toBe(400);
    });

    it("rechaza un cuerpo por sobre el tope de tamaño", async () => {
      const enorme = JSON.stringify({ id: "e", tipo: "cobro_aprobado", relleno: "x".repeat(_internals.MAX_BODY_BYTES) });
      const r = await procesarWebhook(gateway, enorme, FIRMA_OK);
      expect(r.status).toBe(413);
      expect(crearEvento).not.toHaveBeenCalled();
    });
  });

  describe("anti-replay", () => {
    it("descarta un evento más viejo que la ventana, aunque venga firmado", async () => {
      const viejo = new Date(Date.now() - _internals.VENTANA_REPLAY_MS - 60_000);
      const r = await procesarWebhook(gateway, cuerpo({ ts: viejo.toISOString() }), FIRMA_OK);
      expect(r.status).toBe(400);
      expect(crearEvento).not.toHaveBeenCalled();
    });

    it("acepta reintentos legítimos dentro de la ventana", async () => {
      // Un proveedor reintentando tras varias horas de caída nuestra es un caso
      // real y no debe tratarse como replay.
      const haceHoras = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const r = await procesarWebhook(gateway, cuerpo({ ts: haceHoras.toISOString() }), FIRMA_OK);
      expect(r.status).toBe(200);
    });
  });

  describe("idempotencia", () => {
    it.each(["P2002", "23505"])(
      "un evento repetido (%s) responde 200 sin reprocesar",
      async (code) => {
        crearEvento.mockRejectedValueOnce(errorDuplicado(code));
        const r = await procesarWebhook(gateway, cuerpo(), FIRMA_OK);
        // 200 y no 4xx: desde el punto de vista del proveedor el evento ya está
        // entregado. Un 4xx lo haría reintentar o alertar sin motivo.
        expect(r.status).toBe(200);
        expect(r.body.detalle).toBe("duplicado");
      },
    );

    it("un fallo de base que NO es duplicado se propaga para que el proveedor reintente", async () => {
      crearEvento.mockRejectedValueOnce(new Error("connection refused"));
      await expect(procesarWebhook(gateway, cuerpo(), FIRMA_OK)).rejects.toThrow(/connection refused/);
    });
  });

  describe("persistencia del crudo", () => {
    it("guarda el payload tal cual, con proveedor y tipo normalizado", async () => {
      await procesarWebhook(gateway, cuerpo(), FIRMA_OK);
      const args = crearEvento.mock.calls[0][0];
      expect(args.data.proveedor).toBe("fake");
      expect(args.data.idExterno).toBe("evt_001");
      expect(args.data.tipo).toBe("cobro_aprobado");
      expect(args.data.payload).toMatchObject({ id: "evt_001", trx: "trx_001" });
    });

    it("un tipo desconocido igual se guarda, marcado como tal", async () => {
      // No descartamos lo que no entendemos: se persiste para poder auditarlo
      // y, si hace falta, reprocesarlo cuando el código sepa manejarlo.
      await procesarWebhook(gateway, cuerpo({ tipo: "algo_nuevo_del_proveedor" }), FIRMA_OK);
      expect(crearEvento.mock.calls[0][0].data.tipo).toBe("desconocido");
    });

    it("deja procesadoEn sin definir: recibido no es lo mismo que aplicado", async () => {
      await procesarWebhook(gateway, cuerpo(), FIRMA_OK);
      expect(crearEvento.mock.calls[0][0].data.procesadoEn).toBeUndefined();
    });
  });
});
