/**
 * Cliente de la API de la Base de Datos Estadísticos del Banco Central de Chile
 * (BDE), fuente oficial de la UF diaria y del IPC mensual (decisión L-08).
 *
 * Doc: https://si3.bcentral.cl/estadisticas/Principal1/Web_Services/documentacion.html
 * El REST autentica solo con `token`; el par usuario/contraseña es del SOAP.
 *
 * SEGURIDAD: el token viaja en la URL (así lo exige la API), por eso ningún
 * mensaje de error ni log de este módulo incluye la URL.
 */

/** UF diaria, en pesos. */
export const SERIE_UF = "F073.UFF.PRE.Z.D";
/** Índice IPC mensual, base 2023=100. La variación entre dos meses no depende de la base. */
export const SERIE_IPC = "F074.IPC.IND.Z.EP23.C.M";

const BASE_URL = "https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx";
const TIMEOUT_MS = 15_000;

export type Observacion = {
  /** Medianoche UTC del día informado (para IPC, el día 1 del mes). */
  fecha: Date;
  valor: number;
};

/** Función que trae una serie en un rango; inyectable para probar sin red. */
export type PedirSerie = (serie: string, desde: Date, hasta: Date) => Promise<Observacion[]>;

function aIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Convierte la respuesta del Banco Central en observaciones válidas.
 *
 * Descarta los días sin dato (`value: "NaN"`, `statusCode: "ND"`) y cualquier
 * valor que no sea un número positivo: un cero o un negativo es una lectura
 * rota, no un dato. Si la estructura no es la esperada, lanza: es preferible
 * no cargar nada a cargar algo mal interpretado, porque estos números definen
 * montos cobrados.
 */
export function parsearSerieBcch(json: unknown): Observacion[] {
  const r = json as {
    Codigo?: number;
    Series?: { Obs?: { indexDateString?: string; value?: string; statusCode?: string }[] };
  } | null;
  if (!r || r.Codigo !== 0 || !Array.isArray(r.Series?.Obs)) {
    throw new Error("Respuesta inesperada del Banco Central.");
  }
  const salida: Observacion[] = [];
  for (const o of r.Series.Obs) {
    if (o.statusCode !== "OK") continue;
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(o.indexDateString ?? "");
    const valor = Number(o.value);
    if (!m || !Number.isFinite(valor) || valor <= 0) continue;
    const fecha = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    // Date.UTC desborda en silencio ("31-02" pasa a marzo): se exige ida y vuelta.
    if (fecha.getUTCDate() !== Number(m[1]) || fecha.getUTCMonth() !== Number(m[2]) - 1) continue;
    salida.push({ fecha, valor });
  }
  return salida;
}

/** Arma el `PedirSerie` real, con el token y un `fetch` inyectable. */
export function crearPedirSerieBcch(token: string, fetchFn: typeof fetch = fetch): PedirSerie {
  return async (serie, desde, hasta) => {
    const url =
      `${BASE_URL}?token=${encodeURIComponent(token)}&function=GetSeries` +
      `&timeseries=${encodeURIComponent(serie)}&firstdate=${aIso(desde)}&lastdate=${aIso(hasta)}`;
    let res: Response;
    try {
      res = await fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch {
      // Sin el error original: su mensaje puede traer la URL con el token.
      throw new Error(`No se pudo contactar al Banco Central (${serie}).`);
    }
    if (!res.ok) throw new Error(`El Banco Central respondió ${res.status} (${serie}).`);
    return parsearSerieBcch(await res.json().catch(() => null));
  };
}
