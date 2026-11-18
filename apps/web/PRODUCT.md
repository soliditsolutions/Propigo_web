# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Corredores de propiedades en Chile**, personas naturales o empresas (SpA, Ltda., EIRL), que administran arriendos de terceros y entran al panel casi todos los días. Entran desde escritorio y desde el teléfono, con prisa y con dinero y contratos ajenos de por medio.
- **Colaboradores** de una corredora, invitados por su Manager (no se registran solos).
- Arrendatarios y propietarios usan un portal aparte con código por correo: no pasan por estas pantallas.

Estas pantallas (iniciar sesión, recuperar contraseña, crear cuenta) son la puerta del producto. Quien llega a `/registro` aún no conoce Propigo por dentro.

## Product Purpose

Propigo (propigo.cl, «Publica más. Complica menos.») es un SaaS para administrar arriendos en Chile: contratos, calendario de pagos mes a mes, reajuste por UF e IPC, comprobantes y liquidaciones que no se pueden alterar, y publicación de propiedades en un catálogo público. El éxito de estas pantallas es que el corredor entre sin fricción y que quien se registra termine con su cuenta creada y confíe en lo que le pedimos (incluida la cédula).

## Positioning

Hecho para el arriendo chileno: UF e IPC, RUT con dígito verificador, Ley 18.101 y Ley 21.461 en la revisión de contratos, y la Ley 21.719 de datos personales cumplida desde el diseño. Un software genérico de gestión no trae esto.

## Operating Context

- Registro abierto con **plan Gratuito acotado**: 1 propiedad, 1 usuario, 1 revisión de IA al día, sin exportar, y solo recordatorios de pago por correo. Sin tarjeta de crédito.
- Al registrarse se verifica la identidad con una foto de la Cédula de Identidad (cámara o archivo). La foto se reduce, se envía a un proveedor de IA (Cloudflare Workers AI) para leer el RUN y el nombre, y no se guarda. Requiere consentimiento explícito aparte del de los términos.
- Un dispositivo nuevo pide un código de 6 dígitos enviado al correo.
- Tras varios intentos fallidos la cuenta se bloquea por 5 minutos y luego por 1 hora.
- La recuperación de contraseña responde igual exista o no la cuenta (anti-enumeración); el enlace vale 15 minutos y se usa una vez.
- Temas claro y oscuro (Aurora), elegidos por la persona.

## Capabilities and Constraints

- Next.js 16 (App Router, React 19), CSS con tokens `--pgo-*` en `globals.css`, tema `aurora-dark` / `aurora-light`, logo en SVG (`components/public/Logo.tsx`).
- Textos de producto en español de Chile; la marca, el eslogan y los correos salen de `lib/marca.ts`, nunca escritos a mano.
- SOLID IT SpA es la razón social: aparece solo en legales y pie de página, nunca en el logo.
- Funciones que no se tocan: validaciones y mensajes de seguridad (bloqueo por intentos, anti-enumeración, medidor de fortaleza de contraseña), validación de RUT, verificación de cédula, verificación de dispositivo, interruptor `REGISTRO_ABIERTO`.

## Brand Commitments

- Nombre **Propigo**, eslogan «Publica más. Complica menos.», isotipo de casa con forma de «P» y wordmark «propi» + «go».
- **Voz confirmada: tú cercano y claro.** Frases cortas, sin jerga, sin signos de exclamación ni emojis, sin promesas de marketing. Se explica el porqué de cada pedido sensible.
- Identidad visual existente: tema Aurora (marino, azul de marca, cian e índigo, vidrio esmerilado).

## Evidence on Hand

- Solo **hechos del producto**: calendario de pagos, reajuste IPC, comprobantes inalterables, revisión de contratos con IA, cumplimiento de la Ley 21.719.
- **No hay** cifras de uso, testimonios, logos de clientes ni reseñas reales. Ninguna pantalla debe mostrar cifras, citas o clientes inventados; las vistas de demostración van rotuladas como ejemplo.
- Imágenes existentes en `src/images/` (fotos de banner). El logo vectorial definitivo es un pendiente de gerencia.

## Product Principles

1. **Confianza antes que espectáculo.** El corredor maneja dinero y contratos de otras personas: lo seguro se nota en la claridad, no en el adorno.
2. **Explicar el porqué de lo sensible.** La cédula, el bloqueo de cuenta y la verificación de dispositivo se presentan con una razón, en lenguaje llano.
3. **Entrar rápido.** Quien llega todos los días no debe esperar movimiento ni leer de más.
4. **Nada inventado.** Prueba social solo si es real y está firmada.
5. **Funciona en claro y en oscuro, en teléfono y en escritorio.**

## Accessibility & Inclusion

WCAG 2.1 AA como mínimo: contraste, foco visible, teclado completo, etiquetas y errores asociados, `prefers-reduced-motion` respetado. Texto legible en el tema claro con la misma calidad que en el oscuro.
