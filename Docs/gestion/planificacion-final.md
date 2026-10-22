# 06 — Planificación final (validada con el mercado)

> Síntesis de la investigación del mercado chileno de corretaje/arriendos (jun 2026), verificación de cobertura, oportunidades y plan de construcción priorizado.

## 1. Qué encontramos en el mercado

Competidores activos en Chile: **Ofinet, Micorredora, BReal, FairRent, KiteProp** (además de Leasity).

Funcionalidades que ya son **estándar del mercado** (paridad competitiva, "table stakes"):
- Reajuste por **IPC/UF**, **multas** e **intereses** por mora.
- **Portales para dueños y arrendatarios** y **pago de arriendo en línea**.
- **Liquidación de garantías** (mes de garantía).
- Integración con **portales de propiedades** (Portal Inmobiliario, Yapo, etc.).
- Control de **egresos y abonos** por propiedad.

## 2. Dónde nos diferenciamos de verdad

Lo que el mercado **hace mal o no automatiza** (nuestro foco):
1. **Conciliación automática con la fecha real del pago** → elimina los intereses fantasma del proceso manual (el dolor central de Leasity, confirmado por el caso real del cliente). El resto liquida manual.
2. **Asistente de liquidación** que reemplaza el proceso tedioso "entre el 5 y el 10 liquido a mano cada arriendo" → conciliar + ajustes + voucher + liquidación en pocos clics.
3. **Contabilidad inmutable y auditable** (ledger append-only) → confianza y trazabilidad que las planillas/sistemas actuales no dan.

> Conclusión: nuestros 3 diferenciadores son sólidos. Pero hay **una brecha de paridad** que debemos cerrar para competir.

## 3. Brecha detectada (table-stakes que NO teníamos)

- **Mes de garantía / depósito de garantía.** En Chile es estándar (la ley topa la garantía en **2 rentas**; se devuelve 30–60 días post entrega, con descuentos por daños). Los competidores la gestionan ("liquidación de garantías"). **Nuestro modelo no la tenía.** → Se incorpora (ver §6).

## 4. Oportunidades (diferenciadores adicionales)

| Oportunidad | Por qué | Fase sugerida |
|---|---|---|
| **Garantía gestionada y transparente** | Table-stakes + hacerlo auditable (en el ledger) y con liquidación clara al término | **MVP** |
| **Reconocimiento de deuda** (documento) | Ya pedido en el resumen ejecutivo; se genera del ledger; base para cobranza | **MVP (light)** |
| **Firma electrónica avanzada (FEA) + contrato conforme a Ley 21.461** | La ley exige 8 requisitos y permite firma online ante notario con FEA; integrarlo es un diferenciador legal real | **Fase 2** |
| **Workflow de morosidad ("Devuélveme mi casa")** | Genera la documentación del procedimiento monitorio para el dueño | **Fase 2** |
| **Sindicación a portales** (Portal Inmobiliario, Yapo) | Distribución del marketplace B2C | **Fase 2/3** |
| **Reportes tributarios anuales** para propietarios | Valor agregado de retención | **Fase 3** |

## 5. Cobertura — verificación

| Punto del mercado | Estado en Propigo |
|---|---|
| Reajuste IPC por aniversario | ✅ implementado y verificado |
| UF diaria | ✅ |
| Multas / intereses por mora | ✅ (configurable por contrato) |
| Conciliación con fecha real (sin interés fantasma) | ✅ implementado (`simularPago`, 47/47 tests) |
| Ajustes por reparaciones en la liquidación | ✅ agregado (ADR-0008) |
| Ventana de liquidación + recordatorios | ✅ implementado (cron `/api/cron/recordatorios`) |
| Gasto común passthrough | ✅ |
| Portal dueño/arrendatario | ✅ implementado (OTP end-to-end, ADR-0007) |
| Pago en línea (PAC / Pago Fácil) | ⏳ simulado en MVP, real en Fase 2 |
| **Mes de garantía** | ✅ implementado (retención/devolución en el ledger) |
| Reconocimiento de deuda | ✅ implementado (`generarReconocimientoDeuda` del ledger) |
| FEA / Ley 21.461 / morosidad | 🔜 Fase 2 |

## 6. Incorporación de la garantía (resumen de diseño)

- **Contrato**: `garantia_meses` (0–2 por ley) y `garantia_monto_clp` (monto efectivamente recibido).
- **Ledger**: tipos `GARANTIA_RECIBIDA` (entra a una bolsa de garantía, **no** es ingreso del propietario) y `DEVOLUCION_GARANTIA` / `RETENCION_GARANTIA` al término (descuentos por daños vía ajustes).
- **Vista** `v_garantia_retenida` por contrato (passthrough, separado de la billetera).
- Se detalla al implementarlo (nuevo ADR-0009 + actualización de 02/04).

## 7. Plan de construcción del MVP restante (ordenado)

1. **Migración de datos (ADR-0008 + garantía)**: `ajuste_liquidacion`, enums nuevos, config de tenant, campos de garantía. Actualizar `schema.prisma` + `setup.sql` + re-seed.
2. **Motor de dominio**: conciliación (calce exacto + fecha real + mora), cierre de liquidación (comisión + ajustes + liquidación), garantía. Con tests.
3. **Asistente de liquidación** (UI): lista de pendientes del mes → conciliar (paso 1) → cerrar con ajustes (paso 2) → genera voucher + liquidación. Es la **demo estrella**.
4. **Detalle de contrato**: calendario, ledger, garantía, documentos.
5. **Recordatorios** (cadencia ADR-0008, simulados).
6. **Portal de autoconsulta (OTP)** + documentos por URL firmada.
7. **CRUD** de propiedades y contratos (alta/edición desde la UI).
8. **Reconocimiento de deuda** (documento generado del ledger).
9. **Marketplace público** básico + pulido de UI/UX.

## 8. Backlog priorizado (MoSCoW)

- **Must (MVP):** conciliación + cierre de liquidación con ajustes, garantía, asistente de liquidación, detalle de contrato, portal OTP, recordatorios simulados.
- **Should (MVP si alcanza):** CRUD completo, reconocimiento de deuda, marketplace público básico.
- **Could (Fase 2):** FEA + Ley 21.461, workflow de morosidad, pagos reales (PAC/Pago Fácil), sindicación a portales, arriendos diarios.
- **Won't (por ahora):** días hábiles/feriados, app móvil, analítica de mercado.

_Plan original: 2026-06-04. Tabla de cobertura (§5) reconciliada con el código real el 2026-07-01._
