# ADR-0016 — IA externa: Cloudflare Workers AI

- **Estado:** aceptada, 2026-11-12.
- **Reemplaza en parte a:** [ADR-0012](ADR-0012-identidad-libreria-y-ia-contrato-externa.md), solo en el proveedor de IA (Groq).
- **Análisis y números:** [analisis-ia-proveedores-2026-11.md](../gestion/analisis-ia-proveedores-2026-11.md).

## Contexto

La plataforma usa IA externa en dos puntos: leer el RUN y el nombre de la cédula al registrarse (visión) y revisar un
borrador de contrato (texto). Groq apagó los dos modelos que usábamos para planes gratis y developer (Llama 4 Scout el
2026-07-17 y Llama 3.3 70B el 2026-08-16), así que con una clave gratuita fallaban ambos flujos. El QR de la cédula se
descartó como verificación: lleva a una consulta del Registro Civil protegida por captcha.

## Decisión

1. **Cloudflare Workers AI como único proveedor**, con los mismos modelos: Llama 4 Scout (cédula) y Llama 3.3 70B
   (contratos). Cuota gratis de 10.000 neuronas al día; sobre eso, US$ 0,011 por 1.000 neuronas con el plan Workers Paid.
2. **Un solo cliente** (`apps/web/src/lib/ia/cloudflare.ts`). Cambiar de modelo es una variable; cambiar de proveedor es
   editar ese archivo.
3. **Prompts fijos en inglés, escritos a mano, con respuesta en español.** El documento del usuario no se traduce en
   cada petición: un traductor externo cuesta casi lo mismo que lo que ahorra y puede torcer términos jurídicos.
4. **Costo bajo control:** foto de la cédula reducida (1.280 px, sin metadatos), salida acotada, registro de cada llamada
   en `uso_ia` y tope diario de neuronas que reserva el 30 % al registro, para que las revisiones no dejen a nadie sin
   verificar su cédula.
5. **Anti-inyección en capas:** reglas de sistema, marcadores falsos neutralizados, esquema estricto de salida y
   reemplazo de leyes citadas que no estén en nuestra lista. El modelo no tiene herramientas.
6. **No activar AI Gateway con registro ni caché:** guardarían el contenido y romperían la retención cero.

## Consecuencias

- Un destinatario menos que declarar (Cloudflare reemplaza a Groq); la transferencia internacional sigue, con retención cero
  y sin entrenamiento según su documentación. Textos de privacidad y de consentimiento actualizados, pendientes de revisión
  del abogado.
- La cuota gratis es única para toda la cuenta: si se agota, fallan registro y revisiones hasta las 00:00 UTC. Pasar a
  Workers Paid (US$ 5 al mes) y subir `IA_NEURONAS_DIA` evita el corte.
- Autenticidad de la cédula: este flujo solo prueba que la imagen dice ese RUN. Verificar a la persona con el Registro
  Civil, selfie y prueba de vida queda para un nivel posterior con un proveedor de KYC.
- El híbrido con Groq quedó evaluado y descartado por ahora: el ahorro era de centavos y suma un proveedor más.
