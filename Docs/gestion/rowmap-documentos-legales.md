# RowMap de Documentos y Cumplimiento Legal

> **Documento vivo.** Mismas convenciones que [rowmap-pagos.md](rowmap-pagos.md)
> y [rowmap-producto.md](rowmap-producto.md): cada fila es un entregable
> verificable; cada pregunta dice qué fila bloquea y trae recomendación por
> defecto.
>
> Existe separado porque cruza tres cosas que los otros dos rowMaps no cubren:
> los documentos que la plataforma emite, la normativa chilena que los rige, y
> las obligaciones de datos personales.
>
> Origen: [documentos-de-pago-y-cumplimiento-sii.md](../funcional/documentos-de-pago-y-cumplimiento-sii.md),
> más una auditoría del código del 2026-09-03.
>
> _Creado 2026-09-03._

### Estados
`[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[!]` bloqueada por decisión

### Cómo se hizo esta auditoría

No es una lista de buenas ideas: cada fila salió de contrastar el código contra
una norma concreta. Lo que se revisó, con el resultado:

- Los 38 modelos del esquema y los 27 enums.
- Los tres documentos de referencia de `Docs/testFiles/`.
- Qué guarda cada `snapshot` de voucher, línea por línea.
- Qué promete `privacidad/page.tsx` frente a lo que el código puede hacer.
- De dónde salen la UF y el IPC.
- Si existe algún trabajo periódico de retención de datos.

---

## Grupo A — El comprobante como documento

**Objetivo:** que cada pago tenga un documento que sirva de prueba ante un
tribunal y de respaldo ante el SII. Hoy el voucher existe solo como fila y
pantalla.

**Por qué importa más de lo que parece:** bajo la Ley 21.461, en el
procedimiento monitorio *«se presumirá que la renta es la que consta en los
comprobantes de pago entregados»*, y si no hay comprobantes se presume **la que
señale el arrendatario**. El comprobante no es un adorno: es lo que fija el
monto adeudado.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-CP1** | El `snapshot` del voucher de pago conserva la **descripción** de cada ajuste (hoy guarda solo `tipo` y `monto`) | — | — | `[ ]` |
| **L-CP2** | El `snapshot` del voucher de liquidación guarda **la lista completa de ajustes** (hoy no guarda ninguno) | — | — | `[ ]` |
| **L-CP3** | El `snapshot` guarda **todo lo que el PDF imprime**: datos de la corredora, del inmueble y de las partes al momento del hecho | L-CP1, L-CP2 | — | `[ ]` |
| **L-CP4** | **Folio legible** por corredora y año (`LQ-2026-00042`), persistido, no calculado al vuelo | — | **L-01** | `[!]` |
| **L-CP5** | Comprobante de pago en **PDF**, generado desde el snapshot | L-CP3, L-CP4 | — | `[ ]` |
| **L-CP6** | Liquidación del propietario en **PDF**, con la distribución explícita | L-CP5, P-GA2 | **G-03** | `[!]` |
| **L-CP7** | Los PDF se **regeneran desde el snapshot**; el archivo es caché de 12 meses, el dato es permanente | L-CP5 | — | `[ ]` |
| **L-CP8** | Descarga del comprobante por mes desde el panel **y** desde el portal | L-CP5 | — | `[ ]` |
| **L-CP9** | El **Rol de avalúo** aparece en el comprobante (ya existe en `Propiedad`, no se usa) | L-CP3 | — | `[ ]` |
| **L-CP10** | Pie obligatorio: «Comprobante de gestión. No constituye documento tributario» | L-CP5 | — | `[ ]` |

---

## Grupo B — Datos que faltan para poder emitir

**Objetivo:** el Grupo A no se puede hacer sin estos campos. Son datos, sin
lógica: es el trabajo más barato del rowMap y desbloquea todo lo demás.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-DT1** | `Tenant.esPersonaJuridica` — decide si la comisión lleva IVA | — | — | `[ ]` |
| **L-DT2** | `Tenant.giro`, `Tenant.direccion`; `Tenant.rut` pasa a obligatorio | — | **L-02** | `[!]` |
| **L-DT3** | `Propiedad.avaluoFiscal` — mención exigida por el Art. 10 de la Ley 18.101 | — | **L-03** | `[!]` |
| **L-DT4** | `Contrato.esAmoblado` — **determina si el arriendo está afecto a IVA** | — | — | `[ ]` |
| **L-DT5** | Cuenta bancaria de la corredora (para el recordatorio) | — | — | `[ ]` |
| **L-DT6** | Cuenta bancaria del propietario (para la liquidación) | — | — | `[ ]` |
| **L-DT7** | Las cuentas bancarias entran al régimen de visibilidad del Grupo 1: dato sensible, no público | L-DT5, L-DT6 | — | `[ ]` |
| **L-DT8** | `Contrato.inscripcionCbr` (fojas, número, año) — hoy el borrador lo deja como marcador | — | — | `[ ]` |
| **L-DT9** | `Contrato.firmadoAnteNotario` — es lo que da prueba suficiente en el monitorio (Ley 21.461) | — | — | `[ ]` |
| **L-DT10** | `Contrato.causalTermino` y fecha de notificación del desahucio | — | — | `[ ]` |

---

## Grupo C — IVA de la comisión

**Objetivo:** que la liquidación diga la verdad tributaria, que **no es una
sola** para todas las corredoras.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-IV1** | Cálculo del IVA de comisión según naturaleza jurídica: afecta si es persona jurídica; **exenta** si es persona natural por trabajo personal (Art. 12° E N°8 LIVS) | L-DT1 | — | `[ ]` |
| **L-IV2** | `ivaComisionCLP` en el snapshot y en línea aparte del documento | L-IV1, L-CP2 | — | `[ ]` |
| **L-IV3** | Tests del cuadre: `arrendatario = propietario + comisión + IVA` | L-IV2 | — | `[ ]` |
| **L-IV4** | Si el inmueble es amoblado, la renta va afecta a IVA con base rebajada en 11 % del avalúo fiscal | L-DT3, L-DT4 | **L-04** | `[!]` |

---

## Grupo D — Origen del pago: subsidio y terceros

**Objetivo:** representar que una renta puede pagarse desde más de una fuente.

**El hallazgo que obliga a esto:** el subsidio DS 52 del MINVU **no rebaja la
renta**. SERVIU transfiere el subsidio directamente al arrendador y el
beneficiario paga su copago aparte, por Caja Vecina o ServiEstado — no a la
cuenta de la corredora. Modelarlo como descuento haría que el ledger cuadre mal
y que la comisión se calcule sobre una base equivocada.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-SB1** | Modelo de **origen de pago por período**: cuánto se espera del arrendatario y cuánto de un tercero identificado | — | — | `[ ]` |
| **L-SB2** | El recordatorio al arrendatario cobra **solo su copago**, no la renta completa | L-SB1 | — | `[ ]` |
| **L-SB3** | La conciliación acepta un **pago parcial esperado** sin marcarlo como atraso | L-SB1 | — | `[ ]` |
| **L-SB4** | Estado del subsidio: cuotas de copago impagas (a las 3, SERVIU suspende; con 2 sigue pagando) | L-SB1 | — | `[ ]` |
| **L-SB5** | El comprobante muestra las dos fuentes por separado | L-SB1, L-CP5 | — | `[ ]` |
| **L-SB6** | Marca de que el contrato **no es nuestro borrador**: en subsidio se genera en `arriendoenlinea.minvu.cl` y se legaliza ante notario | L-SB1 | — | `[ ]` |

---

## Grupo E — Ley 21.719: la única fecha dura

**Objetivo:** cumplir la ley de datos personales **antes del 1 de diciembre de
2026**.

**El problema no es que falte: es que ya lo publicamos.** `privacidad/page.tsx`
declara seis plazos de retención y cuatro derechos. Se verificó cada uno contra
el código:

| Lo que promete la política | Lo que hace el código |
|---|---|
| «Códigos OTP: eliminados automáticamente al expirar (10 min)» | **Nunca se borran.** `accesoOtp.delete` no aparece en ninguna parte |
| «Logs de IP y navegación: 90 días» | **Nunca se borran.** `accesoLog.delete` tampoco existe |
| «Audit log: 3 años» | **Nunca se borra.** `auditoriaEquipo.delete` tampoco |
| «Registros de pagos: 7 años (Código Tributario art. 200)» | El art. 200 fija **6 años**, no 7 |
| Acceso, rectificación, supresión, suspensión | Ninguno implementado |

Comprobado también contra la base: `acceso_log` acumula 279 filas y
`acceso_otp` 9, ninguna borrada nunca. Los cinco `deleteMany` que sí existen en
el código son limpiezas operativas —invalidar un código anterior, revocar
dispositivos—, no retención.

**Tres de esas afirmaciones son falsas hoy**, y están publicadas en una página
legal del sitio. Ese es el riesgo mayor del grupo, y es anterior a la entrada en
vigencia de la ley.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-DP1** | Trabajo de retención que **cumpla los plazos ya publicados**: OTP, logs de IP, audit log | — | — | `[ ]` |
| **L-DP2** | Derecho de **acceso**: entregar copia de los datos de una persona | — | — | `[ ]` |
| **L-DP3** | Derecho de **portabilidad**: exportar en formato estructurado y reutilizable | L-DP2 | — | `[ ]` |
| **L-DP4** | Derecho de **rectificación** desde el portal | — | — | `[ ]` |
| **L-DP5** | Derecho de **supresión**, con anonimización irreversible y sin romper el ledger inmutable | L-DP1 | **L-05** | `[!]` |
| **L-DP6** | Derecho de **oposición y bloqueo** del tratamiento | — | — | `[ ]` |
| **L-DP7** | **Canal** para ejercer los derechos, con acuse y plazo de respuesta | L-DP2…L-DP6 | **L-06** | `[!]` |
| **L-DP8** | **Registro de actividades de tratamiento** | — | — | `[ ]` |
| **L-DP9** | Procedimiento de **notificación de brechas** a la Agencia y a los afectados | — | **L-07** | `[!]` |
| **L-DP10** | Revisar si corresponde **delegado de protección de datos** | — | **L-07** | `[!]` |
| **L-DP11** | Corregir las **tres afirmaciones falsas** de `privacidad/page.tsx` (OTP, logs de IP, audit log) y el plazo del art. 200 | — | — | `[ ]` |
| **L-DP12** | Volver a alinear la política una vez implementadas las capacidades | L-DP1…L-DP8 | — | `[ ]` |

> **L-DP11 es la fila más urgente de todo el rowMap**, y no por la ley de datos:
> hay tres afirmaciones falsas publicadas en una página legal del sitio. O se
> corrige el texto, o se implementa el borrado. Lo primero cuesta una tarde; lo
> segundo, L-DP1. Cualquiera de las dos sirve, pero dejarlo como está no.

---

## Grupo F — Comunicaciones que faltan

**Objetivo:** cubrir los hechos del arriendo que hoy no tienen documento.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-CM1** | **Estado de cuenta de deuda**: rentas, gastos comunes y consumos adeudados, con forma, fecha y lugar en que se contrajeron — es lo que exige la demanda monitoria | L-CP3 | — | `[ ]` |
| **L-CM2** | **Aviso de término** con los plazos calculados: 2 meses, +1 por año completo ocupado, tope 6 | L-DT10 | — | `[ ]` |
| **L-CM3** | El aviso de término advierte que **no surte efecto legal por correo**: requiere notificación judicial o personal de notario | L-CM2 | — | `[ ]` |
| **L-CM4** | **Aviso de reajuste** en PDF, mostrando los 12 meses de IPC uno por uno | P-NT3 | **G-04** | `[!]` |
| **L-CM5** | **Devolución de garantía** con detalle de retenciones y su motivo | P-GA3 | — | `[ ]` |
| **L-CM6** | **Aviso de cambio de titularidad** de la propiedad | — | — | `[ ]` |
| **L-CM7** | Datos de transferencia en el recordatorio de pago, y cierre «Si ya pagaste, omite este correo» | L-DT5 | — | `[ ]` |

---

## Grupo G — Fuentes oficiales

**Objetivo:** que los montos que la plataforma calcula sean los que la ley
reconoce.

Hoy la UF y el IPC salen del `seed`. Mientras el producto es una demostración da
lo mismo; **con un contrato real, un reajuste calculado sobre una serie
desactualizada produce un monto legalmente incorrecto** y cobrado de más o de
menos.

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-FU1** | Fuente oficial de **UF** (Banco Central) con carga periódica | — | **L-08** | `[!]` |
| **L-FU2** | Fuente oficial de **IPC** (INE) con carga periódica | — | **L-08** | `[!]` |
| **L-FU3** | El sistema **se niega a reajustar** si la serie no cubre el período, en vez de calcular con datos viejos | L-FU1, L-FU2 | — | `[ ]` |
| **L-FU4** | El documento de reajuste **cita la fuente y la fecha** de la serie usada | L-FU3, L-CM4 | — | `[ ]` |

---

## Grupo H — Obligaciones periódicas

| ID | Fila | Depende de | Preguntas | Estado |
|---|---|---|---|---|
| **L-DJ1** | Exportador de la **Declaración Jurada 1835** sobre bienes raíces arrendados | L-DT2 | **L-09** | `[!]` |
| **L-DJ2** | Recordatorio anual al corredor de que debe presentarla | L-DJ1 | — | `[ ]` |

> Obliga a *«todos los corredores, intermediarios o mandatarios que tengan la
> facultad de administración otorgada en el contrato»* — exactamente nuestro
> usuario. Es anual, hoy se arma a mano, y ya tenemos casi todos los datos.

---

## Preguntas abiertas

| ID | Pregunta | Prioridad | Bloquea | Recomendación por defecto | Estado |
|---|---|---|---|---|---|
| **L-01** | ¿El folio es correlativo por corredora, o global de la plataforma? | 🟡 | L-CP4 | Por corredora y año: es su documento, no el nuestro. | Abierta |
| **L-02** | `Tenant.rut` pasa a obligatorio: ¿qué pasa con las cuentas ya creadas sin él? | 🟡 | L-DT2 | Obligatorio para emitir documentos, no para usar el panel. Se pide al primer intento de emisión. | Abierta |
| **L-03** | ¿El avalúo fiscal se carga a mano o se obtiene del SII por el rol? | 🟡 | L-DT3 | A mano al principio. La consulta automatizada al SII es un proyecto aparte. | Abierta |
| **L-04** | ¿Damos soporte al arriendo amoblado, que sí va afecto a IVA? | 🔴 | L-IV4 | Sí, pero en una segunda etapa: primero el caso habitacional simple, que es el 90 %. | Abierta |
| **L-05** | Supresión de datos vs. ledger inmutable: ¿cómo se resuelve? | 🔴 | L-DP5 | Anonimizar la `Persona` y conservar los asientos con el vínculo roto. El ledger conserva montos y fechas, no identidad. **Requiere revisión legal.** | Abierta |
| **L-06** | ¿Cuál es el plazo de respuesta a una solicitud de derechos? | 🔴 | L-DP7 | Leer el plazo en el texto de la ley y publicarlo. No inventarlo. | Abierta |
| **L-07** | ¿Housing es responsable o encargado del tratamiento? De eso dependen las obligaciones de brechas y de delegado | 🔴 | L-DP9, L-DP10 | Probablemente **encargado** frente a la corredora y **responsable** de sus propios usuarios. Requiere revisión legal. | Abierta |
| **L-08** | ¿Qué fuente para UF e IPC: API del Banco Central, del INE, o un agregador? | 🟡 | L-FU1, L-FU2 | Banco Central para UF, INE para IPC — las oficiales. Un agregador introduce un intermediario en un dato que define montos cobrados. | Abierta |
| **L-09** | ¿Qué campos y qué formato exige exactamente la DJ 1835? | 🟡 | L-DJ1 | Leerlos del formulario oficial. El PDF de instrucciones no se pudo extraer con confianza. | Abierta |

---

## Lo que hay que confirmar antes de codificar

Dos cosas quedaron a medias en la investigación y **no deben implementarse como
requisito duro hasta leerlas en la fuente**:

1. **Las menciones del Art. 10 de la Ley 18.101** (monto, período, avalúo fiscal,
   valor de muebles y servicios anexos). Provienen de la síntesis de la BCN; el
   sitio de Ley Chile no se pudo leer.
2. **Los plazos y multas concretos de la Ley 21.719.** La síntesis de la BCN solo
   se extrajo hasta la portada. La cifra de 20.000 UTM que circula en la
   documentación del proyecto viene de una sesión anterior y tampoco está
   confirmada acá.

---

## Orden sugerido

1. **L-DP11** — alinear la política de privacidad con la realidad. Reduce riesgo
   hoy y no requiere lógica.
2. **Grupo B** (datos) — barato, sin lógica, desbloquea casi todo.
3. **L-CP1 a L-CP3** — los snapshots completos.
4. **Grupo C** (IVA) — la regla que hoy no existe.
5. **L-CP5 a L-CP10** — los PDF.
6. **Grupo E** — tiene fecha: 1 de diciembre de 2026.
7. **Grupo D** (subsidio) y **Grupo F** (comunicaciones).
8. **Grupo G** (fuentes oficiales) antes de cualquier contrato real.
9. **Grupo H** (DJ 1835).

> **La única fecha impuesta desde afuera es el 1 de diciembre de 2026.** Todo lo
> demás lo ordenamos nosotros; eso no.
