# Proveedor de IA: Groq vs Cloudflare Workers AI

> _2026-11-12._ Documentación leída ese día: precios, límites y uso de datos de Workers AI; límites, modelos y
> deprecaciones de Groq. Las cifras de uso son **estimaciones mías** (ver §5); nada se probó contra la API real.

## 1. Hallazgo que cambia la decisión: los dos modelos que usamos ya no existen en Groq gratis

| Flujo | Modelo en el código | Estado en Groq (docs oficiales) |
|---|---|---|
| Verificación de cédula al registrarse (`registro/actions.ts`) | `meta-llama/llama-4-scout-17b-16e-instruct` | **Apagado el 2026-07-17** para planes gratis y developer |
| Revisión de contrato con IA (`api/contratos/[id]/validar-doc/route.ts`) | `llama-3.3-70b-versatile` | **Apagado el 2026-08-16**; hoy solo con contrato Enterprise |

Groq recomienda `openai/gpt-oss-120b` o `qwen/qwen3.6-27b` como reemplazo. Su plan gratis hoy limita
`gpt-oss-120b` a 8 K tokens por minuto, 200 K por día y 1 K peticiones por día. Con una clave gratuita de Groq,
**ambos flujos fallarían hoy** con error del proveedor. La decisión «usar el plan gratuito de Groq» (2026-11-12)
no se puede cumplir con los modelos actuales: hay que migrar de modelo de todas formas.

## 2. Workers AI: lo que dice la documentación

- **Gratis:** 10.000 neuronas por día, sin tarjeta, renovadas a las 00:00 UTC (≈ 21:00 en Chile en verano). Al agotarlas
  las peticiones **fallan** hasta el día siguiente.
- **Pago:** US$ 0,011 por 1.000 neuronas sobre lo gratis. Requiere el plan Workers Paid (mínimo **US$ 5 al mes**,
  de la página de precios de Workers).
- **Los dos modelos están:** `@cf/meta/llama-4-scout-17b-16e-instruct` (visión, contexto 131 K, US$ 0,27 / 0,85 por
  millón de tokens de entrada / salida) y `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (US$ 0,293 / 2,253). Ninguno
  figura en la lista de modelos que exigen plan de pago.
- **Límites de tasa:** 300 peticiones por minuto en generación de texto. Sobra para nuestro volumen.
- **Datos:** retención cero de entradas y salidas, sin entrenamiento con contenido del cliente. Excepción: si se
  activa el registro o caché de AI Gateway o se escribe contenido en los logs, ese contenido sí queda guardado.
- **Integración:** acepta el endpoint compatible con OpenAI (`/ai/v1/chat/completions`), así que el cambio es la URL
  base y la autenticación (token y ID de cuenta de Cloudflare).

## 3. Costo por uso

| Operación | Tokens (estimados) | Neuronas | US$ |
|---|---|---|---|
| Verificar una cédula | 1.750 de entrada (imagen + instrucciones) y 50 de salida | ≈ 47 (35 a 95) | ≈ 0,0005 |
| Revisar un contrato, típico | 7.000 de entrada (instrucciones ≈ 4.000 + contrato ≈ 3.000) y 700 de salida | ≈ 330 | ≈ 0,0036 |
| Revisar un contrato, máximo | 9.700 de entrada (el código corta el texto en 20.000 caracteres) y 1.024 de salida | ≈ 470 | ≈ 0,0052 |

**Lo gratis alcanza para**, por día: ≈ 210 verificaciones de cédula, o ≈ 30 revisiones de contrato típicas (21 en el
peor caso), o una mezcla.

## 4. Proyección con poca concurrencia

Supuestos: cada registro hace 1,3 verificaciones (30 % de reintentos por foto ilegible) y una revisión cuesta 330 neuronas.

| Escenario (por día) | Registros | Revisiones | Neuronas | % de lo gratis | Costo al mes |
|---|---|---|---|---|---|
| Bajo (primeras semanas) | 2 | 5 | ≈ 1.800 | 18 % | **US$ 0** |
| Medio | 8 | 20 | ≈ 7.100 | 71 % | **US$ 0** |
| Alto | 20 | 60 | ≈ 21.000 | 210 % | ≈ US$ 9 (5 de base + 3,6 de exceso) |
| Pico | 40 | 150 | ≈ 52.000 | 520 % | ≈ US$ 19 |

**Lo que domina el gasto es la revisión de contratos, no el registro.** Y el tope de los planes la acota: el plan
Gratuito da 1 revisión al día por cuenta, así que **30 cuentas gratuitas usando su cupo completo ya consumen el 100 %
de las neuronas gratis** (30 × 330 = 9.900). Si la base crece más rápido que eso, hay que pagar Workers AI.

**El riesgo real no es el costo sino el corte:** el cupo gratis es por cuenta de Cloudflare, no por cliente. Si lo
agotan las revisiones de la tarde, **los registros de la noche fallan** (la verificación de cédula usa la misma bolsa).

## 5. Qué no pude verificar

- **Tokens de la imagen de la cédula:** Cloudflare no lo detalla en las páginas que leí; usé 1.250 a 3.250 como rango.
- **Tokens del prompt del sistema:** medí ≈ 13.900 caracteres y asumí ≈ 3,5 caracteres por token (≈ 4.000 tokens).
- **Compatibilidad exacta** de `response_format: json_object` y de imágenes en `image_url` con el endpoint de Cloudflare.
- **Calidad:** la variante `fp8-fast` de Llama 3.3 70B está cuantizada; puede revisar peor que la de Groq. Hay que
  comparar con contratos de muestra antes de apagar lo anterior.
- **Región de procesamiento:** la documentación no fija dónde se ejecuta la inferencia. Es una transferencia
  internacional más, igual que con Groq (EE.UU.): hay que declararla.

## 6. Recomendación

1. **Migrar a Workers AI**, porque lo exige el apagado de Groq y porque cubre ambos flujos con los mismos modelos y
   retención cero. Costo esperado de los primeros meses: **US$ 0**.
2. **Un solo módulo `lib/ia.ts`** que reemplace los dos `fetch` directos, con la URL base y el modelo en variables.
   Cambiar de proveedor después sería editar variables.
3. **Tope diario propio** (por ejemplo 70 % de las neuronas gratis para revisiones) para que las revisiones no dejen
   sin verificación de cédula a quien se registra.
4. **Tener lista la tarjeta de Workers Paid** (US$ 5 al mes) para pasar al pago sin cambiar código el día que el uso
   supere lo gratis.
5. **Actualizar los textos legales:** privacidad (§ destinatarios), `registro-tratamiento.ts`, y los avisos de
   consentimiento de IA en el registro y en la revisión de contratos (hoy nombran a Groq). Sujeto a revisión del abogado.
6. **No activar** registro ni caché de AI Gateway, ni escribir contenido de la IA en los logs.
7. **Probar antes de cambiar:** 10 a 20 contratos de muestra sin datos personales y cédulas de prueba con consentimiento.

Esfuerzo estimado de la migración: 1 a 1,5 días, incluidas pruebas, variables de entorno, `startup-check` y textos.

## 7. Fuentes (leídas 2026-11-12)

- developers.cloudflare.com/workers-ai/get-started/rest-api/
- developers.cloudflare.com/workers-ai/platform/pricing/ · /platform/limits/ · /platform/data-usage/
- developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/
- developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- developers.cloudflare.com/workers/platform/pricing/
- console.groq.com/docs/rate-limits · /docs/models · /docs/deprecations

## 8. ¿Híbrido? (evaluado 2026-11-12)

Costo por operación con los mismos supuestos de §3 (revisión: 7.000 tokens de entrada y 700 de salida; cédula: imagen
+ instrucciones). Precios de las páginas oficiales leídas ese día.

| Caso | Opción | US$ por operación | Nota |
|---|---|---|---|
| Revisión de contrato | Groq `gpt-oss-120b` | 0,0015 | Plan gratis: 8 K tokens/min, 200 K/día ⇒ 1 por minuto, ≈ 25 al día |
| | Cloudflare `gpt-oss-120b` (el mismo modelo) | 0,0030 | ≈ 36 al día gratis |
| | Cloudflare Llama 3.3 70B | 0,0036 | ≈ 30 al día gratis |
| | Cloudflare Qwen3-30B-A3B | 0,0006 | ≈ 186 al día gratis; calidad en español jurídico sin probar |
| Cédula (visión) | Cloudflare Llama 4 Scout | 0,0005 | El modelo que ya usamos |
| | Groq `qwen3.8-27b` (único con visión disponible; cada imagen cuenta 2.048 tokens) | 0,0020 | Plan gratis: ≈ 3 por minuto, ≈ 85 al día |

- **La premisa estaba al revés en costo:** en texto es Groq el más barato y en imágenes lo es Cloudflare. El híbrido por
  precio sería texto en Groq y cédula en Cloudflare.
- **El ahorro es chico:** con 8 registros y 20 revisiones al día, todo en Cloudflare cuesta ≈ US$ 2,3 al mes en tokens
  y el híbrido ≈ US$ 1,0; con 20 y 60, ≈ US$ 6,9 contra ≈ US$ 3,0. Pesa más la **calidad** que el precio.
- **Ventaja real del híbrido:** cada proveedor tiene su propia cuota gratis, así que las revisiones de contrato no
  pueden dejar sin verificación de cédula a quien se registra (el riesgo de §4).
- **`gpt-oss-120b` está en ambos proveedores:** la revisión de contratos puede conmutar de uno a otro con las mismas
  instrucciones si uno cae o se acaba su cuota. La cédula no (solo Cloudflare tiene un modelo de visión probado).
- **Costos del híbrido:** dos cuentas, dos claves, dos fallas posibles y dos destinatarios que declarar en privacidad.
- **Datos:** Groq no retiene por defecto, pero puede guardar entradas y salidas hasta 30 días por confiabilidad o abuso;
  hay que **activar Zero Data Retention en sus Data Controls**. Datos retenidos en EE.UU. Cloudflare: retención cero.
- **Descartado:** el nivel gratis de Gemini, porque su contenido «se usa para mejorar los productos de Google» (el
  nivel de pago no). Los contratos y las cédulas no deben ir ahí.
- **Sin verificar:** `gpt-oss` es un modelo de razonamiento y sus tokens de razonamiento cuentan como salida, así que el
  costo real puede ser mayor al estimado; el soporte de JSON y de imágenes en el endpoint de Cloudflare; la calidad de
  cualquiera con nuestros contratos y cédulas.
- **Otra opción para la cédula:** leer el código de barras o la zona legible por máquina de la cédula en nuestro
  servidor, sin enviar la imagen a ningún tercero. Reduce la transferencia internacional de un dato sensible; su
  precisión con fotos de celular no está probada.
