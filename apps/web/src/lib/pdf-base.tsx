/**
 * Base común de todos los PDF: guionado desactivado y `Text` sin cortes con guion.
 *
 * react-pdf parte palabras con patrones de guionado en inglés ("Ar-rendadora") y,
 * además, trata como punto de guionado cualquier unión sin espacio entre dos
 * fragmentos de texto (`{rut},` o `<B>{nombre}</B>,`). Así cortaba el RUT del
 * arrendatario en el borrador de contrato como "16.444.555-0-", alterando un
 * dato identificatorio. Una palabra que no cabe pasa entera a la línea siguiente.
 */
import type { ComponentProps } from "react";
import { Font, Text as TextPdf } from "@react-pdf/renderer";

Font.registerHyphenationCallback((palabra) => [palabra]);

/** Penalización infinita del algoritmo de cortes: ese punto nunca se usa. */
export const SIN_GUIONADO = 10_000;

// El motor de layout lee `hyphenationPenalty` de las props del Text
// (@react-pdf/layout, getLayoutOptions), pero los tipos públicos no la declaran.
const SIN_CORTES: Record<string, unknown> = { hyphenationPenalty: SIN_GUIONADO };

export function Text(props: ComponentProps<typeof TextPdf>) {
  return <TextPdf {...SIN_CORTES} {...props} />;
}
