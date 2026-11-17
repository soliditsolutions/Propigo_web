/**
 * La cámara solo se permite en /registro (foto de la cédula). En cualquier otra
 * ruta sigue bloqueada, y micrófono y geolocalización lo están en todas.
 *
 * Si /registro la bloqueara, el navegador no pediría permiso y quien se registra
 * no vería por qué no puede usar la cámara.
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

type Regla = { source: string; headers: { key: string; value: string }[] };

/** La cabecera que recibiría una ruta: de las reglas que la cubren, gana la última. */
async function permissionsPolicy(ruta: string): Promise<string | undefined> {
  const reglas = (await nextConfig.headers!()) as Regla[];
  const aplican = reglas.filter((r) => r.source === ruta || r.source === "/(.*)");
  const valores = aplican.flatMap((r) => r.headers.filter((h) => h.key === "Permissions-Policy").map((h) => h.value));
  return valores.at(-1);
}

describe("Permissions-Policy", () => {
  it("/registro permite la cámara del propio sitio y nada más", async () => {
    const v = await permissionsPolicy("/registro");
    expect(v).toContain("camera=(self)");
    expect(v).toContain("microphone=()");
    expect(v).toContain("geolocation=()");
  });

  it("el resto de las rutas mantiene la cámara bloqueada", async () => {
    for (const ruta of ["/login", "/panel", "/marketplace", "/portal"]) {
      expect(await permissionsPolicy(ruta)).toBe("camera=(), microphone=(), geolocation=()");
    }
  });

  it("ninguna regla da la cámara a otros orígenes ni a todos", async () => {
    const reglas = (await nextConfig.headers!()) as Regla[];
    for (const r of reglas) {
      for (const h of r.headers.filter((x) => x.key === "Permissions-Policy")) {
        expect(h.value).not.toMatch(/camera=\*/);
        expect(h.value).not.toMatch(/camera=\([^)]*https?:/);
      }
    }
  });
});
