/**
 * Código de verificación de 6 dígitos — el mismo esquema que ya usaban por
 * separado el cambio de contacto del panel, el OTP del portal y la
 * verificación de dispositivo: `sha256(código + AUTH_SECRET)`, nunca en texto
 * claro. Se centraliza acá para no seguir copiando el mismo hash tres veces.
 */
import { randomInt, createHash } from "crypto";

/** Genera un código de 6 dígitos, con ceros a la izquierda si hace falta. */
export function generarCodigo(): string {
  return randomInt(100000, 1000000).toString().padStart(6, "0");
}

/** Hash del código — lo que se guarda; el código en claro nunca toca la base. */
export function hashCodigo(codigo: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(codigo + secret).digest("hex");
}
