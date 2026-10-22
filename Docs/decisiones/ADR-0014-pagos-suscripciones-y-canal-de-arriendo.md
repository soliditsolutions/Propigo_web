# ADR-0014 — Pagos: suscripciones, devoluciones y canal de pago de arriendo

- **Fecha**: 2026-08-06
- **Estado**: Propuesta (requiere validación comercial y legal antes de implementar)
- **Reemplaza / extiende**: complementa [ADR-0006](ADR-0006-canales-de-pago.md) (canales de pago del arriendo). No lo contradice: ADR-0006 ya definió PAC como canal confiable con conciliación automática; este ADR define **quién lo provee, cómo se cobra la comisión de Propigo y cómo se cobra la suscripción**.

## Contexto

Se solicita habilitar tres capacidades de pago:

1. Cobro automático de la suscripción (mensual/anual) a tarjeta de crédito.
2. Devoluciones automáticas (retracto legal / período de prueba).
3. Que Propigo sea canal para el pago del arriendo, **cobrando solo su comisión a fin de mes al corredor**, y que el arriendo llegue **directo al corredor**.

Hoy no existe nada de billing en el código: `Tenant.plan` es un `String?` libre, todo signup nuevo recibe `"Gratuito"`, y `PagoEntrante.origen` vale `"simulado"`. Los cuatro planes viven en `lib/plans.ts` con precios **en USD** ($5 / $12 / $25 / $50 mensual).

---

## Parte 0 — Tres decisiones estructurales

Antes del detalle, las tres decisiones que condicionan todo lo demás.

### D1. El dinero del arriendo NUNCA pasa por Propigo

La instrucción del negocio ("que el pago del arriendo llegue directo al corredor") no es solo una preferencia operativa: **es la decisión de arquitectura correcta y hay que blindarla**, porque evita tres problemas graves de golpe:

- **Regulatorio.** Recaudar dinero de terceros y liquidarlo después es actividad regulada. La Ley 21.521 (Fintec) creó el Registro de Prestadores de Servicios Financieros de la CMF, y la Ley 20.950 + normativa CMF regulan la "recaudación de pagos por cuenta de terceros" como actividad complementaria de operadores de tarjetas, exigiendo entre otras cosas **fondos segregados**. Si Propigo recibe el arriendo en su cuenta, entra en ese terreno. Si el pago va directo del arrendatario al corredor y Propigo solo **inicia y observa**, Propigo es cliente de un iniciador de pagos registrado (Fintoc/Khipu) y opera **bajo la licencia de ese proveedor**, no bajo una propia.
- **Financiero.** Sin float no hay riesgo de insolvencia, ni de que una caída de Propigo congele arriendos de terceros, ni necesidad de capital de trabajo o seguros.
- **Tributario.** El arriendo habitacional y su tratamiento de IVA quedan enteramente en la esfera corredor↔propietario. Propigo solo factura su comisión (servicio afecto a IVA). Sin este diseño, Propigo tendría que justificar por qué recibe dinero que no es ingreso suyo.

> **Consecuencia dura:** cualquier propuesta futura de "retener el arriendo unos días", "pagar al propietario nosotros" o "adelantar el arriendo" **cambia el régimen regulatorio del producto** y no puede tratarse como una mejora incremental. Debe volver a este ADR.

### D2. Dos contabilidades separadas, nunca mezcladas

Ya existe en el ledger `TipoAsiento.COMISION_CORREDOR` y `Contrato.comisionCorredorPct`: es la comisión que **el corredor** le cobra **al propietario** por administrar. La comisión de Propigo es otra cosa completamente distinta.

| | Ledger de contrato (existe) | Ledger de billing (nuevo) |
|---|---|---|
| Partes | arrendatario ↔ propietario ↔ corredor | Propigo ↔ tenant (corredor) |
| Modelos | `AsientoLedger`, `PagoEntrante` | `SuscripcionTenant`, `ComisionPlataforma`, `CargoBilling` |
| Qué mide | quién le debe qué a quién en el arriendo | qué le debe el corredor a Propigo |

**Nunca** se debe imputar la comisión de Propigo como asiento del contrato. Si entrara ahí, contaminaría la liquidación del propietario y las vistas financieras (`v_gasto_comun_recaudado`, billetera del propietario, estadísticas). Es el error más caro posible en este dominio y hay que prevenirlo con un test de invariante, no con disciplina.

### D3. Los precios deben migrar de USD a CLP (idealmente indexados a UF)

**Este es un bloqueador real del punto 1, no un detalle.** Transbank, Flow, Khipu y Fintoc liquidan en **CLP**. Los planes están hoy en USD. Eso obliga a decidir:

- ¿A qué tipo de cambio se cobra? ¿Quién absorbe la variación mes a mes?
- Un plan "USD $5" cobrado en CLP cambia de precio todos los meses sin que el corredor haya aceptado un alza. Eso es fricción comercial y expone a reclamos.

**Recomendación:** precios en **CLP**, con opción de indexar a **UF** para el plan anual. Propigo ya tiene motor de UF e IPC funcionando (usado en garantías y proyecciones) — se reutiliza en vez de construir algo nuevo. La UF es el estándar idiomático chileno para contratos recurrentes y resuelve la inflación sin necesidad de "subir precios" explícitamente.

**Alerta de rentabilidad:** el plan Bronze a USD $5 ≈ CLP $4.700. Con comisión de pasarela (~3% + IVA + costo fijo por transacción), el costo de cobrar puede llevarse un porcentaje muy alto de ese ticket. Hay que validar que Bronze sea rentable, o convertirlo en plan anual-only (un cobro de $50 al año tiene mucho mejor relación costo/ingreso que doce de $5).

---

## Parte 1 — Suscripciones recurrentes

### Comparativa de proveedores

| | Transbank Oneclick Mall | Flow.cl | Mercado Pago | Fintoc Pagos Recurrentes |
|---|---|---|---|---|
| Modelo | Tokeniza tarjeta, tú disparas cada cobro | Motor de suscripciones completo | Preapproval | Tarjeta **y PAC** |
| Motor de planes/reintentos | ✗ (lo construyes tú) | ✓ (planes, trials, cupones, reintentos) | ✓ | ✓ (reintentos + comunicación) |
| Costo | El más bajo (directo) | ~2,89–3,19 % + IVA | ~3,5 % | A confirmar |
| Fricción de alta | Alta (contrato Transbank) | Baja | Baja | Media |
| Split marketplace | Webpay Mall | — | ✓ `application_fee` | — |

**Recomendación: Flow.cl para el arranque, con la integración aislada tras una interfaz propia.**

Razón: Flow trae el motor de suscripciones ya hecho (planes, períodos de prueba, reintentos, cupones). Construir dunning, reintentos y ciclos de facturación sobre Oneclick es varias semanas de trabajo delicado y con dinero real de por medio. El sobrecosto de Flow frente a Transbank directo (~0,3–0,5 puntos) es barato comparado con ese esfuerzo y su riesgo. Cuando el volumen lo justifique, se migra a Transbank directo — **y por eso la integración debe estar detrás de un puerto propio desde el día uno** (`lib/billing/gateway.ts` con una interfaz `BillingGateway`), no con llamadas a Flow esparcidas por el código.

### Modelo de datos propuesto

```
SuscripcionTenant
  tenantId, planId, ciclo (mensual|anual)
  estado: trial | activa | pago_pendiente | suspendida | cancelada | expirada
  gatewayRef            -- id de la suscripción en el proveedor
  periodoActualHasta    -- hasta cuándo tiene derecho al servicio
  cancelaAlFinDelPeriodo (bool)

CargoBilling            -- todo cobro a un tenant (suscripción o comisiones)
  tenantId, tipo: suscripcion | comision_plataforma
  montoClp, periodo, estado: pendiente|pagado|fallido|reembolsado
  gatewayRef, intentos, idempotencyKey

EventoGatewayPago       -- log crudo de webhooks, para auditoría e idempotencia
  proveedor, eventoIdExterno (UNIQUE), payload, procesadoEn
```

`Tenant.plan` (string libre) deja de ser la fuente de verdad y pasa a derivarse de la suscripción activa. **Ojo:** `getCupoUsuarios()` y `getAnalyticsTier()` ya hacen fallback a Bronze ante un plan desconocido — ese fallback conservador debe mantenerse, porque un fallo de billing nunca debe abrir permisos.

### Puntos críticos

- **Idempotencia**: `eventoIdExterno` con índice único. Los gateways reenvían webhooks; cobrar dos veces es inaceptable.
- **Firma de webhook**: verificar siempre; sin firma válida, descartar. Es un endpoint público que mueve dinero.
- **Dunning**: reintentos escalonados (día 1, 3, 7) → aviso → suspensión, no cancelación inmediata.
- **Downgrade con cupo excedido** (caso real ya presente en el código): un tenant Gold con 5 usuarios que baja a Bronze (1 usuario). No se pueden borrar usuarios automáticamente. Política propuesta: bloquear invitaciones nuevas, mantener los existentes en solo-lectura y avisar al Manager para que elija a quién conservar. Debe decidirse antes de implementar.
- **Boletas/facturas (SII)**: Propigo debe emitir DTE por cada cobro. Es una integración aparte (proveedor DTE) que suele olvidarse en la estimación.
- **Prorrateo en cambio de plan** a mitad de ciclo.

---

## Parte 2 — Devoluciones

### Hallazgo legal: la política publicada promete más de lo que dice la ley, y con un criterio subjetivo

El texto actual en `PlanesStop.tsx` dice:

> "En cumplimiento con la ley del consumidor de Chile […] tienes un plazo de 10 días […] **siempre que no hayas hecho un uso intensivo y exhaustivo** de las herramientas […] Te reembolsamos el **100 %** de tu dinero sin hacer preguntas."

Tres problemas, en orden de gravedad:

1. **"Uso intensivo y exhaustivo" no es un criterio objetivo.** Es indefendible en una disputa y deja a Propigo decidiendo caso a caso. Debe reemplazarse por una condición medible y verificable en base de datos (p. ej.: menos de N tokens de IA consumidos **y** cero contratos generados **y** cero pagos procesados por el canal).
2. **La invocación de la ley probablemente no es correcta para este caso.** El art. 3 bis de la Ley 19.496 protege al *consumidor* (destinatario final). Un corredor que contrata un software para operar su negocio es un usuario profesional, no un consumidor final — la aplicabilidad es, como mínimo, discutible. Además, para servicios, la ley señala que el reembolso cubre **solo las sumas que no correspondan a servicios ya prestados** — es decir, la ley admite descontar lo consumido, mientras la copy promete el 100 %.
3. Prometer más que la ley es perfectamente válido, pero **debe presentarse como lo que es**: una garantía comercial voluntaria de Propigo, no como cumplimiento legal. Presentarla como obligación legal cuando probablemente no lo es repite exactamente el problema que ya se corrigió en `contract-rules.ts` con la cita falsa del art. 46 (ver ADR-0012 y el commit de legal review).

**Recomendación:** reformular como *"Garantía Propigo de 10 días"*, con condiciones objetivas, y **someter el texto a revisión de un abogado** antes de publicarlo junto con el cobro real. Mientras no haya cobro real, no hay exposición: hoy nadie paga. Esa es la ventana para corregirlo.

### Diseño técnico

- **Reembolso automático** solo si se cumplen todas las condiciones objetivas y está dentro de ventana. Fuera de eso → cola de revisión manual, nunca rechazo silencioso.
- **Ventana técnica del gateway**: reversa (mismo día) y reembolso (posterior) son operaciones distintas con reglas y plazos propios en Transbank. El código debe elegir la correcta según antigüedad, no asumir una.
- **Anti-abuso**: máximo un reembolso por retracto por tenant en su ciclo de vida; registrar RUT para detectar recreación de cuentas.
- **Trazabilidad**: todo reembolso genera `CargoBilling` en estado `reembolsado` + registro en `AuditoriaEquipo`, con quién lo aprobó (o "automático") y por qué.

---

## Parte 3 — Canal de pago del arriendo

### La economía decide la tecnología

Con arriendo promedio de referencia **CLP $500.000**:

| Riel | Costo aproximado del riel | Sobre $500.000 |
|---|---|---|
| Tarjeta (Webpay/MP) | ~3–3,5 % + IVA | **~$15.000–17.500** |
| A2A (Khipu/Fintoc) | orden de ~1 % o tarifa plana negociable | **~$5.000 o menos** |

**Conclusión: el arriendo no se cobra con tarjeta.** No es una preferencia estética:

- Si Propigo cobrara ~1 % de comisión ($5.000), el costo de un riel de tarjeta (~$17.500) sería **más de tres veces la comisión completa**. El modelo de negocio no cierra.
- Pagar el arriendo con tarjeta de crédito implica que el arrendatario financia su arriendo a tasa de tarjeta — malo para él y fuente previsible de reclamos.
- ADR-0006 ya había llegado a la misma conclusión por otra vía al elegir **PAC** como canal confiable. Este ADR lo confirma con la economía y le pone proveedor.

**Recomendación de riel: A2A (Fintoc o Khipu), con el pago liquidado directamente en la cuenta bancaria del corredor.** Fintoc lanzó en abril de 2026 pagos recurrentes con soporte PAC, lo que calza exactamente con la naturaleza mensual del arriendo. Se debe **cotizar ambos y negociar tarifa por volumen o tarifa plana** (las tarifas de lista son para comercios pequeños).

### Modelo de comisión: tarifa plana por pago procesado

Contexto de mercado: el corredor ya cobra entre **7 % y 10 %** del arriendo mensual por administración, y esa administración *ya incluye* la gestión de cobro. La comisión de Propigo no es un cargo nuevo para el arrendatario: es **una porción del fee que el corredor ya gana**, a cambio de automatizarle el trabajo.

Por eso se recomienda **monto fijo por pago conciliado** (orden de $2.000–3.000 CLP) en vez de porcentaje:

- Es predecible para el corredor y fácil de explicar ("$2.500 por arriendo cobrado automáticamente").
- Desacopla el ingreso de Propigo del tamaño del arriendo: no hay incentivo perverso ni percepción de "quedarse con parte del arriendo".
- Sobre un fee de administración de $35.000–50.000, es claramente absorbible.
- Evita el problema de un porcentaje que en arriendos altos parece abusivo y en bajos no cubre el costo del riel.

**Decisión comercial pendiente:** el monto exacto y quién absorbe el costo del riel A2A (Propigo con cargo a su margen, o se traspasa). Debe fijarse con la cotización real en mano.

### Flujo

```
1. Corredor conecta su cuenta bancaria de destino (una vez, verificada).
2. Arrendatario autoriza el pago recurrente (mandato PAC/A2A) desde el Portal.
3. Cada mes el proveedor ejecuta el cobro → el dinero va DIRECTO al banco del corredor.
4. Webhook confirma → Propigo crea PagoEntrante(canal=PAC, origen="gateway")
   y concilia contra el PeriodoPago (calce exacto de monto, según ADR-0006).
5. Propigo devenga ComisionPlataforma por ese pago conciliado.
6. Cierre de mes: se suman las comisiones devengadas y se cobran al corredor
   por el MISMO riel de tarjeta de la suscripción (Parte 1).
   - Plan mensual → un cargo: suscripción + comisiones.
   - Plan anual   → un cargo: solo comisiones.
```

Este flujo encaja sin fricción con lo que ya existe: `PagoEntrante` ya tiene `canal`, `estado` y `origen`; `EstadoPago.en_revision` ya modela el pago no confiable. Solo se agrega el origen `gateway` como camino automático, que es exactamente lo que ADR-0006 anticipó.

### Riesgos específicos

- **Fuga de comisión.** Si el arrendatario paga por fuera (transferencia directa), Propigo no lo ve y no devenga. Política: se cobra comisión **solo** por pagos efectivamente conciliados por el canal. Intentar cobrar por pagos que Propigo no procesó sería indefendible.
- **Verificación de la cuenta del corredor.** Si se carga mal el número de cuenta, el arriendo de un tercero se va a una cuenta equivocada. Requiere verificación de titularidad (RUT del titular = RUT del tenant) y confirmación en dos pasos ante cualquier cambio — el mismo criterio ya aplicado a cambio de contacto por OTP.
- **Datos bancarios y Ley 21.719.** Propigo **no** debe almacenar credenciales bancarias del arrendatario; eso vive en el proveedor. Propigo guarda solo el identificador del mandato.
- **Comisión devengada pero impaga.** Si el corredor no paga sus comisiones a fin de mes, se suspende el canal para nuevos cobros — pero **jamás** se interrumpe un mandato ya autorizado por un arrendatario sin avisarle: él no es parte del conflicto comercial.
- **Verificar en el Registro de la CMF** que el proveedor elegido esté efectivamente inscrito y autorizado. Es el sustento de todo el diseño D1.

---

## Estrategia de implementación por fases

Cada fase es entregable y reversible por sí sola. **Ninguna fase posterior arranca sin la anterior verificada con dinero real en piloto.**

| Fase | Alcance | Por qué en este orden |
|---|---|---|
| **0. Decisiones** | Moneda (CLP/UF), precios, proveedor cotizado y contratado, monto de comisión, revisión legal del texto de retracto | Todo lo demás depende de esto. Es trabajo de negocio, no de código. |
| **A. Fundación** | `BillingGateway` (puerto), modelos, webhooks con firma + idempotencia, panel interno de cobros | Riel seguro antes de mover un peso. |
| **B. Suscripción** | Alta, cobro recurrente, dunning, cambio de plan, política de downgrade, DTE | Punto 1 completo. Valida el riel de tarjeta con montos chicos y clientes propios. |
| **C. Devoluciones** | Retracto con condiciones objetivas, reembolso automático + cola manual | Requiere B (no hay qué devolver antes). |
| **D. Canal de arriendo** | Cuenta del corredor verificada, mandato del arrendatario, conciliación automática, devengo de comisión | La pieza de mayor riesgo. Va al final, cuando el riel de cobro al corredor (B) ya está probado en producción. |
| **E. Facturación de comisiones** | Cierre mensual, cargo consolidado, suspensión por impago | Cierra el ciclo del punto 3. |

Fase D es deliberadamente la última: cobrar comisiones (E) requiere un riel de cobro al corredor ya probado (B), y equivocarse con dinero de terceros (D) es mucho más grave que equivocarse con la propia suscripción.

---

## Estrategia de QA

Software que mueve dinero exige un estándar más alto que el resto del sistema. Tres capas:

### 1. Invariantes (tests automáticos, bloquean el merge)

Son las reglas que **nunca** pueden romperse, verificadas en cada build:

- **Aislamiento de ledgers**: ningún `AsientoLedger` puede tener tipo/concepto de comisión de plataforma. Test que falle si alguien lo intenta. *(Protege D2 — el error más caro posible.)*
- **Idempotencia**: procesar el mismo webhook N veces produce exactamente un cargo.
- **No doble cobro**: un `periodo` + `tenant` no puede tener dos `CargoBilling` de suscripción pagados.
- **Suma cero**: los asientos del contrato siguen cuadrando después de introducir el canal de pago (regresión sobre el ledger existente).
- **Fallback conservador**: ante suscripción inválida/vencida, `getCupoUsuarios()` devuelve el cupo más bajo, nunca ilimitado.
- **Reembolso ≤ cobrado**: imposible reembolsar más de lo pagado.

### 2. Escenarios (sandbox del proveedor, sin dinero real)

- Tarjeta OK / rechazada / sin fondos / expirada / robada.
- Webhook duplicado, fuera de orden, con firma inválida, replay antiguo.
- Cobro recurrente con reintentos hasta suspensión.
- Cambio de plan con prorrateo; downgrade con cupo excedido.
- Retracto dentro y fuera de ventana; con y sin uso que supere el umbral.
- Conciliación: monto exacto, monto menor, monto mayor, pago duplicado, pago tardío.
- Corredor con comisiones impagas.
- **Reloj inyectable** para simular ciclos de facturación sin esperar 30 días.

### 3. Piloto controlado (dinero real, alcance acotado)

Antes de abrir a clientes:

- 2–3 corredores reales aceptando explícitamente ser piloto, con montos bajos.
- Conciliación **manual diaria** contra las cartolas reales del proveedor y del corredor durante el primer mes: cada peso movido debe calzar con un registro en Propigo.
- Runbook de incidentes escrito **antes** de arrancar: cómo se revierte un cobro erróneo, a quién se llama, en qué plazo se le responde al afectado.
- Criterio de salida explícito: cero descalces durante N días consecutivos.

### Reglas transversales

- **Nunca** credenciales de producción en el repositorio ni en `.env` versionado.
- Todo cobro, reembolso y devengo queda en log auditable e inmutable.
- Los montos son enteros en CLP (`Decimal(14,0)`, como ya hace el resto del sistema). Prohibido `float` para dinero.

---

## Decisiones abiertas (requieren definición del negocio)

1. **Moneda y precios definitivos** en CLP/UF, y viabilidad del plan Bronze frente al costo de cobro.
2. **Proveedor**, con cotización real: Flow vs. Transbank directo (suscripción) y Fintoc vs. Khipu (arriendo).
3. **Monto de la comisión** por pago procesado y quién absorbe el costo del riel.
4. **Política de downgrade** cuando el tenant excede el cupo del plan nuevo.
5. **Revisión legal** del texto de retracto y de los términos del canal de pago.

## Consecuencias

- Se introduce un dominio de billing **separado** del ledger de contratos, con su propia RLS por tenant.
- La integración de pasarela queda tras un puerto propio, permitiendo cambiar de proveedor sin reescribir el dominio.
- `Tenant.plan` deja de ser fuente de verdad; pasa a derivarse de la suscripción.
- Propigo queda expresamente fuera del circuito de fondos de terceros, y esa restricción se documenta como invariante de producto, no como detalle de implementación.
