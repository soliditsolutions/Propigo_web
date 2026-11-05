/**
 * Guardia estática: ninguna llamada a getActor()/redirect()/notFound() dentro
 * de un try puede quedar en un catch que no la relance.
 *
 * getActor() señala "sin sesión" o "usuario desactivado" con redirect(), que
 * Next implementa lanzando un error propio. Un catch que lo trague responde
 * "No se pudo guardar…" y deja al usuario en una página que ya no puede usar,
 * además de ensuciar el log con un falso error. El catch debe empezar con
 * unstable_rethrow(err) (o delegar en actorDeRuta, en las rutas API).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SRC = path.resolve(__dirname, "../..");
const LANZAN = new Set(["getActor", "redirect", "notFound"]);
const RELANZA = /unstable_rethrow|esControlDeNext/;

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ["generated", "__tests__"].includes(e.name) ? [] : archivos(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

function tragados(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  if (!/getActor\(|redirect\(|notFound\(/.test(src)) return [];
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hallazgos: string[] = [];

  function visita(n: ts.Node, trys: ts.TryStatement[]) {
    if (ts.isTryStatement(n)) {
      visita(n.tryBlock, [...trys, n]);
      if (n.catchClause) visita(n.catchClause, trys);
      if (n.finallyBlock) visita(n.finallyBlock, trys);
      return;
    }
    // Una función anidada tiene su propio alcance: el try de afuera no la cubre.
    if (ts.isFunctionLike(n) && trys.length) { ts.forEachChild(n, (c) => visita(c, [])); return; }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && LANZAN.has(n.expression.text) && trys.length) {
      const t = trys[trys.length - 1];
      if (t.catchClause && !RELANZA.test(t.catchClause.block.getText(sf))) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        hallazgos.push(`${path.relative(SRC, file).replace(/\\/g, "/")}:${line + 1} ${n.expression.text}()`);
      }
    }
    ts.forEachChild(n, (c) => visita(c, trys));
  }
  visita(sf, []);
  return hallazgos;
}

describe("redirect de Next dentro de try/catch", () => {
  it("todo catch que envuelve getActor/redirect/notFound lo relanza", () => {
    const hallazgos = archivos(SRC).flatMap(tragados);
    expect(hallazgos).toEqual([]);
  });
});
