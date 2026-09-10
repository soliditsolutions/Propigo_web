/**
 * Cuerpo del recordatorio de pago (L-CM7).
 *
 * El recordatorio de vencimiento tenía un texto fijo. La Ley 19.496 (Art. 28 B)
 * y la práctica de cobranza responsable piden dos cosas más:
 *   1. **decirle al arrendatario dónde pagar** — los datos de transferencia de
 *      la corredora, cuando están cargados; y
 *   2. **cerrar con "si ya pagaste, ignora este correo"** — un aviso de
 *      vencimiento no es una acusación de mora, y quien ya transfirió no debe
 *      sentir que se le está cobrando dos veces.
 *
 * Es puro: recibe los datos ya resueltos y arma el texto plano que va en el
 * cuerpo de la notificación (que el correo escapa y muestra como párrafo).
 */
import { bloqueTransferencia, type DatosCuentaBancaria } from "./cuenta-bancaria";

/** Frase de cierre del recordatorio: quien ya pagó no debe alarmarse. */
export const CIERRE_SI_YA_PAGASTE =
  "Si ya realizaste el pago, puedes ignorar este correo.";

export function construirCuerpoRecordatorio(opts: {
  fechaVencimiento: Date;
  /** Cuenta bancaria de la corredora, o null si no la ha cargado. */
  cuentaCorredora: DatosCuentaBancaria | null;
}): string {
  const fecha = opts.fechaVencimiento.toLocaleDateString("es-CL", {
    timeZone: "UTC", day: "2-digit", month: "long", year: "numeric",
  });

  const partes: string[] = [
    `El pago de tu arriendo vence el ${fecha}. Paga antes de esa fecha para no generar intereses por mora.`,
  ];

  if (opts.cuentaCorredora) {
    partes.push("", "Datos para transferir:", bloqueTransferencia(opts.cuentaCorredora));
  }

  partes.push("", CIERRE_SI_YA_PAGASTE);
  return partes.join("\n");
}
