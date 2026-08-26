/**
 * Contenido del borrador de contrato (P-PR7).
 *
 * Lo que se fija acá es el TEXTO de las cláusulas, no el PDF binario: se
 * recorre el árbol de elementos que arma `ContratoPdfDocument` y se junta lo
 * que quedaría escrito. Un test contra el binario obligaría a descomprimir el
 * PDF para leerlo, y fallaría por cualquier cambio de fuente o de layout sin
 * decir nada sobre lo que importa.
 *
 * El rol de avalúo es lo que identifica al inmueble ante el SII: una cláusula
 * que solo trae la dirección describe un lugar, no un predio determinado.
 */
import { describe, it, expect } from "vitest";
import { ContratoPdfDocument, type ContratoPdfData } from "../contrato-pdf";

/** Junta el texto de un árbol de elementos de @react-pdf. */
function textoDe(nodo: unknown): string {
  if (nodo === null || nodo === undefined || typeof nodo === "boolean") return "";
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  if (Array.isArray(nodo)) return nodo.map(textoDe).join("");
  if (typeof nodo === "object" && "props" in (nodo as { props?: unknown })) {
    return textoDe((nodo as { props?: { children?: unknown } }).props?.children);
  }
  return "";
}

const BASE: ContratoPdfData = {
  tenantNombre: "Corredora Test",
  propietario:  { nombre: "Ana Propietaria",  rut: "22222222-2", email: null },
  arrendatario: { nombre: "Juan Arrendatario", rut: "11111111-1", email: null },
  propiedad: {
    direccion: "Av. Test 123", comuna: "Ñuñoa", region: "Región Metropolitana",
    tipo: "departamento", rol: "573-24", complementos: [],
  },
  denominacion: "UF", valorArriendo: 24.5, diaVencimiento: 5,
  reajuste: "anual", moraTasaPct: 3, moraDiasGracia: 5,
  garantiaMeses: 0, garantiaDenominacion: null, garantiaMontoBase: null,
  fechaInicio: new Date("2026-01-01"), fechaFin: null,
  generadoEl: new Date("2026-08-26"),
};

const texto = (d: ContratoPdfData) => textoDe(ContratoPdfDocument({ data: d }));

describe("borrador de contrato — rol de avalúo", () => {
  it("nombra el rol del inmueble en la cláusula PRIMERO", () => {
    expect(texto(BASE)).toContain("Rol de Avalúo N° 573-24");
  });

  it("mantiene el rol junto a la dirección y antes de la inscripción del CBR", () => {
    // El orden no es cosmético: la cláusula individualiza el inmueble primero
    // y recién después remite al Conservador.
    const t = texto(BASE);
    expect(t.indexOf("Av. Test 123")).toBeLessThan(t.indexOf("Rol de Avalúo N° 573-24"));
    expect(t.indexOf("Rol de Avalúo N° 573-24")).toBeLessThan(t.indexOf("Conservador de Bienes Raíces"));
  });

  it("no inventa un rol cuando la propiedad no tiene complementos", () => {
    const t = texto(BASE);
    expect(t).not.toContain("Forma parte del arrendamiento");
    expect(t).not.toContain("Forman parte del arrendamiento");
  });
});

describe("borrador de contrato — unidades accesorias", () => {
  const con = (complementos: ContratoPdfData["propiedad"]["complementos"]) =>
    texto({ ...BASE, propiedad: { ...BASE.propiedad, complementos } });

  it("suma una unidad al objeto del arriendo, en singular", () => {
    const t = con([{ tipo: "estacionamiento", rol: "573-118", descripcion: "43" }]);
    expect(t).toContain("Forma parte del arrendamiento el estacionamiento 43, Rol de Avalúo N° 573-118.");
  });

  it("enumera varias en castellano, con «y» antes de la última", () => {
    // Una lista separada solo por comas hasta el final se lee como un descuido
    // en un documento que puede terminar frente a un juez.
    const t = con([
      { tipo: "estacionamiento", rol: "573-118", descripcion: "43" },
      { tipo: "bodega",          rol: "573-201", descripcion: "12" },
      { tipo: "otro",            rol: "573-300", descripcion: "sala de bodegaje" },
    ]);
    expect(t).toContain(
      "Forman parte del arrendamiento el estacionamiento 43, Rol de Avalúo N° 573-118, " +
      "la bodega 12, Rol de Avalúo N° 573-201 y la unidad sala de bodegaje, Rol de Avalúo N° 573-300.",
    );
  });

  it("no repite el sustantivo cuando la descripción ya lo trae", () => {
    // El formulario sugiere escribir "Estacionamiento 43" en la descripción,
    // así que este es el caso normal y no el raro. Sin el ajuste la cláusula
    // decía "el estacionamiento Estacionamiento 216" — se detectó generando un
    // PDF con datos reales de la base, no con los del test.
    const t = con([{ tipo: "estacionamiento", rol: "3390-216", descripcion: "Estacionamiento 216" }]);
    expect(t).toContain("el estacionamiento 216, Rol de Avalúo N° 3390-216.");
    expect(t).not.toContain("estacionamiento Estacionamiento");
  });

  it("tampoco lo repite en bodega, y respeta el resto del texto", () => {
    const t = con([{ tipo: "bodega", rol: "573-201", descripcion: "Bodega B-12" }]);
    expect(t).toContain("la bodega B-12, Rol de Avalúo N° 573-201.");
  });

  it("conserva la descripción tal cual cuando NO empieza por el sustantivo", () => {
    // "Subterráneo 2, sitio 15" no debe perder su mayúscula ni quedar sin el
    // sustantivo que le da sentido.
    const t = con([{ tipo: "estacionamiento", rol: "573-118", descripcion: "Subterráneo 2, sitio 15" }]);
    expect(t).toContain("el estacionamiento Subterráneo 2, sitio 15, Rol de Avalúo N° 573-118.");
  });

  it("omite la descripción cuando no la hay, sin dejar un espacio colgando", () => {
    const t = con([{ tipo: "bodega", rol: "573-201", descripcion: null }]);
    expect(t).toContain("Forma parte del arrendamiento la bodega, Rol de Avalúo N° 573-201.");
    expect(t).not.toContain("la bodega , Rol");
  });

  it("trata una descripción en blanco igual que una ausente", () => {
    const t = con([{ tipo: "bodega", rol: "573-201", descripcion: "   " }]);
    expect(t).toContain("Forma parte del arrendamiento la bodega, Rol de Avalúo N° 573-201.");
  });

  it("deja la frase antes de la entrega del inmueble, no después", () => {
    // Si quedara después de "entrega en arrendamiento el Inmueble", el texto
    // agregaría unidades a un objeto que ya cerró.
    const t = con([{ tipo: "bodega", rol: "573-201", descripcion: "12" }]);
    expect(t.indexOf("Forma parte del arrendamiento"))
      .toBeLessThan(t.indexOf("entrega en arrendamiento el"));
  });
});
