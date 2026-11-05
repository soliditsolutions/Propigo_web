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
  Los del panel que dependen de datos no se pudieron ejecutar: Docker estaba
  apagado durante la auditoría.

## Resumen

| # | Severidad | Hallazgo | Evidencia |
|---|---|---|---|
| M-01 | 🔴 Alta | No existe ningún `error.tsx`, `global-error.tsx` ni `not-found.tsx`. Cualquier fallo de servidor muestra la página genérica de Next **en inglés** y sin marca: "This page couldn't load". El 404 también sale en inglés: "This page could not be found" | Ejecución |
| M-02 | 🔴 Alta | Si una server action no llega al servidor, la página completa se reemplaza por esa pantalla genérica y **se pierde lo escrito**. Las causas pueden ser falta de red, un redespliegue, un timeout o un 5xx del proxy. Hay 25 llamadas sin `try/catch` en el cliente, además de todos los formularios con `useActionState` | Ejecución (login con el servidor apagado) + escáner |
| M-03 | 🟠 Media | El login borra el correo en cada intento fallido, también con contraseña incorrecta. React 19 resetea los campos no controlados al terminar la acción del formulario. Afecta igual a `recuperar-contrasena` | Ejecución (login); código (recuperar) |
| M-04 | 🟠 Media | Los toasts de **error** desaparecen a los 5 s, sin pausa al pasar el mouse ni con el foco (WCAG 2.2.1). Además, cada toast nuevo reinicia el temporizador de los anteriores: `onDismiss` es una función nueva en cada render | Código |
| M-05 | 🟠 Media | Fallos silenciosos en Notificaciones: si `enviarNotificacionesPendientes`, `simularEnvioMasivo` o `marcarSimulada` devuelven `ok: false`, no se muestra nada | Código + escáner |
| M-06 | 🟠 Media | Toasts destruidos antes de leerse: Notificaciones muestra el resultado y llama a `window.location.reload()` en la misma línea (`notificaciones-client.tsx:151` y `:167`) | Código |
| M-07 | 🟠 Media | Dispositivos no revisa `res.ok` al cargar. Un 401 o 500 se ve como "no hay dispositivos", no como error. Tampoco tiene botón para reintentar | Código |
| M-08 | 🟡 Baja | Mensajes que culpan al usuario de un fallo nuestro. El login y el registro dicen "Revisa tu conexión" cuando lo que falló es la base de datos. `validacion-panel` dice "Error de conexión" cuando la respuesta no es JSON (por ejemplo un 504) | Ejecución (login) |
| M-09 | 🟡 Baja | Los 429 no llegan al usuario. El portal reemplaza "Demasiadas solicitudes. Intenta en unos minutos" por "No fue posible enviar el código", y ningún cliente usa `Retry-After` para decir cuánto esperar | Código |
| M-10 | 🟡 Baja | Tipos de mensaje mal asignados: | Código |
| | | • "Próximamente: podrás actualizar tu método de pago" sale como **éxito** (es informativo) | |
| | | • Un error de envío del código de dispositivo sale como **advertencia** (`verificar-form.tsx:224`) | |
| | | • Un envío masivo con éxito parcial sale como **error** (debería ser advertencia) | |
| M-11 | 🟡 Baja | El botón para cerrar el toast mide 20 px con 50 % de opacidad: queda bajo el mínimo de 24 px (WCAG 2.5.8). `qa:mobile` no lo detecta porque los toasts son transitorios | Código |
| M-12 | 🟡 Baja | Diálogo nativo `confirm()` para eliminar todos los dispositivos, distinto del `Modal` del resto de la app | Código |
| M-13 | 🟡 Baja | Solo `/panel` tiene `loading.tsx`. El portal y el sitio público no dan aviso de carga al navegar | Código |

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

## Plan de corrección propuesto

**Prioridad 1 (M-01, M-02)**
- `app/global-error.tsx`, `app/error.tsx` y `app/not-found.tsx` en español, con
  la marca y un botón "Reintentar" que use `reset()`.
- `error.tsx` propios para `/panel` y `/portal`, para que el error quede dentro
  del shell y no se pierda la navegación.
- Un helper `ejecutarAccion()` para el cliente que capture el fallo de red de
  las 25 llamadas y lo convierta en un error en línea o un toast: "No pudimos
  conectar. Tus datos siguen en el formulario. Reintenta."
- Alternativa a ese helper: `try/catch` en cada llamada. Es más simple de leer,
  pero son 25 copias del mismo bloque.

**Prioridad 2**
- M-03: valores por defecto desde el estado de la acción, o inputs controlados.
- M-04: los errores no se cierran solos, o duran 10 s con pausa al pasar el
  mouse o con el foco. Además, temporizador estable por toast.
- M-05 a M-07: mostrar el `ok: false`, avisar del resultado antes del reload
  (o no recargar) y revisar `res.ok` en Dispositivos, con un botón de reintento.

**Prioridad 3**
- M-08 a M-13: textos, tipos de mensaje, tamaño del botón de cierre, `Modal` en
  vez de `confirm()` y `loading.tsx` en el portal.

**Pruebas**
- Vitest para:
  - el helper de acciones (fallo de red → error, no excepción);
  - los toasts (un error no se cierra solo o se pausa; el temporizador no se
    reinicia);
  - Dispositivos (un 500 muestra error y reintento).
- En el navegador: repetir esta auditoría con la base caída y con el servidor
  apagado.
- `qa:mobile` para revisar el layout de las páginas de error.
