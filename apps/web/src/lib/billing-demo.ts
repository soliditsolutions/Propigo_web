/**
 * Datos de ejemplo para "Mi Plan" (panel/perfil).
 *
 * No hay pasarela de pago conectada todavía (ver ADR-0014 — el adaptador real
 * de gateway y el checkout siguen sin implementar, `Tenant.plan` se sigue
 * editando a mano). Esta sección le pidió al usuario mostrar el historial de
 * pagos, el método de cobro y las boletas igual, a modo de vista previa de
 * cómo se verá el producto terminado — así que se generan de forma
 * determinística (mismo tenant + mismo plan ⇒ mismos montos) en vez de al
 * azar, para que la lista de la UI y el PDF de cada boleta siempre calcen.
 *
 * El monto de cada período SÍ es real en el sentido de que sale de
 * `desglosarPrecioClp()` con el precio real del plan — lo único inventado es
 * que ese cobro haya ocurrido de verdad.
 */
import { desglosarPrecioClp, type Plan } from "./plans";

export type PeriodoDemo = {
  /** Clave estable para la URL del PDF — ej. "2026-08". */
  clave: string;
  /** Cómo se muestra — ej. "Agosto 2026". */
  label: string;
  fecha: Date;
  montoUf: number;
  netoClp: number;
  ivaClp: number;
  totalClp: number;
  valorUfClp: number;
};

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/**
 * Últimos `cantidad` períodos mensuales, el más reciente primero.
 *
 * `obtenerValorUf` se inyecta (en vez de importar `getUfCLP` acá adentro)
 * para que este módulo siga siendo puro y se pueda probar sin tocar la base.
 */
export async function periodosDemo(
  plan: Plan,
  cantidad: number,
  obtenerValorUf: (fecha: Date) => Promise<number>,
  hoy: Date = new Date(),
): Promise<PeriodoDemo[]> {
  const periodos: PeriodoDemo[] = [];
  for (let i = 0; i < cantidad; i++) {
    const fecha = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 5));
    const valorUfClp = await obtenerValorUf(fecha);
    const { netoClp, ivaClp, totalClp } = desglosarPrecioClp(plan.mensualUf, valorUfClp);
    periodos.push({
      clave: `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`,
      label: `${MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`,
      fecha, montoUf: plan.mensualUf, netoClp, ivaClp, totalClp, valorUfClp,
    });
  }
  return periodos;
}

/** Un único período por su clave (para regenerar el PDF de una fila puntual). */
export async function periodoDemoPorClave(
  plan: Plan,
  clave: string,
  obtenerValorUf: (fecha: Date) => Promise<number>,
): Promise<PeriodoDemo | null> {
  const m = /^(\d{4})-(\d{2})$/.exec(clave);
  if (!m) return null;
  const fecha = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 5));
  if (Number.isNaN(fecha.getTime())) return null;
  const valorUfClp = await obtenerValorUf(fecha);
  const { netoClp, ivaClp, totalClp } = desglosarPrecioClp(plan.mensualUf, valorUfClp);
  return {
    clave, label: `${MESES[fecha.getUTCMonth()]} ${fecha.getUTCFullYear()}`,
    fecha, montoUf: plan.mensualUf, netoClp, ivaClp, totalClp, valorUfClp,
  };
}

/**
 * Día de facturación de ejemplo — se ancla al día de creación del tenant
 * (dato real) en vez de un número fijo, así cada cuenta ve un día distinto
 * y no todas "coinciden" de forma sospechosa.
 */
export function diaFacturacionDemo(tenantCreatedAt: Date): number {
  return tenantCreatedAt.getUTCDate();
}
