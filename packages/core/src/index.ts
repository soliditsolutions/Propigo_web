/**
 * @propigo/core — Núcleo de dominio financiero de Propigo.
 *
 * Paquete framework-agnóstico (sin imports de Next.js ni React), extraíble como
 * servicio privado en producción (ver docs/decisiones/ADR-0002-stack-y-seguridad.md).
 *
 * Etapa 1: primitivas de dinero, UF e IPC.
 * Próximas etapas: calendario de pagos, ledger inmutable, conciliación, multa/mora.
 */

export * from "./dinero";
export * from "./uf";
export * from "./ipc";
export * from "./calendario";
export * from "./mora";
export * from "./conciliacion";
export * from "./liquidacion";
export * from "./iva";
export * from "./desahucio";
export * from "./garantia";
export * from "./rut";
export * from "./chile-geo";

/** Metadatos del paquete (útil para health-checks). */
export const CORE_VERSION = "0.1.0";
