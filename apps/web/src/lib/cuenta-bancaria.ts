/**
 * Cuenta bancaria de destino de un pago (L-DT5, L-DT6, L-DT7).
 *
 * Una fila de `CuentaBancaria` representa dos cosas según `personaId`:
 *   · nulo    → la cuenta de la propia corredora, la que va en el recordatorio
 *     de pago para que el arrendatario sepa dónde transferir.
 *   · no nulo → la cuenta de un propietario, a la que se abona la liquidación.
 *
 * Este módulo es puro: valida los datos del formulario y los formatea para
 * mostrarlos, sin tocar base. Un número de cuenta filtrado entre corredoras es
 * fraude, no una molestia — de ahí que `visibleEnPortal` sea `false` por
 * defecto y solo el corredor decida compartirla.
 */
import { validateRut } from "./rut";
import { TipoCuentaBancaria } from "@/generated/prisma/enums";

export type DatosCuentaBancaria = {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  rutTitular: string;
  email?: string | null;
};

/** Etiqueta legible del tipo de cuenta. */
export const ETIQUETA_TIPO_CUENTA: Record<string, string> = {
  corriente:  "Cuenta corriente",
  vista:      "Cuenta vista",
  ahorro:     "Cuenta de ahorro",
  cuenta_rut: "CuentaRUT",
};

/** Los tipos que acepta el enum de la base. Nada fuera de acá se guarda. */
export const TIPOS_CUENTA = Object.values(TipoCuentaBancaria) as string[];

/**
 * Deja el número listo para guardar: solo dígitos. Los bancos chilenos usan
 * guiones y espacios como adorno visual; el número real son los dígitos.
 */
export function normalizarNumeroCuenta(valor: string): string {
  return (valor ?? "").replace(/[^\d]/g, "");
}

/**
 * `null` si los datos son válidos; si no, el motivo en el idioma del corredor.
 *
 * El riesgo a cuidar acá es el inverso al de `validarRol`: una cuenta mal
 * cargada desvía plata. Por eso el RUT del titular se valida con mod-11 y el
 * número no puede quedar vacío ni ser sospechosamente corto.
 */
export function validarCuentaBancaria(datos: DatosCuentaBancaria): string | null {
  const banco = (datos.banco ?? "").trim();
  if (banco.length < 2 || banco.length > 60) {
    return "Indica el nombre del banco.";
  }

  if (!TIPOS_CUENTA.includes(datos.tipo)) {
    return "El tipo de cuenta no es válido.";
  }

  const numero = normalizarNumeroCuenta(datos.numero);
  if (!numero) {
    return "El número de cuenta es obligatorio.";
  }
  if (numero.length < 4 || numero.length > 20) {
    return "Revisa el número de cuenta: parece incompleto.";
  }

  const titular = (datos.titular ?? "").trim();
  if (titular.length < 2 || titular.length > 80) {
    return "Indica el nombre del titular de la cuenta.";
  }

  const rut = (datos.rutTitular ?? "").trim();
  if (!rut) {
    return "El RUT del titular es obligatorio.";
  }
  if (!validateRut(rut)) {
    return "El RUT del titular no es válido. Verifica el dígito verificador.";
  }

  const email = (datos.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "El correo del titular no es válido.";
  }

  return null;
}

/** Cuenta bancaria como se muestra en un documento o correo. */
export type CuentaParaMostrar = {
  banco: string;
  tipoEtiqueta: string;
  numero: string;
  titular: string;
  rutTitular: string;
};

export function cuentaParaMostrar(datos: DatosCuentaBancaria): CuentaParaMostrar {
  return {
    banco: datos.banco.trim(),
    tipoEtiqueta: ETIQUETA_TIPO_CUENTA[datos.tipo] ?? datos.tipo,
    numero: normalizarNumeroCuenta(datos.numero),
    titular: datos.titular.trim(),
    rutTitular: datos.rutTitular.trim(),
  };
}

/**
 * Bloque de texto plano con los datos de transferencia, para el cuerpo del
 * recordatorio de pago (L-CM7). Cada dato en su línea; nada de HTML.
 */
export function bloqueTransferencia(datos: DatosCuentaBancaria): string {
  const c = cuentaParaMostrar(datos);
  const lineas = [
    `Banco: ${c.banco}`,
    `Tipo: ${c.tipoEtiqueta}`,
    `N° de cuenta: ${c.numero}`,
    `Titular: ${c.titular}`,
    `RUT: ${c.rutTitular}`,
  ];
  if (datos.email?.trim()) {
    lineas.push(`Enviar comprobante a: ${datos.email.trim()}`);
  }
  return lineas.join("\n");
}
