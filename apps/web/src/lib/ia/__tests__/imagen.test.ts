import sharp, { type Sharp } from "sharp";
import { describe, expect, it } from "vitest";
import { LADO_MAXIMO_CEDULA_PX, prepararImagenCedula } from "../imagen";

async function foto(ancho: number, alto: number, extra?: (s: Sharp) => Sharp) {
  let s = sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 200, g: 180, b: 160 } } });
  if (extra) s = extra(s);
  return s.jpeg().toBuffer();
}

describe("prepararImagenCedula", () => {
  it("reduce una foto grande al lado máximo y la entrega como JPEG en base64", async () => {
    const r = await prepararImagenCedula(await foto(4000, 3000));
    const meta = await sharp(Buffer.from(r.base64, "base64")).metadata();
    expect(r.mime).toBe("image/jpeg");
    expect(meta.format).toBe("jpeg");
    expect(Math.max(meta.width!, meta.height!)).toBe(LADO_MAXIMO_CEDULA_PX);
    expect(meta.width! / meta.height!).toBeCloseTo(4 / 3, 1);
  });

  it("no agranda una foto chica", async () => {
    const r = await prepararImagenCedula(await foto(600, 400));
    const meta = await sharp(Buffer.from(r.base64, "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([600, 400]);
  });

  it("quita los metadatos (EXIF, ubicación)", async () => {
    const conExif = await foto(800, 600, (s) => s.withExif({ IFD0: { Copyright: "dato-personal" } }));
    expect((await sharp(conExif).metadata()).exif).toBeDefined();
    const r = await prepararImagenCedula(conExif);
    expect((await sharp(Buffer.from(r.base64, "base64")).metadata()).exif).toBeUndefined();
  });

  it("la foto reducida pesa menos que la original", async () => {
    const original = await foto(4000, 3000);
    const r = await prepararImagenCedula(original);
    expect(r.bytes).toBeLessThan(original.length);
  });

  it("rechaza lo que no es una imagen", async () => {
    await expect(prepararImagenCedula(Buffer.from("no soy una imagen"))).rejects.toThrow();
  });
});
