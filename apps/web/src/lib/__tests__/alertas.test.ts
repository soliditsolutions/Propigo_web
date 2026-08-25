/**
 * Alertas personalizadas — dominio puro.
 *
 * Lo que se prueba es el borde entre lo que el corredor escribe y lo que recibe
 * el arrendatario: que los marcadores se reemplacen, que un error de plantilla
 * no llegue disfrazado, y que no se pueda guardar una alerta "automática" que
 * nunca se va a disparar.
 */
import { describe, it, expect } from "vitest";
import {
  renderizarAlerta,
  marcadoresDesconocidos,
  validarAlerta,
  MARCADORES,
  LIMITES,
  type EntradaAlerta,
} from "../alertas";

const BASE: EntradaAlerta = {
  nombre: "Aviso de mantención",
  asunto: "Mantención en {{direccion}}",
  cuerpo: "Hola {{arrendatario}}, avisamos una mantención.",
  destinatario: "arrendatario",
  disparador: null,
  diasOffset: null,
};

describe("renderizarAlerta", () => {
  it("reemplaza los marcadores por sus valores", () => {
    const r = renderizarAlerta("Hola {{arrendatario}}, arriendo de {{direccion}}", {
      arrendatario: "Ana Pérez",
      direccion: "La Coruña 1483",
    });
    expect(r).toBe("Hola Ana Pérez, arriendo de La Coruña 1483");
  });

  it("tolera espacios dentro de las llaves", () => {
    expect(renderizarAlerta("{{ arrendatario }}", { arrendatario: "Ana" })).toBe("Ana");
  });

  it("formatea el monto como dinero y la fecha como fecha", () => {
    const r = renderizarAlerta("{{monto}} vence el {{vencimiento}}", {
      monto: 450000,
      vencimiento: new Date("2026-09-05T00:00:00Z"),
    });
    // No se fija el formato exacto (depende del locale del helper): lo que
    // importa es que NO quede el número crudo ni el Date serializado.
    expect(r).not.toContain("450000");
    expect(r).not.toContain("2026-09-05T");
    expect(r).toMatch(/450\.000/);
  });

  it("un monto ya formateado (UF o CLP) se respeta tal cual", () => {
    // Regresión: un contrato en UF se renderizaba como "$10" porque el monto
    // se formateaba siempre como pesos, ignorando la denominación. Ahora lo
    // formatea quien la conoce y llega listo.
    expect(renderizarAlerta("Arriendo: {{monto}}", { monto: "UF 10,00" })).toBe("Arriendo: UF 10,00");
    expect(renderizarAlerta("Arriendo: {{monto}}", { monto: "$450.000" })).toBe("Arriendo: $450.000");
  });

  it("un marcador sin dato queda vacío, no como llave suelta", () => {
    // Un hueco se lee como omisión; "{{monto}}" se lee como sistema roto.
    expect(renderizarAlerta("Total: {{monto}}", {})).toBe("Total: ");
  });

  it("un marcador desconocido se deja intacto", () => {
    // Borrarlo en silencio le escondería al corredor que se equivocó.
    expect(renderizarAlerta("Hola {{inventado}}", {})).toBe("Hola {{inventado}}");
  });

  it("no toca texto sin marcadores", () => {
    expect(renderizarAlerta("Mensaje simple.", { arrendatario: "Ana" })).toBe("Mensaje simple.");
  });

  it.each([["texto", "X"], ["numérico", 123]])("un valor %s inválido para monto queda vacío, no \"$NaN\"", (_c, v) => {
    expect(renderizarAlerta("{{monto}}", { monto: v === 123 ? v : "no-es-monto" })).not.toMatch(/NaN/);
  });

  it("una fecha inválida queda vacía, no \"Invalid Date\"", () => {
    expect(renderizarAlerta("{{vencimiento}}", { vencimiento: "no-es-fecha" })).toBe("");
  });

  it("todos los marcadores publicados se pueden renderizar", () => {
    // Si se publica un marcador en la ayuda, tiene que funcionar de verdad.
    const valorPara: Record<string, string | number | Date> = {
      monto: 1000, vencimiento: new Date("2026-09-05T00:00:00Z"),
    };
    for (const m of MARCADORES) {
      const valor = valorPara[m.clave] ?? "X";
      const r = renderizarAlerta(`[{{${m.clave}}}]`, { [m.clave]: valor });
      expect(r).not.toBe(`[{{${m.clave}}}]`);   // se renderizó
      expect(r).not.toMatch(/NaN|Invalid/);       // y no con basura
    }
  });
});

describe("marcadoresDesconocidos", () => {
  it("detecta los que no existen y no repite", () => {
    expect(marcadoresDesconocidos("{{foo}} {{arrendatario}} {{foo}} {{bar}}")).toEqual(["foo", "bar"]);
  });

  it("no reporta nada cuando todos son válidos", () => {
    expect(marcadoresDesconocidos("{{arrendatario}} {{monto}}")).toEqual([]);
  });
});

describe("validarAlerta", () => {
  it("acepta una alerta manual bien formada", () => {
    expect(validarAlerta(BASE)).toBeNull();
  });

  it("acepta una alerta automática con disparador y días", () => {
    expect(validarAlerta({ ...BASE, disparador: "antes_de_vencimiento", diasOffset: 5 })).toBeNull();
  });

  it.each([
    ["nombre vacío",  { nombre: "  " },  /nombre/i],
    ["asunto vacío",  { asunto: "" },    /asunto/i],
    ["cuerpo vacío",  { cuerpo: "   " }, /mensaje/i],
  ])("rechaza %s", (_caso, patch, patron) => {
    expect(validarAlerta({ ...BASE, ...patch } as EntradaAlerta)).toMatch(patron);
  });

  it("rechaza un marcador inventado antes de guardar", () => {
    const r = validarAlerta({ ...BASE, cuerpo: "Hola {{inventado}}" });
    expect(r).toMatch(/\{\{inventado\}\}/);
  });

  it("rechaza automática sin días — nunca se dispararía", () => {
    const r = validarAlerta({ ...BASE, disparador: "dias_de_mora", diasOffset: null });
    expect(r).toMatch(/cuántos días/i);
  });

  it("rechaza días sin disparador — el número no haría nada", () => {
    const r = validarAlerta({ ...BASE, disparador: null, diasOffset: 5 });
    expect(r).toMatch(/no cuándo debe dispararse/i);
  });

  it("rechaza un offset fuera de rango", () => {
    expect(validarAlerta({ ...BASE, disparador: "dias_de_mora", diasOffset: -1 })).toMatch(/entre 0 y/);
    expect(validarAlerta({ ...BASE, disparador: "dias_de_mora", diasOffset: LIMITES.diasOffsetMax + 1 })).toMatch(/entre 0 y/);
  });

  it("rechaza un cuerpo desmedido", () => {
    expect(validarAlerta({ ...BASE, cuerpo: "x".repeat(LIMITES.cuerpo + 1) })).toMatch(/no puede pasar/);
  });
});
