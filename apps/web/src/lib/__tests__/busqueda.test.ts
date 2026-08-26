import { describe, it, expect } from "vitest";
import {
  terminoBusqueda, MAX_TERMINO,
  numeroFiltro, enteroFiltro, idFiltro, opcionFiltro,
} from "../busqueda";

describe("terminoBusqueda", () => {
  it("deja pasar un término normal sin tocarlo", () => {
    expect(terminoBusqueda("Providencia")).toBe("Providencia");
  });

  it("recorta los espacios de los bordes", () => {
    expect(terminoBusqueda("  Ñuñoa  ")).toBe("Ñuñoa");
  });

  it("devuelve null cuando no queda nada que buscar", () => {
    expect(terminoBusqueda("")).toBeNull();
    expect(terminoBusqueda("   ")).toBeNull();
    expect(terminoBusqueda(undefined)).toBeNull();
    expect(terminoBusqueda(null)).toBeNull();
  });

  it("neutraliza el comodín de porcentaje", () => {
    // Este es el caso que se comprobó contra el servidor: `?q=%` devolvía el
    // catálogo completo del marketplace público.
    expect(terminoBusqueda("%")).toBe("\\%");
    expect(terminoBusqueda("Las %")).toBe("Las \\%");
  });

  it("neutraliza el comodín de guion bajo", () => {
    expect(terminoBusqueda("_")).toBe("\\_");
    expect(terminoBusqueda("a_b")).toBe("a\\_b");
  });

  it("escapa la barra invertida antes que los comodines", () => {
    // Si el orden se invirtiera, `\%` quedaría como `\\%`: la barra escapada y
    // el porcentaje suelto de nuevo como comodín. Es un error silencioso que
    // solo se ve con esta entrada.
    expect(terminoBusqueda("\\%")).toBe("\\\\\\%");
    expect(terminoBusqueda("\\")).toBe("\\\\");
  });

  it("limita el largo del término", () => {
    const largo = "a".repeat(500);
    expect(terminoBusqueda(largo)).toHaveLength(MAX_TERMINO);
  });

  it("aplica el tope antes de escapar, para que el escape no se corte por la mitad", () => {
    // Cortar después dejaría una barra invertida final huérfana, y Postgres
    // rechaza un patrón LIKE que termina en escape.
    const resultado = terminoBusqueda("%".repeat(MAX_TERMINO + 20))!;
    expect(resultado).toBe("\\%".repeat(MAX_TERMINO));
    expect(resultado.endsWith("\\")).toBe(false);
  });
});

describe("numeroFiltro", () => {
  it("acepta números normales", () => {
    expect(numeroFiltro("850000")).toBe(850000);
    expect(numeroFiltro("12.5")).toBe(12.5);
  });

  it("descarta lo que no es número", () => {
    // Los tres tumbaban el marketplace público con un 500 antes de este filtro.
    expect(numeroFiltro("abc")).toBeNull();
    expect(numeroFiltro("NaN")).toBeNull();
    expect(numeroFiltro("1e400")).toBeNull();      // Number() lo lee como Infinity
    expect(numeroFiltro("Infinity")).toBeNull();
  });

  it("descarta vacío y ausente", () => {
    expect(numeroFiltro("")).toBeNull();
    expect(numeroFiltro("   ")).toBeNull();
    expect(numeroFiltro(undefined)).toBeNull();
    expect(numeroFiltro(null)).toBeNull();
  });

  it("respeta el rango", () => {
    expect(numeroFiltro("-1")).toBeNull();                  // min por defecto es 0
    expect(numeroFiltro("5", { min: 10 })).toBeNull();
    expect(numeroFiltro("500", { max: 100 })).toBeNull();
    expect(numeroFiltro("50", { min: 10, max: 100 })).toBe(50);
  });

  it("acepta el cero, que es un filtro legítimo", () => {
    // Un `?precioMin=0` tiene sentido; si se tratara como "falsy" se perdería.
    expect(numeroFiltro("0")).toBe(0);
  });
});

describe("enteroFiltro", () => {
  it("acepta enteros y rechaza decimales", () => {
    expect(enteroFiltro("3")).toBe(3);
    expect(enteroFiltro("3.5")).toBeNull();
  });

  it("rechaza un número absurdamente grande", () => {
    expect(enteroFiltro("999999999999999999999", { max: 100 })).toBeNull();
  });
});

describe("idFiltro", () => {
  it("acepta un uuid", () => {
    const id = "172ac35f-1600-4522-bfae-b75d06a7da88";
    expect(idFiltro(id)).toBe(id);
    expect(idFiltro(id.toUpperCase())).toBe(id.toUpperCase());
  });

  it("rechaza cualquier cosa que Postgres no aceptaría como uuid", () => {
    // Sin esto el valor llegaba a una columna uuid y la página devolvía 500.
    expect(idFiltro("abc")).toBeNull();
    expect(idFiltro("' OR '1'='1")).toBeNull();
    expect(idFiltro("../../etc/passwd")).toBeNull();
    expect(idFiltro("172ac35f-1600-4522-bfae-b75d06a7da8")).toBeNull();  // un dígito menos
    expect(idFiltro("")).toBeNull();
    expect(idFiltro(undefined)).toBeNull();
  });
});

describe("opcionFiltro", () => {
  const TIPOS = ["casa", "departamento", "cabana"] as const;

  it("acepta un valor de la lista", () => {
    expect(opcionFiltro("casa", TIPOS)).toBe("casa");
  });

  it("descarta lo que no está en la lista", () => {
    // Antes se hacía `valor as TipoPropiedad`: el compilador se lo creía y
    // Prisma no, así que `?tipo=basura` devolvía un 500.
    expect(opcionFiltro("basura", TIPOS)).toBeNull();
    expect(opcionFiltro("todas", TIPOS)).toBeNull();
    expect(opcionFiltro("CASA", TIPOS)).toBeNull();   // sin coincidencia laxa
    expect(opcionFiltro(undefined, TIPOS)).toBeNull();
  });
});
