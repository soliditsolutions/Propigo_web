/**
 * Extrae el objeto JSON de la respuesta de un modelo. Sin modo JSON forzado, el
 * modelo a veces lo rodea de texto o de una cerca de código de markdown: se toma
 * desde la primera llave hasta la última.
 */
export function extraerObjetoJson(texto: string): unknown {
  const inicio = texto.indexOf("{");
  const fin = texto.lastIndexOf("}");
  if (inicio === -1 || fin <= inicio) throw new Error("Respuesta IA sin JSON");
  return JSON.parse(texto.slice(inicio, fin + 1));
}
