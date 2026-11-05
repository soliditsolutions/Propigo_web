# Auditoría de mensajes al usuario — 2026-11-05

Alcance: mensajes de error, advertencia e informativos, y reintentos ante fallos
de carga, en `apps/web` (panel, portal, sitio público y marketplace).

**Método**
- Inventario estático: límites de error, sistema de toasts, avisos en línea y
  llamadas de red y de server actions desde componentes cliente. Lo hizo un
  escáner propio que recorre todos los `.tsx` con `"use client"`.
- Verificación en ejecución con el build de producción (`next start` standalone):
  - con la base de datos caída;
  - con el servidor apagado a mitad de una acción.
- Cada hallazgo indica si se **verificó en ejecución** o se **dedujo del código**.
  En la primera pasada, los del panel que dependen de datos no se pudieron
  ejecutar porque Docker estaba apagado.
- **Segunda pasada (misma fecha, con la base arriba)**:
  - Build de producción nuevo.
  - 16 escenarios automatizados con Playwright en Chromium: red cortada,
    respuestas 500, sesión vencida, 404, topes, archivos inválidos y tiempos
    de los toasts.
  - Escáner del lado servidor: rutas API, server actions y bloques `catch`.
  - El resultado está en la matriz de escenarios, más abajo.
  - No se envió ningún correo real: Resend no está configurado en el build y
    el log lo confirma.

## Resumen

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| M-01 | 🔴 Alta | No existe ningún `error.tsx`, `global-error.tsx` ni `not-found.tsx`. Cualquier fallo de servidor muestra la página genérica de Next **en inglés** y sin marca: "This page couldn't load". El 404 también sale en inglés: "This page could not be found" | Ejecución |
| M-02 | 🔴 Alta | Si una server action no llega al servidor, la página completa se reemplaza por esa pantalla genérica y **se pierde lo escrito**. Las causas pueden ser falta de red, un redespliegue, un timeout o un 5xx del proxy. Hay 25 llamadas sin `try/catch` en el cliente, además de todos los formularios con `useActionState` | Ejecución: login con el servidor apagado; Mi Plan sin red y con 500 (E-09, E-10); perfil sin red (E-11) |
| M-03 | 🟠 Media | El login borra **el correo y la contraseña** en cada intento fallido, también con contraseña incorrecta. React 19 resetea los campos no controlados al terminar la acción del formulario. Afecta igual a `recuperar-contrasena` | Ejecución (E-01); código (recuperar) |
| M-04 | 🟠 Media | Los toasts de **error** desaparecen a los 5 s, sin pausa al pasar el mouse ni con el foco (WCAG 2.2.1). Además, cada toast nuevo reinicia el temporizador de los anteriores: `onDismiss` es una función nueva en cada render | Ejecución: un toast siguió visible ~8 s porque llegó otro a los 3 s, y no se pausa con el mouse encima (E-05, E-06) |
| M-05 | 🟠 Media | Fallos silenciosos en Notificaciones: si `enviarNotificacionesPendientes`, `simularEnvioMasivo` o `marcarSimulada` devuelven `ok: false`, no se muestra nada | Código + escáner |
| M-06 | 🟠 Media | Toasts destruidos antes de leerse: Notificaciones muestra el resultado y llama a `window.location.reload()` en la misma línea (`notificaciones-client.tsx:151` y `:167`) | Código |
| M-07 | 🟠 Media | Dispositivos no revisa `res.ok` al cargar. Un 401 o 500 se ve como "no hay dispositivos", no como error. Sin red muestra a la vez "No se pudo cargar la lista" **y** "No hay dispositivos registrados", sin `role="alert"`. No hay botón para reintentar | Ejecución (E-07, E-08) |
| M-08 | 🟡 Baja | Mensajes que culpan al usuario de un fallo nuestro. El login y el registro dicen "Revisa tu conexión" cuando lo que falló es la base de datos. `validacion-panel` dice "Error de conexión" cuando la respuesta no es JSON (por ejemplo un 504) | Ejecución (login) |
| M-09 | 🟡 Baja | Los 429 no llegan al usuario. El portal reemplaza "Demasiadas solicitudes. Intenta en unos minutos" por "No fue posible enviar el código", y ningún cliente usa `Retry-After` para decir cuánto esperar | Código |
| M-10 | 🟡 Baja | Tipos de mensaje mal asignados: | Ejecución (E-05, "Próximamente" en verde con `role=status`); código (el resto) |
| | | • "Próximamente: podrás actualizar tu método de pago" sale como **éxito** (es informativo) | |
| | | • Un error de envío del código de dispositivo sale como **advertencia** (`verificar-form.tsx:224`) | |
| | | • Un envío masivo con éxito parcial sale como **error** (debería ser advertencia) | |
| M-11 | 🟡 Baja | El botón para cerrar el toast mide 20 px con 50 % de opacidad: queda bajo el mínimo de 24 px (WCAG 2.5.8). `qa:mobile` no lo detecta porque los toasts son transitorios | Ejecución (medido: 20×20 px, E-05) |
| M-12 | 🟡 Baja | Diálogo nativo `confirm()` para eliminar todos los dispositivos, distinto del `Modal` del resto de la app | Código |
| M-13 | 🟡 Baja | Solo `/panel` tiene `loading.tsx`. El portal y el sitio público no dan aviso de carga al navegar | Código |
| **Segunda pasada** | | | |
| M-14 | 🔴 Alta | **Sesión vencida + acción = página rota.** Si la sesión expira (por inactividad o por cerrarla en otro dispositivo) y el usuario envía una acción, ve la pantalla genérica en inglés en vez de ir al login. Causa probable: el proxy responde a la acción con un `redirect` a `/login` (`proxy.ts:140/156`) y el cliente de server actions no puede interpretar el HTML del login como respuesta. Es el disparador más frecuente de los encontrados | Ejecución (E-13) |
| M-15 | 🟠 Media | **404 dentro del panel.** Un contrato inexistente responde **HTTP 200** (un 404 "blando") y la página genérica en inglés reemplaza todo el panel: se pierden el menú y la sesión visual. Causa probable: `panel/loading.tsx` empieza el streaming con estado 200 antes de que la página llame a `notFound()` | Ejecución (E-03) |
| M-16 | 🟠 Media | **Foto de perfil: los errores de subida se descartan a propósito** (`perfil-form.tsx:72`, `// upload silenced`). Un archivo no permitido o de más de 5 MB no muestra ningún mensaje: la foto simplemente no cambia | Ejecución (E-14, E-15) |
| M-17 | 🟠 Media | **Errores invisibles en operación.** 47 de 108 bloques `catch` del servidor descartan el error sin registrarlo ni relanzarlo (8 en `perfil/actions.ts`, 4 en `registro`, 3 en `equipo`…). Hay solo 6 `console.error` y ningún servicio de monitoreo. En producción, un fallo inesperado se ve como "Intenta de nuevo" y no deja rastro | Escáner |
| M-18 | 🟡 Baja | **Perfil usa la validación nativa del navegador**: es el único formulario con `required` sin `noValidate`. El aviso sale fuera del diseño y en el idioma del navegador ("Please fill out this field" en un Chromium en inglés). El resto de la app muestra los errores en línea | Ejecución (E-11) |
| M-19 | 🟡 Baja | **4 rutas API sin `try/catch`**: `auth/dispositivos` (GET y DELETE), `auth/dispositivos/[id]` (DELETE) y `panel/contratos/[id]/comentarios` (GET). Si fallan devuelven un 500 sin JSON, y el cliente lo muestra como "error de red" | Escáner |
| M-20 | ℹ️ Diseño | **El tope de códigos del portal (3 por persona en 10 min) es silencioso a propósito**, para que no se pueda saber si un RUT existe. El usuario llega a `/portal/verificar` con un id que no corresponde a ningún código, y la página no le explica qué hacer si el código no llega. Se mantiene el anti-enumeración; falta un texto neutro como "Si no te llega en 2 minutos, revisa spam o espera 10 minutos antes de pedir otro" | Ejecución (E-16: 5 de 5 respondieron 200) |

## Detalle por categoría

### 1. Errores

**Lo que funciona**
- Las validaciones de formulario muestran el error junto al campo, con
  `role="alert"` y `aria-describedby`; el login lo documenta explícitamente.
- Las server actions revisadas devuelven `{ ok: false, error }` con mensajes en
  español y accionables. Por ejemplo, `/no-molestar` captura sus excepciones en
  el servidor.
- Las rutas API con tope responden 429 con `Retry-After`.
- Login con la base caída: la acción captura el fallo y muestra un error en
  línea en vez de romper la página (verificado). El problema es el texto (M-08).

**Qué los gatilla y qué se ve**

| Disparador | Qué ve el usuario hoy |
|---|---|
| Base de datos o servicio caído al renderizar una página: home, marketplace, panel, `getUfCLP` sin datos en producción | Página genérica de Next en inglés con "Reload" (M-01) |
| Ruta o ID inexistente: `notFound()` | 404 genérico en inglés (M-01) |
| Server action que no llega al servidor | Pantalla genérica a página completa y se pierde lo escrito (M-02) |
| Server action que devuelve `ok: false` | Toast de error o error en línea; en Notificaciones, nada (M-05) |
| `fetch` a la API con respuesta no-OK | Toast o error en línea con `data.error`; en Dispositivos, lista vacía (M-07) |
| 429 por tope | Mensaje del servidor, salvo en el portal (M-09) |

### 2. Advertencias
- Toasts de advertencia: 1 uso en todo el código, y además mal asignado (M-10).
- Avisos en línea con `--pgo-warning-lt` en 22 archivos: datos de ejemplo en
  Mi Plan, cupo al 80 %, bloqueo de bajada de plan, intentos de login
  (`WarningBanner`) y otros. Son persistentes y visibles, y funcionan bien.

### 3. Mensajes informativos
- Ningún toast usa el tipo `info` (26 de éxito, 31 de error, 1 de advertencia).
  La información sale como éxito (M-10) o como texto en línea.
- Los avisos de carga solo existen en `/panel` (M-13). Las acciones muestran su
  propio indicador (`pending`, spinner).

### 4. Reintentos

| Dónde | Hay reintento | Comentario |
|---|---|---|
| Páginas del servidor que fallan | Solo el "Reload" genérico de Next | Sin `error.tsx` no hay un `reset()` propio (M-01) |
| Server actions sin red | No | La página se rompe (M-02) |
| Subida de imagen de propiedad | Sí, botón "Reintentar" | Correcto |
| Lista de dispositivos | No | (M-07) |
| Correos de comentarios al arrendatario | Sí, en el servidor | Quedan pendientes y el cron los reintenta |
| Ficha del marketplace | Sí, una vez, en el servidor | Best-effort |
| Webhook de billing | Sí, del proveedor | Responde 500 a propósito |
| Topes 429 | Sin cuenta regresiva | `Retry-After` no se usa en el cliente (M-09) |

No hay reintento automático en el cliente. Es correcto para las mutaciones,
porque reintentar un cobro o un envío puede duplicarlo. Para las lecturas
(GET), el patrón recomendado es un botón "Reintentar" explícito.

## Matriz de escenarios en ejecución (segunda pasada)

Build de producción, Chromium 1280×860, base local con el seed.

| ID | Disparador | Qué ve el usuario | Veredicto |
|---|---|---|---|
| E-01 | Login con contraseña incorrecta | "Correo o contraseña incorrectos.", pero el correo y la contraseña quedan vacíos | ❌ M-03 |
| E-03 | `/panel/contratos/<id inexistente>` o con un id inválido | HTTP 200 + "404 This page could not be found." a pantalla completa, sin el panel | ❌ M-15 |
| E-05 | Dos toasts separados por 3 s | El primero dura ~8 s; el botón de cierre mide 20×20 px; "Próximamente" sale en verde | ❌ M-04, M-10, M-11 |
| E-06 | Mouse sobre un toast 6 s | Se cierra igual | ❌ M-04 |
| E-07 | La API de dispositivos responde 500 | "No hay dispositivos registrados." | ❌ M-07 |
| E-08 | La API de dispositivos sin red | "No se pudo cargar la lista…" junto con "No hay dispositivos registrados." Sin reintentar | ❌ M-07 |
| E-09 | Mi Plan: acción sin red | Pantalla genérica en inglés; se pierde la selección | ❌ M-02 |
| E-10 | Mi Plan: la acción recibe un 500 | Pantalla genérica en inglés | ❌ M-02 |
| E-11 | Guardar perfil sin red (`useActionState`) | Pantalla genérica en inglés; se pierde lo editado. Antes de enviar, el RUT vacío dispara la validación nativa en inglés | ❌ M-02, M-18 |
| E-12 | Navegar del panel a Contratos sin red | Next pasa a una navegación completa del navegador y la página carga | ✅ |
| E-13 | Sesión vencida y luego una acción | Pantalla genérica en inglés, sin llevar al login | ❌ M-14 |
| E-14 | Foto de perfil `.exe` | Ningún mensaje | ❌ M-16 |
| E-15 | Foto de perfil de 6 MB | Ningún mensaje | ❌ M-16 |
| E-16 | 5 solicitudes de código del portal seguidas | Todas 200; desde la 4.ª, el código no se envía y nada lo explica | ℹ️ M-20 |

Con la base caída (primera pasada):
- La portada y el marketplace muestran la pantalla genérica en inglés (M-01).
- El login muestra un error en línea, pero el texto culpa a la conexión del
  usuario (M-08).

## Controles que funcionan bien

- **Validación de campos:** en login, registro, recuperar y nueva contraseña
  los errores salen junto al campo, con `role="alert"` y `aria-describedby`.
- **Mensajes de las acciones:**
  - Los `DomainError` se convierten en mensajes en español.
  - Nunca se devuelve al cliente un `err.message` ni un stack de un error
    inesperado: 16 sitios revisados, todos filtran por `instanceof DomainError`.
- **Respuestas de las rutas API:**
  - Forma consistente: 96 respuestas con `{ error }` y 3 con `{ ok: false, error }`.
  - Ningún texto en inglés.
  - 429 con `Retry-After`.
- **Sin efectos a medias:**
  - Las acciones que fallan no dejan cambios parciales: la base quedó intacta
    tras E-09, E-10 y E-11.
  - El tope de 3 solicitudes de cambio de plan por hora no se consume con
    intentos inválidos.
- **Navegación:** sin red, el panel cae a una navegación completa en vez de
  romperse (E-12).

## Plan de corrección propuesto

**Prioridad 1: que ningún error rompa la página (M-01, M-02, M-14, M-15)**
- **Páginas de error propias:**
  - `app/global-error.tsx`, `app/error.tsx` y `app/not-found.tsx`, en
    español, con la marca y un botón "Reintentar" (`reset()`).
  - `error.tsx` y `not-found.tsx` en `/panel` y `/portal`, para que el
    error quede dentro del menú.
- **404 con estado HTTP correcto:** verificar el contrato antes de que empiece
  el streaming, o resolver el `notFound()` fuera del límite de
  `loading.tsx`. Hay que confirmarlo con la documentación de Next 16 del
  proyecto antes de elegir.
- **Acciones sin red:** un helper `ejecutarAccion()` para las 25 llamadas de
  transiciones, más un manejo equivalente para los formularios con
  `useActionState`. Ante un fallo de red muestra "No pudimos conectar. Tus
  datos siguen en el formulario." y no rompe la página.
- **Sesión vencida:** que el proxy responda a las server actions sin sesión con
  algo que el cliente sepa interpretar (por ejemplo un 401), y que el helper lo
  convierta en "Tu sesión expiró" con un enlace al login. Antes de implementarlo
  hay que confirmar la causa exacta de M-14.

**Prioridad 2: que todo error se vea y quede registrado**
- M-03: el formulario conserva lo escrito (valores por defecto desde el estado
  de la acción o inputs controlados).
- M-04: los errores no se cierran solos, o se pausan con el mouse o el foco;
  temporizador estable por toast.
- M-05 a M-07 y M-16: mostrar el `ok: false`, avisar el resultado antes de
  recargar, revisar `res.ok` en Dispositivos (con reintento) y mostrar el
  error de la subida de foto.
- M-17: un `registrarError(contexto, err)` en los 47 `catch` silenciosos
  (consola estructurada hoy; servicio de monitoreo al desplegar).
- M-19: `try/catch` y JSON de error en las 4 rutas.

**Prioridad 3: textos y pulido**
- M-08 a M-13, M-18 y M-20: textos, tipos de mensaje, botón de cierre de 24 px,
  `Modal` en vez de `confirm()`, `loading.tsx` en el portal, `noValidate`
  en perfil y la ayuda neutra en `/portal/verificar`.

**Pruebas**
- Vitest:
  - helper de acciones: un fallo de red da error y no excepción; una sesión
    vencida da el aviso;
  - toasts: tiempo y pausa;
  - Dispositivos: un 500 da error y reintento;
  - subida: un archivo inválido da mensaje;
  - `registrarError`.
- Repetir `audit-errores.mjs` (los escenarios E-01 a E-16) contra el build de
  producción: todos deben quedar en ✅. Conviene llevarlo al repositorio como
  `npm run qa:errores`, igual que `qa:mobile`.
- `qa:mobile` para revisar el layout de las páginas de error nuevas.
