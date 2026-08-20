# RowMap de Pagos — filas de trabajo, preguntas y bitácora de decisiones

> **Documento vivo.** Cada fila es un entregable verificable. Cada pregunta se responde **cuando toca implementar la fila que bloquea**, no antes — y la respuesta se registra en la bitácora del final con fecha y razón.
>
> Base conceptual: [ADR-0014](../decisiones/ADR-0014-pagos-suscripciones-y-canal-de-arriendo.md) · Antecedente: [ADR-0006](../decisiones/ADR-0006-canales-de-pago.md)
>
> _Última actualización: 2026-08-19 — **Fase B0 completa**: los límites que venden los planes ya se aplican de verdad y el consumo es visible en el panel. Fase A pendiente solo de P-A6._

## Cómo se usa

- **Filas** (`P-xx`): unidad de trabajo. Se toma una, se implementa, se verifica, se marca.
- **Preguntas** (`D-xx`): decisión pendiente. Cada una dice **qué fila bloquea** y trae una **recomendación por defecto**.
- Si una pregunta bloqueante llega sin respuesta al momento de implementar su fila, **se aplica la recomendación por defecto y se registra como tal**.
- Toda decisión tomada baja a la **bitácora**. La bitácora es la fuente de verdad, no la memoria de la conversación.

### Estados
`[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[!]` bloqueada por decisión sin resolver

---

## 🔴 Hallazgo que reordena el trabajo

**Los planes venden límites que el software no aplica.**

La decisión de precios convierte "slots de propiedades" y "tokens diarios de IA" de texto de marketing en **la frontera real del producto**. Hoy:

| Límite que vende el plan | ¿Se aplica en el código? |
|---|---|
| Propiedades (10 / 25 / 75 / 200) | ❌ **No existe.** `plans.ts` solo tiene `maxUsuarios`. Nada cuenta ni limita propiedades. |
| Tokens diarios de IA (3 / 10 / 30 / alto uso) | ❌ **No existe.** No hay contador de consumo diario en ninguna parte. |
| Usuarios (1 / 3 / 10 / 20) | ✅ Sí — `getCupoUsuarios()`, ADR-0013 Fase E. |
| Analítica por tier | ✅ Sí — `getAnalyticsTier()`. |
| Exportación CSV | ⚠️ Sí, pero **hardcodeada** a `tenantPlan === "diamond"` en `proyecciones-riesgo-tab.tsx`. Los planes nuevos se la dan también a Gold. |

**No se puede cobrar precios diferenciados por límites que no se aplican.** Un cliente Bronze puede hoy cargar 500 propiedades y consumir IA sin tope. Por eso se agrega **Fase B0**, que es prerrequisito de cobrar, no una mejora posterior.

---

## Fase A — Fundación (no depende de ningún proveedor)

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-A1** | Puerto `BillingGateway`: interfaz + tipos de dominio | — | — | `[x]` |
| **P-A2** | Modelos Prisma: `SuscripcionTenant`, `CargoBilling`, `EventoGatewayPago`, `ComisionPlataforma` + migración + RLS | — | D-09 | `[x]` |
| **P-A3** | Webhook: firma, idempotencia por `eventoIdExterno`, log crudo, anti-replay | P-A2 | — | `[x]` |
| **P-A4** | **Invariantes de test** (bloquean merge) | P-A2 | — | `[x]` |
| **P-A5** | Adaptador *fake* del gateway (éxito/rechazo/timeout configurables) | P-A1 | — | `[x]` |
| **P-A6** | Panel interno de observabilidad de cobros | P-A2 | — | `[ ]` |

**Estado (2026-08-06):** 5 de 6 filas completas (P-A1 … P-A5). Solo falta **P-A6**.
432 tests (37 de billing), `tsc` y `eslint` limpios.

**Verificación en vivo del webhook** (`curl` contra el endpoint real, no mock):

| # | Escenario | Esperado | Obtenido |
|---|---|---|---|
| 1 | Sin firma | 401 | ✅ 401 `firma invalida` |
| 2 | Firma incorrecta | 401 | ✅ 401 `firma invalida` |
| 3 | Firma válida | 200 + 1 fila | ✅ 200 `procesado` |
| 4 | **Mismo evento repetido** | 200 + **sigue 1 fila** | ✅ 200 `duplicado`, `count = 1` |
| 5 | Evento de hace 48 h | 400 | ✅ 400 `evento fuera de ventana` |
| 6 | Cuerpo ilegible con firma válida | 400 | ✅ 400 `payload ilegible` |
| 7 | Cuerpo de 70 KB (tope 64 KB) | 413 | ✅ 413 `cuerpo demasiado grande` |

El caso 4 es el que importa: prueba la idempotencia contra el UNIQUE real de
Postgres, que es justo lo que el test con `prisma` mockeado **no** puede demostrar.
`procesado_en` quedó en `null` como se diseñó (recibido ≠ aplicado). Datos de
prueba eliminados después.

> **Nota de método:** los tests del webhook mockean `prisma`, así que prueban la
> máquina de decisión pero **no** que el modelo exista en el cliente generado. La
> verificación contra el endpoint real cerró esa brecha — y encontró un fallo que
> los unitarios no podían ver (ver Notas operativas).

## Fase B0 — Enforcement de límites *(nueva — prerrequisito de cobrar)*

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-B0.1** | Agregar `maxPropiedades` y `tokensDiarios` a `Plan` en `lib/plans.ts` + helpers de cupo con fallback conservador | — | N-02 ✅, N-05 ✅ | `[x]` |
| **P-B0.2** | Enforcement de propiedades: bloquear alta al alcanzar el cupo. Server-side, dentro de la transacción | P-B0.1 | — | `[x]` |
| **P-B0.3** | Contador de tokens IA diarios + enforcement con reset diario | P-B0.1 | — | `[x]` |
| **P-B0.4** | Reemplazar el `=== "diamond"` hardcodeado por `puedeExportar(plan)`, extendido a Gold | — | — | `[x]` |
| **P-B0.5** | Indicadores de consumo en el panel ("18 / 25 propiedades", "7 / 10 tokens hoy") | P-B0.2, P-B0.3 | — | `[x]` |
| **P-B0.6** | Tests de cupo | P-B0.2, P-B0.3 | — | `[x]` |

**Estado (2026-08-19): Fase B0 COMPLETA — 6 de 6 filas.**
**466 tests** (+34 desde el inicio de B0), `tsc` y `eslint` limpios.

**P-B0.5 — cómo quedó.** `CupoBadge` se extrajo del panel de Equipo a
`components/panel/ui.tsx` y ahora sirve a los tres cupos. Tiene **tres** estados,
no dos: neutro, **ámbar desde el 80 %** y rojo al tope. El ámbar es el punto del
indicador — avisar solo al llegar al límite no es avisar. Ubicaciones:

- **Propiedades** — junto a "Nueva propiedad", solo para el Manager (es quien crea
  inventario, Fase D). Al tope, el botón se deshabilita con un `title` que explica
  por qué; el muro real sigue estando en el servidor.
- **Revisiones con IA** — en el panel del Asesor IA, **antes** del selector de
  archivo. Primero quedó dentro del bloque que solo aparece tras elegir el
  documento, y se movió: ahí llegaba tarde, cuando la decisión de ir a buscar el
  archivo ya estaba tomada. La ruta `validar-doc` devuelve el consumo real tanto
  en el 200 como en el 429, así que el badge se actualiza sin recargar.

**QA de la concurrencia (la parte que los unit tests no pueden probar):** se lanzaron
**10 consumos de IA en paralelo** contra un cupo de 3, directo sobre Postgres. Resultado:
exactamente **3 otorgados**, contador final = 3, sin sobregiro. Es la evidencia de que el
`ON CONFLICT … WHERE usados < max` en una sola sentencia elimina la carrera que tendría
un "leer, comparar, escribir" en pasos separados.

## Fase B — Suscripción

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-B1** | ~~Migrar `lib/plans.ts` a UF + IVA con los valores decididos; actualizar cards y UI~~ | P-B0.1 | N-04 ✅ | `[x]` |
| **P-B1b** | *(nueva)* Tramo **Enterprise** >200 propiedades con CTA de contacto en vez de autoservicio | P-B1 | **N-01** | `[!]` |
| **P-B2** | Adaptador real del gateway elegido | P-A1, P-A5 | **D-02** | `[!]` |
| **P-B3** | Alta de suscripción: checkout, tokenización, activación | P-B1, P-B2 | D-08 | `[ ]` |
| **P-B4** | Cobro recurrente: ciclo, renovación, **conversión UF→CLP**, reloj inyectable | P-B3 | **N-03** | `[!]` |
| **P-B5** | Dunning: notificación de mora → 10 días de gracia → suspensión | P-B4 | — | `[ ]` |
| **P-B6** | Cambio de plan: upgrade inmediato con prorrateo / downgrade agendado a fin de período | P-B4 | — | `[ ]` |
| **P-B7** | Gate de downgrade: verificar que el tenant cumple los límites del plan destino (usuarios **y** propiedades) antes de permitir el cambio | P-B6, P-B0.2 | — | `[ ]` |
| **P-B8** | `Tenant.plan` derivado de la suscripción activa | P-B3 | D-09 | `[ ]` |
| **P-B9** | Emisión de DTE por cada cobro + envío por correo | P-B4 | **D-07** | `[!]` |

## Fase C — Devoluciones

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-C1** | Reescribir política de retracto: condiciones objetivas + reencuadre como garantía comercial | — | **D-06**, D-15 | `[!]` |
| **P-C2** | Motor de elegibilidad contra datos reales | P-C1, P-B4 | D-15 | `[ ]` |
| **P-C3** | Ejecución del reembolso + cola de revisión manual | P-C2 | — | `[ ]` |
| **P-C4** | Anti-abuso: un retracto por tenant, detección por RUT | P-C3 | — | `[ ]` |

## Fase D — Canal de pago del arriendo

> No arranca hasta que **Fase B esté probada en producción**.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-D1** | Cuenta bancaria del corredor: carga, verificación de titularidad, confirmación en 2 pasos | Fase B en prod | **D-03** | `[!]` |
| **P-D2** | Adaptador del proveedor A2A | P-D1 | **D-03** | `[!]` |
| **P-D3** | Mandato del arrendatario desde el Portal | P-D2 | D-11 | `[ ]` |
| **P-D4** | Webhook → `PagoEntrante(canal=PAC, origen="gateway")` + conciliación con calce exacto | P-D3, P-A3 | — | `[ ]` |
| **P-D5** | Devengo de `ComisionPlataforma` por pago conciliado | P-D4 | **D-04**, D-12 | `[!]` |

## Fase E — Facturación de comisiones

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-E1** | Cierre mensual: consolidar comisiones en un `CargoBilling` | P-D5 | D-12 | `[ ]` |
| **P-E2** | Cobro consolidado (suscripción + comisiones, o solo comisiones si el plan es anual) | P-E1, P-B4 | — | `[ ]` |
| **P-E3** | Suspensión del canal por impago — sin cortar mandatos vigentes | P-E2 | D-16 | `[ ]` |

## Fase F — Piloto y salida a producción

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **P-F1** | Runbook de incidentes | — | — | `[ ]` |
| **P-F2** | Piloto controlado con conciliación manual diaria | P-F1, Fase E | D-17 | `[ ]` |
| **P-F3** | Criterio de salida cumplido → apertura general | P-F2 | D-17 | `[ ]` |

---

## Planes decididos (ronda 1)

| Plan | Propiedades | Usuarios | Tokens IA/día | Mensual | Anual | Analítica |
|---|---|---|---|---|---|---|
| Bronze | 10 | 1 | 3 | 0,25 UF + IVA | 2,5 UF + IVA | Básica |
| Silver | 25 | 3 | 10 | 0,50 UF + IVA | 5 UF + IVA | Intermedia |
| Gold ★ | 75 | 10 | 30 | 0,90 UF + IVA | 9 UF + IVA | Avanzada |
| Diamond | 200 | 20 | **⚠️ sin definir** | 1,70 UF + IVA | 17 UF + IVA | Premium |

**Delta contra el código actual** (`lib/plans.ts`): Bronze 7→10 props · Silver 20→25 props, 2→3 usuarios, 7→10 tokens · Gold 50→75 props, 5→10 usuarios, 25→30 tokens · Diamond 10→20 usuarios, "ilimitado"→"alto uso". Todos los cambios son **aumentos**, así que ningún cliente existente pierde capacidad al migrar.

### Verificación del posicionamiento competitivo

La tesis comercial ("50 % más barato que Leasity en el tramo alto") **se sostiene con los números**:

| Tramo | Leasity | Housing | Ahorro |
|---|---|---|---|
| 200 propiedades / mes | 3,5 UF | 1,70 UF | **51,4 %** |
| 200 propiedades / año | 33,6 UF (con su 20 % anual) | 17 UF | **49,4 %** |
| UF por propiedad (tope) | 0,0175 | 0,0085 | **51 %** |

Housing queda más barato por propiedad **en todos los tramos**, no solo en el alto.

> **Matiz honesto:** "2 meses gratis" en el anual equivale a **16,7 %** de descuento, mientras Leasity ofrece **20 %**. El precio final sigue siendo ~50 % menor, pero *el descuento anual de Housing es menos generoso que el de Leasity*. No conviene usar "mejor descuento anual" como argumento de venta; el argumento fuerte es el precio absoluto.

---

## Preguntas asociadas

**Impacto:** 🔴 estructural · 🟡 táctico · 🟢 ajuste

### Resueltas en esta ronda → ver bitácora
D-01 (precios) · D-05 (downgrade) · D-07 (DTE, dirección) · D-10 (mora) · D-13 (reembolso prorrateado) · D-14 (moneda comisión)

### Abiertas

| ID | Pregunta | Impacto | Bloquea | Recomendación por defecto | Estado |
|---|---|---|---|---|---|
| **N-01** | **Contradicción con la estrategia:** se apunta a agencias de "150-200 o **1000** propiedades", pero Diamond topa en **200**. Una agencia de 500 no tiene plan que contratar. ¿Se crea un tramo Enterprise? **El análisis de costos (2026-08-19) refuerza que conviene: el costo marginal de un tenant grande es de centavos, así que un Enterprise es margen casi puro.** | 🔴 | P-B1b | Agregar **Enterprise: >200 props, precio a convenir**, con CTA de contacto en vez de autoservicio. Sin esto, el segmento que financia la estrategia no puede comprar. | **Abierta** |
| **N-02** | Diamond dice "IA de alto uso". El sistema necesita **un número** para aplicar el límite. ¿Cuántos tokens diarios? | 🔴 | P-B0.1, P-B0.3 | 100/día. "Ilimitado" real es un riesgo de costo abierto contra la API de IA; "alto uso" sin número no es implementable ni defendible ante un reclamo. | **Abierta** |
| **N-03** | Precio en UF, cobro en CLP: ¿con qué valor de UF se convierte? ¿Y si la fuente de UF falla el día del cobro? | 🔴 | P-B4 | UF del **día de emisión del cargo**, congelada en el `CargoBilling` y visible en el DTE. Si la fuente falla: **no cobrar** y reintentar al día siguiente (nunca cobrar con un valor estimado). | **Abierta** |
| **N-04** | IVA: ¿19 % como constante configurable? ¿La UI muestra neto, bruto o ambos? | 🟡 | P-B1 | Constante única `IVA_PCT`. UI muestra **neto + "+ IVA"**; el total bruto en CLP va en el checkout. | ✅ **Resuelta** 2026-08-06 — quedó como `IVA_PCT = 19` en `lib/plans.ts` (no en `@housing/core`: la tabla de planes ya vive ahí y separarlos obligaba a importar dos módulos para calcular un precio) |
| **N-05** | El límite de propiedades, ¿cuenta todas o solo las activas? (borrador / disponible / arrendada / pausada) | 🟡 | P-B0.1, P-B0.2 | Todas menos las eliminadas — coherente con el tooltip ya publicado ("cuentan las disponibles, las arrendadas y las en pausa"). | **Abierta** |
| **N-06** | Gold promete "**Roles y permisos de usuarios**" y Diamond "avanzados", pero ADR-0013 implementó **exactamente 2 roles fijos** (manager/colaborador) sin permisos configurables. ¿Se construye la feature o se corrige la card? | 🔴 | P-B1 | Corregir la card a "Roles Manager y Colaborador" (lo que existe). Vender permisos configurables sin tenerlos es una promesa incumplible al primer cliente Gold. | **Abierta** |
| **N-07** | "Soporte prioritario" (Gold/Diamond) vs "estándar": ¿qué SLA concreto? | 🟡 | P-B1 | Definir tiempos de respuesta reales y alcanzables antes de publicarlo. Sin capacidad detrás, genera reclamos. | **Abierta** |
| **N-08** | Diamond incluye migración asistida, onboarding personalizado y capacitación. Son **servicios humanos**, no software. ¿Quién los entrega y con qué capacidad? | 🟡 | P-B1 | Definir alcance y límite (p. ej. "hasta X horas") antes de venderlo. | **Abierta** |
| **D-02** | ¿Proveedor de suscripción: Flow, Transbank directo, u otro? | 🔴 | P-B2 | Flow al arranque, migrable por el puerto `BillingGateway` (P-A1). | **Abierta — planteada y pospuesta explícitamente el 2026-08-19.** Datos levantados para retomarla abajo |
| **D-03** | ¿Proveedor A2A: Fintoc o Khipu? ¿Tarifa negociada? | 🔴 | P-D1, P-D2 | Cotizar ambos; exigir tarifa plana por volumen. Verificar inscripción CMF. | Abierta |
| **D-04** | ¿Monto de la comisión por pago procesado? ¿Quién absorbe el riel? | 🔴 | P-D5 | Tarifa plana $2.000–3.000 CLP; Housing absorbe el riel. | Abierta |
| **D-06** | ¿Revisión legal del texto de retracto antes del cobro real? | 🔴 | P-C1 | Sí. Reencuadrar como garantía comercial voluntaria. | Abierta |
| **D-07b** | DTE: dirección decidida (proveedor externo vía API). Falta **elegir cuál**. | 🟡 | P-B9 | Comparar Haulmer/OpenFactura vs Bsale por precio y calidad de API. | Abierta |
| **D-08** | ¿Período de prueba gratuito? | 🟡 | P-B3 | Sin trial: la garantía de 10 días ya cumple esa función. | Abierta |
| **D-09** | ¿Qué pasa con los tenants en plan `"Gratuito"` al activar billing? | 🟡 | P-A2, P-B8 | Grandfathering con cupo Bronze hasta migración voluntaria. | Abierta |
| **D-11** | ¿El arrendatario puede pagar puntualmente sin mandato recurrente? | 🟡 | P-D3 | Sí, ambos caminos. | Abierta |
| **D-12** | ¿Comisión por **pago conciliado** o por **contrato activo**? | 🔴 | P-D5, P-E1 | Por pago conciliado. | Abierta |
| **D-15** | Condiciones objetivas exactas del retracto | 🟡 | P-C1, P-C2 | Cero contratos generados **y** cero pagos procesados **y** < 20 % de tokens del período. | Abierta |
| **D-16** | Impago de comisiones: ¿se cortan solo cobros nuevos o también mandatos vigentes? | 🟡 | P-E3 | Solo cobros nuevos. | Abierta |
| **D-17** | Criterio de salida del piloto | 🟡 | P-F2, P-F3 | Cero descalces en 30 días con ≥10 pagos reales. | Abierta |

### Qué se puede implementar hoy sin ninguna respuesta

**Fase A completa** (P-A1 … P-A6) y **P-B0.2, P-B0.4, P-B0.5, P-B0.6** una vez definidos N-02 y N-05.

---

### Anexo D-02 — comparativo de pasarelas (levantado 2026-08-19)

| Proveedor | Comisión | Suscripciones | Observación |
|---|---|---|---|
| **Flow** | 2,89 % + IVA | ✅ Motor nativo | Recurrencia, reintentos y tokenización ya resueltos. Abono en 3 días hábiles |
| **Transbank Oneclick** | 2,35 % + IVA | ⚠️ Solo tokeniza | El ciclo de cobro, reintentos y mora los construimos nosotros. Exige Webpay Plus previo + certificación |
| **Mercado Pago** | Mayor | ✅ Sí | Además hace *split* (`application_fee`), útil para el canal de arriendo de Fase C |
| **Fintoc** | Variable | ✅ Desde abr-2026 | Tarjeta y **PAC**; el PAC esquiva la comisión de tarjeta. Proveedor más nuevo |

**Cuánto cuesta la diferencia Flow vs Transbank** (0,54 pp, IVA incluido sobre la comisión):

| Escala | Flow | Transbank | Diferencia/mes | Al año |
|---|---:|---:|---:|---:|
| 25 tenants | $21 | $17 | $4 | $47 |
| 250 tenants | $209 | $170 | **$39** | $469 |
| 1000 tenants | $837 | $681 | **$156** | $1.877 |

**Lectura:** a 250 tenants la diferencia ($39/mes) es menor que el balanceador de
carga del escenario óptimo. Recién cerca de los 1000 tenants ($1.877/año) empieza
a justificar el costo de ingeniería de integrar Transbank directo — y para
entonces el puerto `BillingGateway` ya permite cambiar sin reescribir la app.
Nota: Fase B (suscripciones) y Fase C (canal de arriendo) probablemente requieran
proveedores distintos de todas formas, porque el *split* de pagos no lo resuelven
todos.

## Bitácora de decisiones

| Fecha | ID | Decisión | Razón | Origen |
|---|---|---|---|---|
| 2026-08-06 | — | Housing nunca recibe el dinero del arriendo | Evita actividad regulada (Ley 21.521 / 20.950), elimina float y aísla el tratamiento tributario | ADR-0014 |
| 2026-08-06 | — | Ledger de billing separado del ledger de contratos | Imputar la comisión de Housing en `AsientoLedger` corrompería la liquidación del propietario | ADR-0014 |
| 2026-08-06 | — | Integración de pasarela detrás de un puerto propio | Permite construir Fase A sin decidir proveedor | ADR-0014 |
| 2026-08-06 | **D-01** | **Precios en UF + IVA**: Bronze 0,25 · Silver 0,50 · Gold 0,90 · Diamond 1,70 (mensual); ×10 en anual (2 meses gratis). Cupos 10/25/75/200 propiedades, 1/3/10/20 usuarios | Posicionamiento ~50 % bajo Leasity en el tramo alto para captar agencias consolidadas por ahorro, apostando a volumen. La UF resuelve además la indexación sin alzas explícitas | Negocio |
| 2026-08-06 | **D-01b** | Se agrega tramo intermedio de **75** propiedades (Gold) | El salto 50→200 dejaba sin plan adecuado a las agencias medianas | Negocio |
| 2026-08-06 | **D-05** | **Downgrade agendado y condicionado**: el tenant debe primero cumplir los límites del plan destino (usuarios y propiedades); recién ahí puede agendar el cambio, que se hace efectivo **al terminar el período pagado**, sin devoluciones | Evita borrado automático de datos y traslada la elección al Manager, que es quien puede decidirla | Negocio |
| 2026-08-06 | **D-10** | **10 días corridos de gracia** desde la *notificación* de mora (no desde el cargo fallido) antes de suspender | Leasity da 7; 10 diferencia sin costo relevante | Negocio |
| 2026-08-06 | **D-13** | Sin reembolsos prorrateados fuera de la ventana de retracto | Coherente con la política de cancelación ya publicada | Negocio (implícito en D-05) |
| 2026-08-06 | **D-14** | Suscripción en UF; comisión de plataforma en CLP fijo | La UF es idiomática para recurrencia; la comisión fija es más simple de comunicar | Negocio + ADR-0014 |
| 2026-08-06 | **D-07** | DTE vía **proveedor externo con API**, no integración directa al SII. Requisitos: emitir automáticamente, consultar estado, obtener PDF/XML y enviar por correo | Menor costo y riesgo que integrar el SII directamente | Negocio |
| 2026-08-06 | — | Las migraciones se generan con `prisma migrate diff` y se aplican con `psql -U housing`, **no** con `migrate dev` ni `db execute` | `DATABASE_URL` usa el rol de runtime `housing_app`, que no puede crear la shadow database ni hacer DDL. Es correcto que sea así (ADR-0011). Ver "Notas operativas" al final | Hallazgo al implementar P-A2 |
| 2026-08-06 | **N-02** | Diamond = **100 tokens diarios** de IA | "IA de alto uso" no es implementable: el sistema necesita un número para aplicarlo. "Ilimitado" sería un costo abierto contra la API de IA. Aplicada como recomendación por defecto del rowMap | Default del rowMap |
| 2026-08-06 | **N-05** | El cupo de propiedades cuenta **todos los estados** (borrador, disponible, reservada, arrendada) | Coherente con el tooltip ya publicado: "cuentan las disponibles, las arrendadas y las en pausa" | Default del rowMap |
| 2026-08-06 | **N-04** | IVA como constante única `IVA_PCT = 19` en `lib/plans.ts`; la UI muestra neto + "+ IVA" | Una sola fuente para la tasa; el DTE necesita neto e IVA por separado (D-07) | Default del rowMap |
| 2026-08-06 | **N-06** | Se **quita** "Roles y permisos de usuarios" de las cards | El sistema tiene exactamente 2 roles fijos (Manager/Colaborador, ADR-0013), sin permisos configurables. Vender la capacidad se cae con el primer cliente Gold que la busque | Corrección de H-06 |
| 2026-08-06 | — | El cupo de IA **no** aplica al escaneo de cédula del registro | Ese flujo ocurre antes de que exista el tenant, así que no hay plan contra el cual descontar. El tooltip publicado ya define el token como "una revisión de contrato con IA" | Hallazgo al implementar B0.3 |
| 2026-08-19 | — | El indicador de cupo avisa en **ámbar desde el 80 %**, no solo en rojo al tope | Un indicador que solo se enciende cuando ya no se puede hacer nada no es un aviso. El ámbar deja margen para subir de plan o liberar cupo mientras todavía se puede decidir | Decisión de diseño en P-B0.5 |
| 2026-08-19 | — | Par de tokens `--hw-accent-teal-btn` / `--hw-on-accent-teal` para el botón sólido teal | El acento suelto no sirve de fondo de botón: blanco sobre `#5EEAD4` da **1,48:1** (AA pide 4,5:1) y el texto se veía literalmente invisible. Se corrigió sin tocar `--hw-accent-teal`, que en gradientes y auroras sí funciona | Fallo preexistente detectado en el QA de P-B0.5 |

---

## Hallazgos abiertos

| ID | Hallazgo | Dónde | Estado |
|---|---|---|---|
| **H-01** | Política de retracto promete "100 %" invocando la Ley 19.496 (aplicabilidad B2B discutible) y condiciona con un criterio subjetivo indefendible | `PlanesStop.tsx` | **Abierto** — corregir antes del primer cobro real |
| **H-02** | ~~Precios en USD incompatibles con pasarelas chilenas~~ | `lib/plans.ts` | ✅ **Resuelto** — migrado a UF + IVA |
| **H-03** | `Tenant.plan` string libre; preservar el fallback conservador a Bronze al introducir billing | `plans.ts`, `plan-tier.ts` | Abierto |
| **H-04** | ~~Los límites de propiedades y tokens IA que venden los planes no existen en el código~~ | `lib/plans.ts`, ruta de IA, alta de propiedades | ✅ **Resuelto** — `lib/plan-limits.ts` + enforcement server-side, verificado con prueba de concurrencia |
| **H-05** | ~~Exportación CSV hardcodeada a `=== "diamond"`~~ | `proyecciones-riesgo-tab.tsx`, API de exportar | ✅ **Resuelto** — helper `puedeExportar(plan)` en ambos lados (UI y API) |
| **H-06** | Las cards prometían features inexistentes | `lib/plans.ts` | ⚠️ **Parcial** — se quitó "Roles y permisos" (N-06). Siguen abiertos **N-07** (SLA de "soporte prioritario") y **N-08** (alcance de migración/onboarding/capacitación de Diamond): son compromisos operativos, no de software |
| **H-07** | ~~Botón "Analizar documento subido": texto blanco sobre teal, ilegible~~ | `validacion-panel.tsx`, `globals.css` | ✅ **Resuelto** — preexistente, no introducido por B0. Oscuro 1,48:1 → **10,3:1**; claro 3,74:1 → **5,47:1**. Ambos temas pasan AA, medido en el navegador |
| **H-08** | `DeprecationWarning` de `pg` al cargar rutas del panel | `@prisma/adapter-pg` (upstream) | ✅ **Diagnosticado — no es código nuestro.** Stack capturado con `--trace-warnings`: `PgTransaction.performIO` ← `interpretNode` ← `Array.map`. Es el intérprete de Prisma lanzando las relaciones de un `include` **en paralelo sobre la única conexión** que sostiene una transacción interactiva. Upstream [#29407](https://github.com/prisma/prisma/issues/29407) y [#29646](https://github.com/prisma/prisma/issues/29646) (este último es exactamente adapter-pg 7.8.0, nuestra versión), **abiertos**. Hoy es cosmético; sería error en `pg@9`, pero `pg: ^8.21.0` no salta de major solo, así que no hay exposición. **No corresponde arreglo en la app**: evitarlo exigiría eliminar los `include` anidados |

---

## Notas operativas

### Cómo crear una migración en este proyecto

`prisma migrate dev` **no funciona**: `DATABASE_URL` apunta al rol de runtime
`housing_app`, que por diseño (ADR-0011) no es dueño ni superusuario, así que no
puede crear la shadow database ni ejecutar DDL. Eso es correcto — es justamente
lo que hace que RLS restrinja de verdad. El procedimiento es:

```bash
# 1. Generar el SQL comparando la base viva contra el schema
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script \
  > prisma/migrations/<timestamp>_<nombre>/migration.sql

# 2. Aplicarlo con el rol dueño
docker exec -i housing-db psql -U housing -d housing -v ON_ERROR_STOP=1 \
  < prisma/migrations/<timestamp>_<nombre>/migration.sql

# 3. Registrarla en el historial de Prisma
npx prisma migrate resolve --applied <timestamp>_<nombre>

# 4. Reaplicar setup.sql (RLS de las tablas nuevas, índices parciales)
docker exec -i housing-db psql -U housing -d housing < prisma/sql/setup.sql

# 5. Verificar que no quedó drift
npx prisma migrate status
```

> **Cuidado con el paso 3.** `migrate resolve --applied` marca la migración como
> aplicada aunque el SQL no se haya ejecutado. Si el paso 2 falla y se corre el 3
> igual, el historial queda mintiendo. Verificar siempre con `migrate status` y
> con un `\dt` de las tablas esperadas.

### Tras `prisma generate`, hay que reiniciar el dev server

El proceso `next dev` mantiene en memoria el cliente Prisma con el que arrancó.
Si se agregan modelos y se regenera el cliente **sin reiniciarlo**, el código
compila, los tipos resuelven y los tests con `prisma` mockeado pasan — pero en
runtime `prisma.<modeloNuevo>` es `undefined` y el endpoint responde 500.

Se detectó exactamente así al verificar el webhook en vivo (P-A3): 37 tests en
verde y el `curl` devolviendo `TypeError: Cannot read properties of undefined
(reading 'create')`. Es el mismo patrón de proceso obsoleto ya conocido con el
pool de conexiones tras reiniciar el contenedor de la base.

**Regla:** después de tocar `schema.prisma` + `prisma generate`, reiniciar el dev
server antes de dar por buena cualquier prueba de runtime.

### El RLS no es automático

El array de tablas en `setup.sql` (sección 3) es **explícito**. Toda tabla nueva
con `tenant_id` hay que agregarla a mano; si se olvida, la tabla queda sin
aislamiento entre tenants y nada avisa. El invariante 7 de
`src/lib/billing/__tests__/invariantes.test.ts` cubre este caso para las tablas
de billing.

Los **permisos** sí son automáticos: `alter default privileges` en setup.sql ya
otorga CRUD a `housing_app` sobre toda tabla que cree el rol `housing`.
