# Auditoría de seguridad — 2026-10-22

Alcance: aplicación web completa (`apps/web`): 29 rutas API, 17 archivos de
*server actions*, autenticación, autorización, entradas, archivos, integración
con IA, dependencias y secretos. Método: modelo de amenazas (STRIDE por
frontera de confianza) y lista de control de la skill
`security-and-hardening` (addyosmani/agent-skills), sobre OWASP Top 10 y OWASP
Top 10 para LLM. Cada hallazgo corregido tiene su prueba automatizada.

## Hallazgos corregidos

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | **Alta** | `getInvitacionesPendientes(tenantId)` exportada de un archivo `"use server"` sin verificar sesión: devolvía nombres y correos de invitados de cualquier corredora (los `tenantId` son públicos en las URLs del marketplace). | Sin parámetros: el tenant sale de `getActor()` y solo responde al manager. |
| 2 | **Alta** | Descarga de documentos (`/api/documentos/[id]`) solo con `getSession`: un Colaborador descargaba cédulas y contratos de propiedades no asignadas, y un usuario desactivado seguía descargando con su token vigente. | `getActor()` + `actorPuedeVerDocumento` (resuelve la propiedad por cualquiera de las 6 relaciones; niega si no puede). |
| 3 | **Media** | Comentarios del corredor y validación de contratos con IA (`comentarios`, `validar`, `validar-doc`) sin el alcance del Colaborador (ADR-0013). | `alcanceContrato(actor)` en `lib/queries.ts`, aplicado al buscar el contrato. |
| 4 | **Media** | Formularios públicos de contacto y denuncia tomaban la IP del **primer** valor de `X-Forwarded-For`, que elige el cliente: el límite de envíos se saltaba y se podía inundar de correos a una corredora. | `getClientIp` + limitador común. Probado en el servidor: el 6º envío recibe 429. |
| 5 | **Media** | `lib/ip.ts` confiaba en `x-real-ip` (en AWS lo envía el cliente tal cual) y no contemplaba CloudFront delante. | `x-real-ip` ignorado; `PROXIES_CONFIABLES` define cuántos proxies propios agregan a `X-Forwarded-For`. |
| 6 | **Media** | Recuperación de contraseña sin tope: bombardeo de correos a una dirección ajena y costo de envío. | 3 por correo y 10 por IP cada 15 min, con respuesta idéntica (sin enumeración de cuentas). |
| 7 | **Media** | Login sin tope por IP cuando el correo no existe (el conteo en BD solo corre si la cuenta existe): *credential stuffing* sin freno. | Tope por IP antes de buscar la cuenta (30 / 15 min). |
| 8 | **Media** | Comentario del corredor: el correo salía siempre (ignorando la baja de la persona, aviso opcional — Ley 19.496 art. 28 B, sin enlace de baja) y además quedaba una notificación pendiente que el cron volvía a enviar. | Envío inmediato solo si `puedeRecibir`, con enlace de baja; la notificación pasa a `enviada`, o queda pendiente si falla el envío. |
| 9 | Baja | Limitador en memoria: la limpieza borraba claves inactivas 10 min sin mirar su ventana; el límite de denuncias (3/hora) se reiniciaba a los 10 min. | La limpieza respeta la ventana de cada clave. |
| 10 | Baja | Tokens de recuperación e invitación: leer y luego marcar como usado permitía dos usos simultáneos. | Consumo atómico (`updateMany … usadoEn: null`, revierte si `count ≠ 1`). |
| 11 | Baja | Acciones de perfil con `getSession`: un usuario desactivado podía cambiar contraseña y contacto mientras su token siguiera vigente. | `sesionActiva()` exige usuario activo. |
| 12 | Baja | Salida de la IA del carnet usada con `as CarnetIA` sin validar (OWASP LLM05): un `rut` no textual lanzaba fuera de todo manejo de errores. | Esquema zod sobre la respuesta del modelo. |
| 13 | Baja | Secreto del cron comparado con `!==`; JWT verificados sin fijar el algoritmo. | `timingSafeEqual` sobre SHA-256; `algorithms: ["HS256"]` en las tres verificaciones. |
| 14 | Info | Pruebas de PDF con render real fallaban por *timeout* (5 s) con la suite en paralelo. | Límite de 20 s en esas pruebas (reproducido y verificado bajo carga). |

## Controles revisados sin hallazgos

- **Sesiones**: cookies `__Host-`, `httpOnly`, `secure`, `sameSite=strict`; caducidad por inactividad y máximo absoluto; panel y portal mutuamente excluyentes.
- **Contraseñas**: PBKDF2-SHA256 con 310.000 iteraciones y sal aleatoria, comparación en tiempo constante; bloqueo escalonado por cuenta.
- **Tokens**: 256 bits aleatorios, almacenados como hash, con expiración y de un solo uso.
- **SQL**: consultas parametrizadas; los dos `$queryRawUnsafe` usan identificadores literales tipados y valores como parámetros.
- **XSS**: el único `dangerouslySetInnerHTML` es un script constante; los correos escapan todo dato de personas.
- **SSRF**: las llamadas salientes (Groq, Nominatim) van a hosts fijos.
- **Subidas**: lista blanca de MIME, tope de tamaño y verificación de *magic bytes*; documentos privados fuera de `public/`, servidos como descarga con `nosniff`.
- **Webhook de pagos**: la firma es la autenticación; en producción, sin pasarela real, falla cerrado.
- **OTP del portal**: 5 intentos por código y 10 por IP por minuto.
- **Errores**: ninguna respuesta expone mensajes internos; el detalle va al log.
- **Secretos**: 87 commits revisados; nunca se versionó un `.env`; los `gsk_…` del historial son valores ficticios de pruebas.
- **Dependencias de producción**: `npm audit --omit=dev` → 0 vulnerabilidades (CI ahora lo exige).

## Riesgos aceptados y decisiones pendientes

1. **CSP de las páginas públicas** (portada, marketplace, legales): reciben la CSP de
   respaldo con `script-src 'unsafe-inline'`; la estricta con *nonce* solo cubre las
   rutas del proxy (panel, login, registro, portal con sesión). No hay hoy un punto
   de inyección conocido, pero es una capa de defensa menos.
   *Opción*: ampliar el `matcher` del proxy a todas las páginas. *Costo*: el proxy
   corre en cada request y obliga a render dinámico (las páginas públicas ya lo son).
   **Decisión pendiente.**
2. **Dependencias de desarrollo**: 9 alertas altas en la cadena
   `braces`/`micromatch`/`fast-glob` (vía eslint y el CLI de `shadcn`). Son DoS por
   patrones de *glob* que solo procesan entradas del propio repo, en el equipo del
   desarrollador y en CI; no llegan a la imagen. El "arreglo" de npm es una
   regresión mayor (`shadcn@1`, `eslint-config-next@14`). **Revisar: 2027-01-22.**
3. **Limitadores en memoria**: correctos con una instancia; con varias, el límite
   efectivo se multiplica (ver bloqueante 2 de
   [despliegue-produccion.md](../tecnica/despliegue-produccion.md)).
4. **`PROXIES_CONFIABLES`**: verificar contra la topología real en el primer
   despliegue (procedimiento en el runbook).
