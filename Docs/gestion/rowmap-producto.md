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
| **P-PR3** | Modelo `CuentaServicio` (tipo, número, empresa, titular, quién paga) + migración | — | G-02 ✅ | `[ ]` |
| **P-PR4** | Agregar `cuenta_servicio` al arreglo de RLS en `setup.sql` | P-PR3 | — | `[ ]` |
| **P-PR5** | Rol obligatorio en los formularios de crear y editar propiedad | P-PR2 | — | `[ ]` |
| **P-PR6** | Sub-formulario repetible de cuentas de servicio, con cada servicio declarado o marcado "no aplica" | P-PR3 | G-02 ✅, G-05 ✅ | `[ ]` |
| **P-PR7** | Incluir el Rol en el borrador PDF del contrato | P-PR1 | — | `[ ]` |
| **P-PR8** | Test de aislamiento: un tenant no ve las cuentas de otro | P-PR4 | — | `[ ]` |
| **P-PR9** | Exponer Rol y cuentas en el **portal** al arrendatario y al propietario del contrato | P-PR3 | — | `[ ]` |
| **P-PR10** | Test negativo: la ficha pública del marketplace **no** devuelve Rol ni cuentas | P-PR1, P-PR3 | — | `[ ]` |

**Restricción de privacidad que NO debe romperse.** El marketplace público arma su
consulta con un `select` explícito de campos (`marketplace/[id]/page.tsx`). El Rol
y los números de cuenta son datos fiscales y privados: **no deben agregarse nunca
a ese select**. Hoy el diseño protege por omisión — conviene dejarlo dicho para
que nadie lo "complete" por prolijidad más adelante.

**Quién ve y quién edita** (decisión del 2026-08-19). Los datos sensibles de la
propiedad —Rol y cuentas de servicio— son visibles para **corredor, propietario y
arrendatario**, y quedan fuera del alcance del público general.

| Actor | Ve | Edita | Por dónde |
|---|---|---|---|
| Manager de la corredora | ✅ | ✅ | Panel |
| Colaborador a cargo | ✅ | ✅ | Panel |
| Colaborador sin asignación | ❌ | ❌ | — |
| Propietario | ✅ | ❌ | Portal (OTP) |
| Arrendatario del contrato vigente | ✅ | ❌ | Portal (OTP) |
| Público del marketplace | ❌ | ❌ | — |

Dos cosas que esto **no** obliga a construir de cero:
- La regla de edición ya existe. `actualizarPropiedad()` valida
  "manager **o** asignado" (ADR-0013 Fase D); los campos nuevos la heredan.
- El portal ya distingue `arrendatario` y `propietario` en su acceso por OTP,
  así que P-PR9 es agregar datos a una vista existente, no un portal nuevo.

### 🎓 Rol para este grupo: Ingeniero de datos de producto

Con dos especializaciones que este grupo exige de verdad:

**Aislamiento multi-tenant sobre PostgreSQL con RLS.** El proyecto no filtra por
tenant en el ORM: lo hace la base con políticas de fila bajo un rol sin
privilegios (ADR-0011). Agregar una tabla no es agregar un modelo — es agregar un
modelo **y** su política, en una lista que se mantiene a mano. Quien no sabe eso
deja una tabla nueva visible entre corredoras y no se entera hasta que un cliente
ve datos de otro.

**Dominio inmobiliario chileno y datos personales.** El Rol de Avalúo es un
identificador fiscal público del inmueble. Los números de cuenta de servicios son
otra cosa: identifican personas y habilitan consultas sobre ellas. Con la Ley
21.719 vigente desde el 2026-12-01, dónde se guardan y a quién se muestran no es
un detalle de implementación.

**Criterios que aplica:**
- Una validación demasiado estricta que impide cargar una propiedad legítima es
  peor que un dato mal tipeado, que es barato de corregir.
- La unicidad se modela sobre la realidad, no sobre la intuición: una propiedad
  subdividida **sí** puede tener dos cuentas de luz, así que `(propiedad, tipo)`
  no puede ser único.
- El titular de una cuenta suele ser un dueño anterior que no está en el sistema:
  texto libre, no FK a `Persona`.

**Lo que este rol NO es:** no es asesoría tributaria. Si el formato del Rol tiene
casos que desconoce (ver G-01), lo dice en vez de inventar una expresión regular
con cara de autoridad.

**Cómo verifica:** además de tests de validación y formulario, el que importa es
el de **aislamiento contra Postgres real** — un tenant no ve las cuentas de otro.
Los tests unitarios mockean Prisma y por construcción no pueden probar RLS.

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

### 🎓 Rol para este grupo: Ingeniero de sistemas contables

Con especialización en **libros de eventos con partida doble** y en la **práctica
chilena de garantías de arriendo** (Ley 18.101 y su reajuste en UF al término).

**Por qué este rol y no un desarrollador de documentos.** La contabilidad ya está
resuelta y es correcta. El riesgo de este grupo no es calcular mal: es producir un
documento que **contradiga al ledger**. Un comprobante que dice una cifra distinta
a la que quedó asentada es peor que no tener comprobante, porque el arrendatario
reclama con el papel en la mano.

**Criterios que aplica:**
- El documento se **deriva** del ledger, nunca se recalcula en paralelo. Si hay
  que sumar, se suman los asientos existentes; no se vuelve a aplicar la fórmula.
- El snapshot debe **cuadrar por construcción**: recibido + reajuste − retenciones
  = devuelto. Si no cuadra, el documento no se emite.
- Cada retención lleva su causa. "Se retuvo $80.000" sin glosa es exactamente lo
  que produce una disputa.
- Una corrección de modelado que se posterga se paga con intereses: si `Voucher`
  ya guarda el destinatario equivocado en un caso, sumar un segundo caso torcido
  multiplica el costo de arreglarlo (ver G-03).

**Lo que este rol NO es:** no es auditoría ni asesoría contable certificada. Este
voucher es un **comprobante operativo** entre corredora, propietario y
arrendatario — no un documento tributario. El DTE es otra cosa y vive en el
rowMap de pagos.

**Cómo verifica:** test que arma un cierre completo con retenciones y reajuste UF,
y comprueba que el snapshot cuadra contra la suma de los asientos del ledger — no
contra una constante escrita a mano en el test.

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

### 🎓 Rol para este grupo: Ingeniero de comunicaciones transaccionales

Con especialización en **mensajería programada idempotente** y en el **diseño de
contenido de avisos sensibles** — los que llegan sin que la persona los pidiera y
hablan de plata.

**Por qué este rol.** El desafío no es enviar un correo: es que se envíe **una
sola vez**, **a tiempo**, y que se entienda. Los tres se rompen distinto.

**Criterios que aplica:**
- **Idempotencia primero.** Un cron que corre dos veces no puede avisar dos veces.
  `generarRecordatorios()` ya resuelve esto con un set de "ya notificado" por
  período; el aviso de reajuste se suma a ese mecanismo en vez de inventar otro.
- **Nunca avisar de algo que puede no ocurrir.** El aviso se emite solo para
  períodos cuyo reajuste es determinista y ya calculable. Un aviso retractado
  destruye más confianza que la que construye el aviso mismo.
- **Antes y después, siempre.** Un monto nuevo sin el anterior al lado genera
  exactamente la llamada que el aviso pretendía evitar.
- **El aviso es informativo, no un acto contractual.** El reajuste procede porque
  lo dice el contrato, no porque llegó el correo. La redacción no debe sugerir lo
  contrario.

**Lo que este rol NO es:** no define si el reajuste corresponde ni con qué
frecuencia — eso ya está en el contrato y en `@housing/core`. Tampoco es asesoría
legal sobre plazos de notificación: si el contrato o la ley exigen una antelación
específica, esa es una decisión del cliente (ver G-04).

**Cómo verifica:** correr el generador dos veces seguidas y confirmar que la
segunda no crea nada. Es la prueba que atrapa el fallo más caro de este grupo —
avisar dos veces del mismo reajuste.

---

## Preguntas de decisión

| ID | Pregunta | Sev. | Bloquea | Recomendación por defecto | Estado |
|---|---|---|---|---|---|
| **G-01** | Formato del Rol: ¿se acepta solo `NNNN-NN`, o también roles de mayor longitud y con letra que existen en algunas comunas? | 🟡 | P-PR2 | Validar `\d{1,5}-[\dkK]` (permisivo), normalizando a mayúscula. Un validador demasiado estricto bloquea propiedades legítimas, y el costo de un rol mal tipeado es bajo comparado con no poder cargar la propiedad. | **Abierta** |
| **G-02** | ¿Las cuentas de servicio son **obligatorias** también, o solo el Rol? | 🔴 | P-PR3, P-PR6 | *(recomendación no adoptada: se sugería exigirlas recién al activar)* | ✅ **Resuelta** 2026-08-19 — **obligatorias al registrar**, igual que el Rol. Decisión del cliente |
| **G-05** | "Obligatorias" no puede significar "las cuatro con número": una propiedad sin gas de red no tiene cuenta de gas. ¿Cómo se cumple la obligatoriedad sin exigir lo imposible? | 🟡 | P-PR6 | Cada servicio del set canónico (agua, luz, gas, gastos comunes) debe quedar **declarado explícitamente**: con sus datos, o marcado **"no aplica"**. Se prohíbe dejarlo en blanco. Preserva la intención —que no queden propiedades a medio cargar— sin bloquear casos legítimos. | ✅ **Resuelta** 2026-08-19 — default aplicado |
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
| 2026-08-19 | **Las cuentas de servicio son obligatorias al registrar la propiedad**, no al activarla | Decisión del cliente. Se había recomendado lo contrario (fricción en la carga inicial); el cliente prioriza que ninguna propiedad quede sin sus cuentas | Respuesta directa (G-02) |
| 2026-08-19 | "Obligatorio" = **cada servicio declarado o marcado "no aplica"**, nunca en blanco | Una propiedad sin gas de red no puede tener cuenta de gas: exigir las cuatro con número haría imposible cargar casos legítimos. Así se cumple la intención sin bloquear | Default aplicado (G-05) |
| 2026-08-19 | Rol y cuentas: **visibles** para corredor, propietario y arrendatario; **restringidos** al público | Decisión del cliente. Edita solo el corredor a cargo o el manager; propietario y arrendatario solo consultan | Respuesta directa |

## Fuera de alcance de este rowMap

- **Punto 5** (consulta de deuda de servicios): sin API de Servipag y con Ley
  21.719 entrando en vigencia el 2026-12-01. Depende de decidir el origen del
  dato. Engancha con P-PR3 cuando se retome.
- **Migración a S3**: diferida a la fase de release.
- Todo lo del sistema de cobro: vive en [rowmap-pagos.md](rowmap-pagos.md).
