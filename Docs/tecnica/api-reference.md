# Referencia de la API

Contrato de los **Route Handlers** HTTP de `apps/web/src/app/api/`. 

> **Importante:** la mayoría de las **mutaciones del panel** (crear/editar propiedades y contratos, conciliar pagos, cerrar liquidaciones, terminar/renovar contratos, generar documentos) se implementan como **Server Actions**, no como endpoints REST — por eso no aparecen aquí. Esta referencia cubre las rutas que **sí** requieren HTTP: descargas de archivos, formularios públicos, autenticación, cron externo y validación con IA.

## Convenciones

- **Base URL (dev):** `http://localhost:3000`
- **Formato:** JSON (salvo descargas de archivos, que devuelven el binario).
- **Autenticación:** por cookie de sesión firmada (JWT):
  - `pgo_session` — sesión del corredor (panel).
  - `pgo_portal` — sesión de arrendatario/propietario (portal, solo lectura, 30 min).
  - `pgo_device` — token de dispositivo confiable (2FA).
- **Errores:** forma uniforme `{ "error": "mensaje genérico" }`. Nunca se exponen detalles internos (Prisma/stack).
- **Códigos:** `200` OK · `303` redirect (logout) · `400` datos inválidos · `401` no autenticado · `403` sin acceso · `404` no encontrado · `422` validación · `429` rate limit · `500` error de servidor.

---

## Autenticación — Panel (corredor)

### `POST /api/auth/logout`
Cierra la sesión del corredor. Borra las cookies `pgo_session` y `pgo_device`, envía `Clear-Site-Data` y redirige (`303`) a `/login`.
- **Auth:** sesión activa. · **Respuesta:** `303 → /login`.

### `POST /api/auth/dispositivo/enviar`
Genera y envía por email un código de 6 dígitos para verificar el dispositivo actual (2FA). Código con TTL 10 min, máx. 3 intentos.
- **Auth:** sesión `pgo_session` sin dispositivo verificado. · **Respuesta:** `200 { ok: true }`.

### `POST /api/auth/dispositivo/confirmar`
Valida el código, crea el registro `DispositivoConfiable` (guarda `SHA-256` del token, nunca en claro), setea la cookie `pgo_device` y refresca el JWT con `deviceToken`.
- **Body:** `{ codigo: string }` · **Respuesta:** `200 { ok: true }` · `400` código inválido/expirado.

### `GET /api/auth/dispositivos`
Lista los dispositivos confiables del usuario. · **Auth:** `pgo_session` verificada.
### `DELETE /api/auth/dispositivos`
Revoca **todos** los dispositivos y fuerza re-verificación (borra `pgo_session` + `pgo_device`).
### `DELETE /api/auth/dispositivos/[id]`
Revoca **un** dispositivo. Si es el actual, fuerza re-verificación (`{ relogin: true }`).

---

## Portal de autoconsulta (arrendatario / propietario)

### `POST /api/portal/solicitar-otp`
Solicita un código OTP para acceder al portal. **Anti-enumeración (ADR-0007):** responde idéntico exista o no el RUT; timing uniforme.
- **Body:** `{ rut: string }` (RUT canónico, sin puntos).
- **Respuesta:** `200 { ok: true, otpId }` (siempre, aunque el RUT no exista). El código se envía al contacto registrado (email).

### `POST /api/portal/verificar-otp`
Valida el OTP y abre una **sesión de solo lectura** (`pgo_portal`, 30 min, firmada con `"portal:" + AUTH_SECRET`).
- **Body:** `{ otpId: string, codigo: string }`.
- **Respuesta:** `200 { ok: true }` + cookie `pgo_portal` · `400` código inválido · `429` máx. intentos.

### `GET /api/portal/logout`
Cierra la sesión del portal (borra `pgo_portal`).

### `GET /api/portal/documento/[id]`
Descarga autenticada de un documento del arriendo (contrato, anexo, comprobante, voucher).
- **Auth:** sesión `pgo_portal`. Verifica que el documento pertenezca al contrato/persona de la sesión (3 rutas de acceso: `contratoId`, `periodoId`, `comentarioId`).
- **Seguridad:** registra en `acceso_log`; `Content-Disposition: attachment`; `Cache-Control: no-store, private`; `X-Content-Type-Options: nosniff`.
- **Respuesta:** binario del archivo · `403` sin acceso · `404` no encontrado.

---

## Documentos — Panel

### `GET /api/documentos/[id]`
Descarga de un documento desde el panel del corredor.
- **Auth:** sesión `pgo_session`; verifica `tenantId`. · **Respuesta:** binario · `403`/`404`.

### `POST /api/upload`
Sube una imagen de propiedad. Valida **MIME por magic bytes** (JPEG/PNG/WebP/GIF), tamaño ≤ 5 MB; genera nombre UUID y guarda en `UPLOADS_PATH` (`public/uploads/propiedades/`).
- **Auth:** requiere tenant válido (`503` si no). · **Body:** `multipart/form-data` (archivo).
- **Respuesta:** `200 { url: "/uploads/propiedades/<uuid>.<ext>" }` · `400` tipo/tamaño inválido.

---

## Marketplace (público, sin auth)

### `POST /api/marketplace/contacto`
Formulario de contacto desde la ficha de una publicación. Crea `ConsultaContacto` y genera un **token de valoración** de un solo uso. Notifica al corredor.
- **Body:** `{ publicacionId, nombre, apellido, telefono, email, titulo, descripcion, viaEmail, viaTelefono }`.
- **Respuesta:** `200 { ok: true }` · `422` validación.

### `POST /api/marketplace/denuncia`
Denuncia de una propiedad o corredor (anónima o identificada). Cumple Ley 21.719 y Art. 211 CP (declaración de veracidad obligatoria).
- **Body:** `{ tipo, objetivo, publicacionId?, nombreCorredor?, descripcion, evidenciaDescripcion?, esAnonima, nombreDenunciante?, ..., declaraVeracidad, aceptaTratamientoDatos }`.
- **Respuesta:** `200 { ok: true }` · `422` faltan consentimientos.

### `POST /api/marketplace/valoracion`
Envía una valoración (1–5 estrellas) del corredor usando el **token de un solo uso** del contacto/contrato. El token se quema al valorar.
- **Body:** `{ token, estrellas, comentario?, nombre?, apellido? }`.
- **Respuesta:** `200 { ok: true }` · `400` token inválido/ya usado.

### `GET /api/marketplace/valoraciones/[tenantId]`
Lista las valoraciones **visibles** de un corredor (para su panel público).
- **Respuesta:** `200 [{ estrellas, comentario, nombre, createdAt }]`.

---

## Panel — Comentarios al arrendatario

### `GET /api/panel/contratos/[id]/comentarios`
Lista los comentarios que el corredor dejó en el portal del arrendatario para ese contrato.
- **Auth:** `pgo_session` (verifica `tenantId`).

### `POST /api/panel/contratos/[id]/comentarios`
Crea un comentario (mensaje) para el arrendatario, con documentos adjuntos opcionales. Dispara notificación por email + registro en `Notificacion`.
- **Body:** `{ texto: string (1–2000), documentoIds?: string[] (máx 5) }`.
- **Respuesta:** `200 { ok: true, id }` · `404` contrato no encontrado.

---

## Cron / automatización

### `GET /api/cron/recordatorios`
Genera los recordatorios pendientes y envía los emails para **todos los tenants** activos (cadencia ADR-0008: 5 días antes, día de vencimiento, 3 después). Pensado para Vercel Cron / cron-job.org.
- **Auth:** header con `CRON_SECRET` (obligatorio si la variable está definida, en cualquier entorno).
- **Respuesta:** `200 { ok: true, generados, enviados }` · `401` secreto inválido · `500` configuración incompleta.

---

## Contratos — Validación con IA

### `POST /api/contratos/[id]/validar`
Valida el **texto** de un contrato con IA (Groq): detecta cláusulas faltantes, riesgos y conformidad legal. Endurecido contra *prompt-injection*.
- **Auth:** `pgo_session`. · **Body:** `{ texto: string }`.
- **Respuesta:** `200 { estado: "aprobado"|"con_alertas"|"requiere_revision", alertas: [...] }`. Persiste el resultado en `contrato.validacionIa`.

### `POST /api/contratos/[id]/validar-doc`
Igual que el anterior pero recibe un **documento PDF** (extrae texto con `pdf-parse`, lo sanitiza y valida).
- **Auth:** `pgo_session`. · **Body:** `multipart/form-data` (PDF).
- **Respuesta:** `200 { ... }` · `400` PDF inválido · `503` `GROQ_API_KEY` no configurada.

---

> Esta referencia se deriva de los handlers en `apps/web/src/app/api/`. Para una especificación formal **OpenAPI 3.1 (`openapi.yaml`)** navegable con Swagger UI — pendiente; ver [PROGRESO](../gestion/PROGRESO.md).
