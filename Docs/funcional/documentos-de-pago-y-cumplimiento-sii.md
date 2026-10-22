# Documentos de pago: qué emitimos, qué exige la ley y qué falta

> Análisis del 2026-09-02, a partir de tres documentos reales de una plataforma
> competidora (Leasity, corredora Fuhrer Group) dejados en `Docs/testFiles/`, más
> la normativa del SII y la Ley 18.101.
>
> **Conclusión corta:** Propigo **no puede emitir una boleta ni una factura**, y
> no debería intentarlo. Lo que sí puede —y hoy no hace— es emitir el
> comprobante que respalda cada pago, dejar la comisión con su IVA desglosado
> para que la corredora la declare, y armar la Declaración Jurada 1835, que es
> una obligación anual que hoy el corredor hace a mano.

---

## 1. Qué muestran los documentos de referencia

### 1.1 Liquidación mensual (`Liquidacion_pago.pdf`)

Es el documento más completo de los tres. Su estructura:

| Bloque | Contenido |
|---|---|
| Encabezado | Corredora, correo de contacto, mes, título, **código de documento** (`B8859097`) |
| Propiedad | Dirección, comuna, región y **Rol de avalúo** (`429-6`) |
| Arrendatario | Nombre, y su cuenta: cargos (+) y descuentos (−), con fecha de pago |
| Distribución | Cómo se reparte lo pagado, entre propietario y administrador |
| Propietario | Nombre, **RUT**, **banco y número de cuenta**, ingresos (+) y egresos (−) |
| Administrador | Comisión, **e IVA de la comisión en línea aparte** |
| Histórico | Barras de los últimos 6 meses |

Los números cuadran, y ese cuadre es el diseño del documento:

```
Arriendo cobrado al arrendatario      $625.456
  − Convenio Aguas Andinas             −$75.321
  = Pagado por el arrendatario        $550.135

Arriendo del dueño                    $562.191
  − Convenio Aguas Andinas             −$75.321
  = Recibe el propietario             $486.870

Comisión administrador                 $53.164
  + IVA (19 %)                         +$10.101
  = Retiene el administrador           $63.265

$486.870 + $63.265 = $550.135   ✔
$625.456 − $562.191 = $63.265   ✔
```

Es decir: **la comisión se descuenta del lado del propietario**, y el
arrendatario paga un monto que ya la incluye sin verla desglosada.

### 1.2 Recordatorio de pago (`Liquidacion_Recordatorio_pago_arriendo.jpeg`)

Correo al arrendatario. Aporta dos cosas que nosotros no tenemos:

- **Los datos de transferencia**: nombre, RUT, banco, número de cuenta y correo
  de la corredora. Sin eso el aviso no es accionable.
- Un cierre honesto: «Si ya pagaste, omite este correo» — reconoce que el aviso
  se genera por calendario y puede cruzarse con un pago ya hecho.

### 1.3 Aviso de reajuste de IPC (`Reajuste_IPC_Arriendo.pdf`)

Notifica al arrendatario el reajuste pactado. Su valor está en que **muestra el
cálculo completo**: los 12 meses de variación del IPC uno por uno, la suma
(3,52 %), la renta anterior ($396.185), el monto del reajuste ($13.950), la renta
nueva ($410.135) y el período de vigencia (septiembre 2026 a agosto 2027).

No pide creer el número: lo demuestra. Eso es exactamente lo que evita la
discusión con el arrendatario.

---

## 2. Qué tenemos hoy

| | Estado |
|---|---|
| Modelo `Voucher` con `pago` y `liquidacion` | ✅ Existe, con `snapshot` en JSON |
| Listado en `/panel/vouchers` | ✅ |
| Comprobante en **PDF** | ❌ Solo el borrador de contrato tiene PDF |
| **IVA de la comisión** desglosado | ❌ El snapshot guarda `comisionCLP`, sin IVA |
| **Folio legible** del documento | ❌ Solo el UUID interno |
| Rol de avalúo en el comprobante | ❌ Existe en `Propiedad` desde el Grupo 1, no se usa acá |
| **Avalúo fiscal** de la propiedad | ❌ No existe el campo |
| Datos bancarios de la corredora o del propietario | ❌ No existen en el esquema |
| RUT y giro de la corredora | ⚠️ `Tenant.rut` es opcional; no hay giro ni dirección |
| Aviso de reajuste como documento | ❌ Grupo 3, sin empezar |
| Destinatario correcto de la liquidación | ❌ `Voucher.arrendatarioId` — ver **P-GA2 / G-03** |

El último punto queda confirmado por el documento de referencia: la liquidación
**es del propietario**, no del arrendatario. Lo que hoy es una fila pendiente en
el rowMap tiene ahora evidencia de un producto real.

---

## 3. Lo legal: qué se puede y qué no

### 3.1 Propigo no puede emitir una boleta ni una factura

Una boleta o factura electrónica es un **Documento Tributario Electrónico**, y
solo lo emite un contribuyente autorizado por el SII, con folios asignados (CAF)
y firma electrónica. Propigo no es el contribuyente: **la corredora lo es**.

Por lo tanto:

- Lo que Propigo genera es un **comprobante de gestión**, no un documento
  tributario. Debe decirlo en el propio documento, o induce a error.
- La factura o boleta por la comisión la sigue emitiendo la corredora, desde el
  portal del SII o su facturador. Propigo puede **preparar los datos** y, más
  adelante, integrarse con un facturador autorizado.
- **Nunca** imitar el formato de un DTE (timbre, folio con apariencia de CAF,
  la leyenda «documento tributario»). Un comprobante que se parece a una boleta
  sin serlo es peor que no tenerlo.

### 3.2 El arriendo de vivienda es exento de IVA

Según el SII, **el arriendo de un inmueble sin amoblar no está gravado con IVA,
y el arrendador no tiene obligación de emitir boleta**. Solo se grava si el
inmueble se arrienda **amoblado** o con instalaciones para actividad comercial o
industrial; en ese caso la base imponible se calcula rebajando el **11 % del
avalúo fiscal** vigente.

Consecuencia de producto: para el arriendo habitacional —nuestro caso— **no hay
ningún documento tributario que emitir por la renta**. El comprobante de pago es
un respaldo civil, no tributario.

### 3.3 La comisión del corredor tiene DOS tratamientos, no uno

Este es el punto que el documento de referencia **no cubre**, porque su emisor es
una sociedad:

| Quién cobra la comisión | Tratamiento | Documento |
|---|---|---|
| Persona jurídica, o persona natural que emplea capital de forma preponderante | Primera categoría, **afecta a IVA** | Factura |
| Persona natural, por su trabajo o actuación personal exclusivamente | **Exenta de IVA** (Art. 12° letra E N°8 LIVS) | Boleta de honorarios |

Una liquidación que suma IVA a la comisión de un corredor persona natural está
mal, y una que lo omite para una corredora SpA también. **El sistema tiene que
saber cuál de los dos casos es cada corredora** y calcular en consecuencia.

Hoy no lo sabe: `Tenant` no distingue persona natural de jurídica.

### 3.4 Menciones obligatorias del recibo de arriendo

El **Art. 10 de la Ley 18.101** fija qué debe expresar el recibo que acredita el
pago de la renta:

- El monto
- El **período** al que corresponde
- El **avalúo fiscal** del inmueble
- El valor que corresponde pagar por **bienes muebles y servicios anexos** de
  los que goza el arrendatario

> ⚠️ **Pendiente de confirmar contra el texto oficial.** Esta lista proviene de
> la síntesis de la BCN; el sitio de Ley Chile no se pudo leer directamente al
> escribir esto. Antes de codificarla como requisito duro hay que leer el
> artículo en la fuente. Si se confirma, implica **un campo nuevo**
> (`avaluoFiscal` en `Propiedad`) y separar el valor de los muebles y servicios
> anexos del valor de la renta.

### 3.5 La Declaración Jurada 1835 — la oportunidad más grande

La **DJ 1835, sobre bienes raíces arrendados**, debe presentarla, entre otros:

> «Todos los corredores, intermediarios o mandatarios que:
> a) Tengan la facultad de administración otorgada en el contrato de
> arrendamiento o en otro documento;
> b) Concurran a la firma del contrato de arrendamiento;
> c) Si la comisión por el servicio de corretaje es cobrada por una empresa o
> sociedad, esta es la que debe informar.»

**Ese es exactamente nuestro usuario.** Es una obligación anual, hoy se arma a
mano, y Propigo ya tiene casi todos los datos: rol de la propiedad, RUT del
propietario, RUT del arrendatario, montos y períodos.

Es la funcionalidad con mejor relación entre valor entregado y trabajo, porque
no requiere integrarse con nadie: es un archivo que se genera y se sube al SII.

> La lista exacta de campos y el formato del archivo no se pudieron extraer con
> confianza del PDF de instrucciones. Hay que leerlos del formulario oficial
> antes de implementar.

---

## 4. Propuesta

### 4.1 Comprobante de pago del arrendatario

Reemplaza al voucher de hoy, que solo vive en pantalla.

- PDF con el mismo motor que el borrador de contrato (`@react-pdf/renderer`).
- Encabezado: corredora, propiedad **con su rol**, período, folio legible.
- Detalle: renta, gasto común, intereses por mora si los hubo, descuentos.
- Las menciones del Art. 10 (§3.4), una vez confirmadas.
- Pie: «Comprobante de pago. No constituye documento tributario.»

### 4.2 Liquidación del propietario

- Mismo formato, dirigida **al propietario** (requiere resolver **G-03**).
- Distribución explícita, como en el documento de referencia: qué pagó el
  arrendatario, qué recibe el propietario, qué retiene la corredora.
- **Comisión e IVA en líneas separadas**, calculado según §3.3.
- Datos de la transferencia al propietario.
- Pie: «Documento de respaldo de la gestión. La boleta o factura por la comisión
  se emite por separado.»

### 4.3 Un folio legible y estable

El UUID no sirve para que dos personas hablen por teléfono del mismo documento.
Un correlativo por corredora y año (`LQ-2026-00042`), guardado en el registro,
no generado al vuelo.

### 4.4 Datos que faltan en el modelo

| Dato | Para qué | Dónde |
|---|---|---|
| `esPersonaJuridica` | Decidir si la comisión lleva IVA | `Tenant` |
| `giro`, `direccion` | Encabezado del comprobante | `Tenant` |
| `avaluoFiscal` | Mención del Art. 10 | `Propiedad` |
| Cuenta bancaria de la corredora | Recordatorio de pago accionable | `Tenant` |
| Cuenta bancaria del propietario | Liquidación | `Persona` |
| `ivaComisionCLP` | Desglose y declaración | `snapshot` del voucher |

Las cuentas bancarias son **dato sensible**: entran al mismo régimen de
visibilidad que el rol y las cuentas de servicios (ver `BRAIN.md` §6).

### 4.5 Recordatorio de pago

Ya existe como notificación. Le faltan los datos de transferencia y el cierre
«Si ya pagaste, omite este correo», que evita el reclamo de quien pagó ayer.

### 4.6 Aviso de reajuste

Es el Grupo 3 (`P-NT3`). El documento de referencia da el diseño: **mostrar los
12 meses de IPC uno por uno**, no solo el resultado.

### 4.7 Exportador de la DJ 1835

Ver §3.5. Requiere leer el formato oficial primero.

---

## 5. Revisión de las cuatro definiciones (2026-09-03)

### 1. Detalle completo de cobros fijos y extras — ✅ y más barato de lo que parece

El modelo ya existe. `AjusteLiquidacion` guarda `tipo`
(`cargo_arrendatario` / `descuento_propietario` / `retencion`), `montoCLP`,
**`descripcion`** y quién lo creó.

El hueco es de presentación, no de datos:

- La **glosa del correo sí incluye** la descripción de cada ajuste.
- El **snapshot del voucher la pierde**: guarda `ajustes.map(a => ({ tipo, montoCLP }))`,
  sin `descripcion`. Un PDF generado desde ese snapshot mostraría montos sin
  decir de qué son.
- El voucher de liquidación **ni siquiera guarda los ajustes**: solo
  `comisionCLP`, `descuentoCLP` y `netoCLP`.

Arreglo: incluir `descripcion` y la lista completa de ajustes en ambos
snapshots. Es un cambio chico y desbloquea los tres documentos.

### 2. Doce meses de historia — ⚠️ como está redactado, incumple

Dos normas lo contradicen:

- **Art. 17 y 200 del Código Tributario:** la documentación se conserva
  mientras corra el plazo de revisión del SII, **6 años**, y más si esos
  antecedentes sirven de base a un período no prescrito.
- **Ley 21.461 («Devuélveme mi casa»):** en el procedimiento monitorio *«se
  presumirá que la renta es la que consta en los comprobantes de pago
  entregados»*, y **si no hay comprobantes, se presume la que señale el
  arrendatario**. Botar los comprobantes a los 12 meses es entregarle al
  arrendatario la definición del monto adeudado.

**La solución no es guardar todo como archivo.** Hay que separar el dato del
archivo:

| | Qué es | Cuánto se guarda |
|---|---|---|
| `Voucher` + `snapshot` | El dato, ya inmutable | **Permanente** |
| PDF renderizado | Una vista del dato, regenerable | Caché de 12 meses |

El PDF se vuelve a generar desde el snapshot cuando alguien lo pide. Se cumple
el objetivo de no acumular archivos, sin perder la prueba. Y como el snapshot ya
es inmutable, el documento regenerado es idéntico al original.

Lo que sí conviene fijar: el snapshot debe guardar **todo lo que el PDF
imprime**, incluidos los datos de la corredora y del inmueble del momento. Si
mañana cambia la dirección o la comisión, el comprobante de 2024 tiene que
seguir diciendo lo que decía.

### 3. Cambios de renta en PDF descargable — ✅

Correcto, y con una precisión que viene del documento de referencia: el aviso
debe **mostrar el cálculo**, no solo el resultado. Los doce meses de variación
del IPC uno por uno, la suma, la renta anterior, el monto del reajuste, la renta
nueva y el período de vigencia. Es lo que evita la discusión.

Aplica a cualquier cambio de renta, no solo al IPC: también a un reajuste
pactado distinto, a una rebaja acordada o a la corrección de un error.

### 4. Subsidio de arriendo — ❌ no es un descuento, y modelarlo así rompe la contabilidad

El **DS 52 del MINVU** no rebaja la renta. La renta sigue siendo la misma y se
paga **desde dos fuentes**:

1. **SERVIU transfiere el subsidio directamente al arrendador** — hasta 4,2 UF
   mensuales, con un tope total de 170 UF distribuibles en hasta 8 años.
2. **El beneficiario paga el copago por su cuenta**, antes del día 5, por Caja
   Vecina o ServiEstado con el convenio «Arriendo Subsidio Minvu» y su RUT —
   **no a la cuenta de la corredora**.

Consecuencias de diseño, todas distintas de una glosa de descuento:

- El arrendatario **le debe a la plataforma solo el copago**, no la renta
  completa. Un recordatorio que le cobre la renta entera está mal.
- El propietario **recibe la renta completa**, pero de dos orígenes y en fechas
  distintas. La conciliación tiene que aceptar un pago parcial esperado.
- La pata del subsidio **puede fallar**: si el beneficiario acumula 3 cuotas de
  copago impagas, SERVIU paga por última vez y suspende. Con 2 impagas sigue
  pagando. Eso es un estado que el sistema debe poder representar.
- El contrato se genera en `arriendoenlinea.minvu.cl` y se legaliza ante
  notario, así que **no es nuestro borrador** el que se firma en esos casos.

Modelarlo como «reducción de precio» haría que el ledger cuadre mal, que el
propietario aparezca recibiendo menos de lo que recibe, y que la comisión se
calcule sobre una base equivocada.

Lo correcto es un **origen de pago por período**: cuánto se espera del
arrendatario y cuánto de un tercero identificado. Sirve para el subsidio y
también para cualquier caso de pago por un tercero (una empresa que arrienda
para un empleado, un familiar que paga).

---

## 6. Otras consideraciones al comunicar

### El aviso de término NO se notifica por correo

Es el punto de mayor riesgo. Según la Ley 18.101, el desahucio del arrendador
**solo puede hacerse judicialmente o por notificación personal de un notario**.
Un correo de Propigo no termina ningún contrato.

Propigo puede **preparar** el aviso —con las fechas y los plazos ya
calculados— y dejarlo listo para llevar al notario. Lo que no puede es dar a
entender que enviarlo surte efecto legal.

Los plazos que el documento debe calcular:

| Tipo de contrato | Plazo de restitución |
|---|---|
| Mes a mes o indefinido | **2 meses** desde la notificación, **+1 mes por cada año completo** ocupado, con tope de **6 meses** |
| Plazo fijo de hasta 1 año | Solo judicialmente; 2 meses desde que se notifica la demanda |

El arrendatario puede restituir antes y paga solo hasta el día de la entrega.

### Todo lo que se comunique es prueba

Por la Ley 21.461, los comprobantes que emitimos definen la renta ante el
tribunal. Eso sube el estándar de tres cosas:

- **Nada de montos aproximados ni redondeos silenciosos** en un comprobante.
- **Fecha y hora de emisión y de envío**, guardadas.
- El estado de cuenta para una demanda monitoria necesita, además de las
  rentas, **los gastos comunes y las cuentas de consumo adeudadas**. Eso conecta
  con las cuentas de servicios del Grupo 1: ya sabemos quién paga cada una.

### Quién recibe qué

El mismo hecho se comunica distinto según el destinatario, y hoy eso ya está
resuelto para las notificaciones pero no para los documentos:

| Hecho | Arrendatario | Propietario | Corredor |
|---|---|---|---|
| Pago recibido | Comprobante | — | Registro |
| Liquidación | — | Detalle con comisión e IVA | Respaldo |
| Reajuste | Aviso con el cálculo | Aviso informativo | Registro |
| Mora | Aviso de cobro | Aviso de que no se pagó | Alerta |

---

## 7. Comunicaciones que faltan

Ordenadas por riesgo de no tenerlas.

| Comunicación | Por qué | Estado |
|---|---|---|
| **Estado de cuenta de deuda** | Es el documento que exige la demanda monitoria (Ley 21.461): rentas, gastos comunes y consumos adeudados, con forma, fecha y lugar en que se contrajeron | ❌ No existe |
| **Aviso de término / no renovación** | Con los plazos calculados. Preparado por nosotros, notificado por notario | ❌ No existe |
| **Devolución de garantía** | Detalle de retenciones y su motivo. Hoy es una línea de texto | ⚠️ Parcial (Grupo 2) |
| **Aviso de reajuste** | Con el cálculo completo | ❌ Grupo 3 |
| **Comprobante de pago en PDF** | Prueba de la renta | ❌ Solo pantalla |
| **Aviso de cambio de titularidad** | Si la propiedad se vende, el arrendatario debe saber a quién pagar | ❌ No existe |
| **Ejercicio de derechos Ley 21.719** | Acceso, rectificación, supresión y portabilidad de datos personales. Vigente desde el 2026-12-01 | ⚠️ Existe la baja de avisos, no los demás derechos |
| **Baja de comunicaciones** | Art. 28 B Ley 19.496 | ✅ Hecho |

La **Ley 21.719 entra en vigencia el 1 de diciembre de 2026**, con multas de
hasta 20.000 UTM. Tener solo la baja de correos no alcanza: hacen falta los
canales para que una persona pida sus datos, los corrija o los haga borrar. Es
la fecha dura más cercana del proyecto.

## 8. Lo que NO hay que hacer

- **Emitir algo que parezca un DTE.** Sin folios del SII no es una boleta,
  aunque se le parezca.
- **Cobrar IVA sobre la comisión sin saber quién es la corredora.** El caso de
  la persona natural está exento por ley.
- **Prometer que el comprobante sirve «para el SII».** Sirve como respaldo de la
  gestión y como insumo para declarar; el documento tributario lo emite la
  corredora.

---

## 9. Orden sugerido

1. **Ajustes completos en el snapshot** (§5.1) — incluir `descripcion` y la
   lista de ajustes en los dos vouchers. Es lo más barato y desbloquea los tres
   documentos.
2. **`avaluoFiscal` y los datos de la corredora** — campos, sin lógica.
3. **Resolver G-03** y corregir el destinatario de la liquidación (P-GA2).
4. **IVA de la comisión** según naturaleza jurídica de la corredora (§3.3).
5. **Folio legible.**
6. **PDF del comprobante y de la liquidación**, regenerables desde el snapshot
   (§5.2) — no un archivo que se guarda y caduca.
7. **Origen de pago por período** (§5.4): cuánto se espera del arrendatario y
   cuánto de un tercero. Habilita el subsidio y el pago por terceros.
8. **Datos de transferencia en el recordatorio.**
9. **Aviso de reajuste** con el cálculo completo (Grupo 3).
10. **Estado de cuenta de deuda** (§7) — el documento de la demanda monitoria.
11. **Aviso de término** con los plazos calculados (§6).
12. **Derechos de la Ley 21.719** — tiene fecha dura: 1 de diciembre de 2026.
13. **Exportador de la DJ 1835.**

Los primeros cuatro son datos y reglas; el resto se apoya en ellos.

> **La fecha que manda es el 1 de diciembre de 2026** (Ley 21.719). Es la única
> con multa asociada —hasta 20.000 UTM— y hoy solo tenemos la baja de correos.

---

## Fuentes

- SII. *¿Cómo tributan los corredores de propiedades?*
  https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_3147.htm
- SII. *¿Debe ser emitida una boleta por concepto de arriendo?*
  https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_1214.htm
- SII. *¿Cuáles son las obligaciones tributarias por el arriendo de un bien raíz?*
  https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_0776.htm
- SII. *Instrucciones para completar la Declaración Jurada N° 1835 sobre bienes
  raíces arrendados.*
  https://www.sii.cl/ayudas/ayudas_por_servicios/renta/2026/instrucciones_dj1835.pdf
- BCN. *Ley 18.101, fija normas especiales sobre arrendamiento de predios
  urbanos.* https://www.bcn.cl/leychile/navegar?idNorma=29526
- SII. *¿Cuánto tiempo se deben guardar los libros contables?* (Arts. 17 y 200
  del Código Tributario — 6 años).
  https://www.sii.cl/preguntas_frecuentes/declaracion_renta/001_140_4628.htm
- MINVU. *Subsidio de Arriendo D.S. 52 — información para el arrendador.*
  https://www.minvu.gob.cl/beneficio/vivienda/informacion-para-el-arrendador/
- ChileAtiende. *Subsidio de Arriendo de Vivienda.*
  https://www.chileatiende.gob.cl/fichas/29888-subsidio-de-arriendo-de-vivienda
- BCN. *Ley 21.461, «Devuélveme mi casa»* — procedimiento monitorio y
  presunción de renta según los comprobantes de pago.
  https://www.bcn.cl/leychile/Navegar?idNorma=1178004
- BCN. *Ley de arriendo* (guía) — desahucio, plazos de restitución.
  https://www.bcn.cl/portal/leyfacil/recurso/ley-de-arriendo
- Documentos de referencia en `Docs/testFiles/` (Leasity / Fuhrer Group, 2026).
