/**
 * Prepara la foto de la cédula antes de enviarla a la IA externa.
 *
 * - Se reduce: el costo de una imagen crece con su resolución y la letra de una
 *   cédula se lee bien con 1.280 px en el lado mayor.
 * - Se gira según su orientación EXIF y se re-codifica: así se pierden los
 *   metadatos (ubicación GPS, modelo del teléfono), que la IA no necesita.
 * - Se limita el tamaño decodificado: una imagen pequeña en bytes puede ocupar
 *   gigas al abrirse (bomba de descompresión).
 */

/** Lado mayor, en píxeles, de la imagen que se envía. */
export const LADO_MAXIMO_CEDULA_PX = 1280;
const PIXELES_MAXIMOS_ENTRADA = 40_000_000;
const CALIDAD_JPEG = 80;

export type ImagenPreparada = { base64: string; mime: "image/jpeg"; bytes: number };

export async function prepararImagenCedula(original: Buffer): Promise<ImagenPreparada> {
  const { default: sharp } = await import("sharp");
  const salida = await sharp(original, { limitInputPixels: PIXELES_MAXIMOS_ENTRADA })
    .rotate()
    .resize({ width: LADO_MAXIMO_CEDULA_PX, height: LADO_MAXIMO_CEDULA_PX, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: CALIDAD_JPEG, mozjpeg: true })
    .toBuffer();
  return { base64: salida.toString("base64"), mime: "image/jpeg", bytes: salida.length };
}
