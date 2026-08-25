# RowMap de Producto — datos de propiedad, garantía y avisos

> **Documento vivo.** Mismas convenciones que [rowmap-pagos.md](rowmap-pagos.md):
> cada fila es un entregable verificable; cada pregunta dice qué fila bloquea y
> trae recomendación por defecto; toda decisión baja a la bitácora.
>
> Existe separado del rowMap de pagos porque aquel es específicamente del sistema
> de cobro. Esto es trabajo de producto y mezclarlos haría ilegibles ambos.
>
> Origen: [revision-2026-08-19.md](revision-2026-08-19.md) — puntos 1, 2, 3 y 6.
>
> _Creado 2026-08-19._

### Estados
`[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[!]` bloqueada por decisión

---

## Grupo 1 — Datos fiscales y de servicios de la propiedad

**Objetivo:** que una propiedad quede completamente identificada para efectos de
contrato y de administración de cuentas de servicios.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-PR1** | Campo `rol` (Rol de Avalúo SII) en `Propiedad` + migración | — | — | `[ ]` |
| **P-PR2** | Validación de formato del Rol (`1234-56`), reutilizable en servidor y cliente | P-PR1 | **G-01** | `[!]` |
| **P-PR3** | Modelo `CuentaServicio` (tipo, número, empresa, titular, quién paga) + migración | — | **G-02** | `[!]` |
| **P-PR4** | Agregar `cuenta_servicio` al arreglo de RLS en `setup.sql` | P-PR3 | — | `[ ]` |
| **P-PR5** | Rol obligatorio en los formularios de crear y editar propiedad | P-PR2 | — | `[ ]` |
| **P-PR6** | Sub-formulario repetible de cuentas de servicio | P-PR3 | **G-02** | `[!]` |
| **P-PR7** | Incluir el Rol en el borrador PDF del contrato | P-PR1 | — | `[ ]` |
| **P-PR8** | Test de aislamiento: un tenant no ve las cuentas de otro | P-PR4 | — | `[ ]` |

**Restricción de privacidad que NO debe romperse.** El marketplace público arma su
consulta con un `select` explícito de campos (`marketplace/[id]/page.tsx`). El Rol
y los números de cuenta son datos fiscales y privados: **no deben agregarse nunca
a ese select**. Hoy el diseño protege por omisión — conviene dejarlo dicho para
que nadie lo "complete" por prolijidad más adelante.

---

## Grupo 2 — Documento de liquidación de garantía

**Objetivo:** que al terminar el contrato el arrendatario reciba un documento que
cuadre, no una línea de texto.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-GA1** | Valor `garantia` en el enum `TipoVoucher` | — | — | `[ ]` |
| **P-GA2** | Corregir `Voucher.arrendatarioId`: el voucher de `liquidacion` es del propietario | — | **G-03** | `[!]` |
| **P-GA3** | Generar el voucher de garantía al cerrar el contrato, con snapshot completo | P-GA1, P-GA2 | — | `[ ]` |
| **P-GA4** | Glosa con desglose en la notificación de término (hoy es una línea) | P-GA3 | — | `[ ]` |
| **P-GA5** | Tests: el snapshot cuadra (recibido + reajuste − retenciones = devuelto) | P-GA3 | — | `[ ]` |

**Lo que YA existe y no hay que rehacer:** el ledger está completo —
`GARANTIA_RECIBIDA`, `RETENCION_GARANTIA`, `DEVOLUCION_GARANTIA` y
`REAJUSTE_GARANTIA` (revaloriza a UF del día de término). Falta el documento, no
la contabilidad.

`Documento` ya tiene FK `voucherId`, así que el voucher puede colgar un PDF más
adelante sin tocar el modelo.

---

## Grupo 3 — Notificaciones de reajuste y ajustes de cobro

**Objetivo:** que un reajuste no aparezca por sorpresa en la boleta.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-NT1** | Nuevos valores en `TipoNotificacion`: reajuste, cargo adicional, rebaja | — | **G-04** | `[!]` |
| **P-NT2** | Generación **anticipada** del aviso de reajuste en `generarRecordatorios()` | P-NT1 | **G-04** | `[!]` |
| **P-NT3** | Plantilla con el antes/después del monto | P-NT2 | — | `[ ]` |
| **P-NT4** | Subir el lote de `enviarNotificacionesPendientes` (hoy `take: 50`) | — | — | `[ ]` |

**Hallazgo que define el diseño.** El reajuste IPC se aplica **dentro de
`simularPago()`** (`cobros/actions.ts:109-128`), o sea al registrar el pago.
Enganchar el aviso ahí sería inútil: llegaría junto con el cobro ya reajustado,
que es exactamente lo que se quiere evitar.

`esPeriodoDeReajuste(periodo.numero, mesesCiclo)` es determinista sobre el número
de período, así que **se puede predecir** qué período futuro traerá reajuste. Por
eso la generación va en el cron de recordatorios y no en el flujo de pago.

---

## Preguntas de decisión

| ID | Pregunta | Sev. | Bloquea | Recomendación por defecto | Estado |
|---|---|---|---|---|---|
| **G-01** | Formato del Rol: ¿se acepta solo `NNNN-NN`, o también roles de mayor longitud y con letra que existen en algunas comunas? | 🟡 | P-PR2 | Validar `\d{1,5}-[\dkK]` (permisivo), normalizando a mayúscula. Un validador demasiado estricto bloquea propiedades legítimas, y el costo de un rol mal tipeado es bajo comparado con no poder cargar la propiedad. | **Abierta** |
| **G-02** | ¿Las cuentas de servicio son **obligatorias** también, o solo el Rol? | 🔴 | P-PR3, P-PR6 | Solo el Rol obligatorio. Las cuentas, opcionales al crear y exigidas al **activar** la propiedad o al generar contrato — el corredor rara vez las tiene a mano en la carga inicial, y bloquear ahí genera propiedades que nunca se terminan de cargar. | **Abierta** |
| **G-03** | Al corregir `Voucher`: ¿se agrega `propietarioId` opcional, o se reemplaza por un `personaId` genérico con el rol del destinatario? | 🟡 | P-GA2 | `personaId` + `destinatario` (arrendatario/propietario). Un voucher siempre tiene exactamente un destinatario; dos FK opcionales invitan a que ambas queden nulas o ambas llenas. | **Abierta** |
| **G-04** | ¿Con cuánta anticipación se avisa un reajuste? | 🟡 | P-NT1, P-NT2 | 30 días antes del período reajustado, reutilizando la cadencia que ya usa `recordatorio_vencimiento`. Menos que eso no le da tiempo al arrendatario de organizarse, que es el punto del aviso. | **Abierta** |

---

## Bitácora de decisiones

| Fecha | Decisión | Razón | Origen |
|---|---|---|---|
| 2026-08-19 | "Rol" = **Rol de Avalúo del SII**, no rol de usuario | Confirmado por el usuario. Es el identificador fiscal del inmueble y lo estándar en un contrato de arriendo chileno | Respuesta directa |
| 2026-08-19 | El Rol se marca `NOT NULL` de una vez, sin backfill | Estamos en `develop` y la base se puede resetear: no hay datos productivos que migrar | Respuesta directa |
| 2026-08-19 | Las cuentas de servicio van en **tabla relacionada**, no en columnas de `Propiedad` | El set de servicios varía por propiedad, y cada cuenta necesita empresa, titular y quién paga — no solo un número | Recomendación aceptada |
| 2026-08-19 | Los tres grupos son independientes entre sí; se parte por el 1 | Es el único que toca esquema y RLS, y es prerrequisito del seguimiento de deudas | Acordado |

## Fuera de alcance de este rowMap

- **Punto 5** (consulta de deuda de servicios): sin API de Servipag y con Ley
  21.719 entrando en vigencia el 2026-12-01. Depende de decidir el origen del
  dato. Engancha con P-PR3 cuando se retome.
- **Migración a S3**: diferida a la fase de release.
- Todo lo del sistema de cobro: vive en [rowmap-pagos.md](rowmap-pagos.md).
