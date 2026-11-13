/**
 * Precio de los modelos de Cloudflare Workers AI que usamos, en neuronas por
 * millón de tokens (página de precios de Workers AI, leída el 2026-11-12). La
 * facturación real es en neuronas: US$ 0,011 por cada 1.000 sobre las 10.000
 * gratis al día.
 *
 * Un modelo que no esté acá se sigue usando, pero su consumo en neuronas queda
 * en 0 en el registro: conviene agregarlo antes de apoyarse en el tope diario.
 */
export const MODELO_VISION_DEFECTO = "@cf/meta/llama-4-scout-17b-16e-instruct";
export const MODELO_TEXTO_DEFECTO = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const NEURONAS_POR_MILLON: Record<string, { entrada: number; salida: number }> = {
  "@cf/meta/llama-4-scout-17b-16e-instruct": { entrada: 24_545, salida: 77_273 },
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": { entrada: 26_668, salida: 204_805 },
  "@cf/openai/gpt-oss-120b": { entrada: 31_818, salida: 68_182 },
  "@cf/qwen/qwen3-30b-a3b-fp8": { entrada: 4_625, salida: 30_475 },
};

/** Neuronas de una llamada, redondeadas hacia arriba. 0 si el modelo no está en la tabla. */
export function calcularNeuronas(modelo: string, tokensEntrada: number, tokensSalida: number): number {
  const p = NEURONAS_POR_MILLON[modelo];
  if (!p) return 0;
  return Math.ceil((tokensEntrada * p.entrada + tokensSalida * p.salida) / 1_000_000);
}
