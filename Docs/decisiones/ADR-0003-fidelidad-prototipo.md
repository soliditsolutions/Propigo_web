# ADR-0003 — Fidelidad del prototipo: dominio real, integraciones simuladas

- **Fecha**: 2026-06-03
- **Estado**: Aceptada

## Contexto
El MVP debe ser local y "cada funcionalidad simulada, pero dando certeza de lo que se quiere lograr". Si se simula **todo** (incluido el núcleo financiero), el prototipo se ve bien pero no prueba lo que diferencia a Propigo ni valida su viabilidad técnica.

## Decisión
Trazar una línea clara de fidelidad:

- **Lógica de dominio = REAL** (corre local sobre PostgreSQL): calendario de pagos, reajuste de IPC por aniversario de cada contrato, comisiones, ledger inmutable, conciliación, filtros.
- **Integraciones externas = SIMULADAS** con mocks creíbles: pasarela de pago/PAC, banco (detección de transferencias), envío de correos, feed de la UF.

## Justificación
- El valor de Propigo está en hacer **bien la lógica financiera** (fallos #1 y #7 de Leasity). Falsearla tiraría a la basura la parte difícil y la única que importa.
- Mantener el dominio real permite **demostrar de verdad** que los problemas centrales están resueltos, sin depender aún de Transbank, un banco o un proveedor de correo.
- Simular solo los **bordes externos** mantiene el MVP barato, local y rápido de iterar.

## Consecuencias
- El núcleo financiero se construye con tests desde el MVP (es código que sobrevive a producción).
- Los mocks exponen "ganchos" de demostración (ej. botón "Simular pago recibido", serie de UF de ejemplo) que luego se reemplazan por integraciones reales.
- Los correos se registran/visualizan en vez de enviarse.
