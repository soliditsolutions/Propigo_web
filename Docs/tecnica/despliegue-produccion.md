# Despliegue a producción — runbook

> Estado (2026-10-22): **el repositorio está preparado** (imagen, migraciones,
> CI, chequeo de salud, validación de configuración). **No hay nada desplegado.**
> Antes de abrir a usuarios reales hay que cerrar los [bloqueantes](#bloqueantes-antes-de-abrir-a-usuarios-reales).

## Arquitectura objetivo

Recomendada en la [guía de costos AWS](../gestion/guia-calculadora-aws-3-escenarios.md)
(fase "lanzamiento"). La decisión formal de nube sigue abierta en
[ADR-0001](../decisiones/ADR-0001-nube.md): la imagen es un contenedor estándar y
la base es PostgreSQL sin extensiones propietarias, así que el mismo artefacto
sirve en Azure u otro proveedor.

| Pieza | Servicio | Notas |
|---|---|---|
| App | **AWS App Runner** (contenedor) | Puerto 3000, chequeo HTTP `/api/salud`. |
| Base | **RDS PostgreSQL 16** | Acceso desde App Runner por VPC connector; sin acceso público. |
| Secretos | **Secrets Manager** | Inyectados como variables de entorno en App Runner. |
| Correo | Resend (o SES) | Dominio `propigo.cl` con SPF, DKIM y DMARC. |
| Cron | **EventBridge Scheduler** → HTTP | `GET /api/cron/recordatorios` diario con `Authorization: Bearer <CRON_SECRET>`. |
| DNS / TLS | Route 53 + certificado de App Runner | `propigo.cl` → servicio de App Runner. |
| Archivos | **S3** (+ CloudFront) | Pendiente de implementar: ver bloqueante 1. |

## Qué hay en el repositorio

| Artefacto | Para qué |
|---|---|
| [`Dockerfile`](../../Dockerfile) | Etapa final `runtime`: Next.js *standalone*, usuario sin privilegios, sin secretos. Etapa `migraciones`: corre `npm run db:deploy`. |
| [`.dockerignore`](../../.dockerignore) | Deja fuera `.env*`, documentos privados, uploads, `.git` y la documentación. |
| [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) | Lint, tipos, base efímera (migraciones + `setup.sql` + deriva + seeds), pruebas web contra Postgres, pruebas core, build y build de la imagen. |
| `npm run db:deploy -w @propigo/web` | `prisma migrate deploy` + `setup.sql` (RLS, trigger del ledger, vistas, rol `propigo_app`). Idempotente. |
| `GET /api/salud` | 200 si el proceso responde y llega a la base; 503 si no. Sin datos del entorno. |
| `src/instrumentation.ts` | Valida la configuración al arrancar y **termina el proceso** si falta algo crítico (`src/lib/startup-check.ts`). |

## Variables de entorno

| Variable | Dónde | Secreto | Notas |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | **build** (`--build-arg`) y runtime | No | `https://propigo.cl`. Next la incrusta al compilar: cambiarla exige reconstruir la imagen. |
| `DATABASE_URL` | runtime (app) | Sí | Rol `propigo_app` (sujeto a RLS). Agregar `sslmode=require`. |
| `DATABASE_ADMIN_URL` | solo tarea de migraciones | Sí | Usuario maestro de RDS. **Nunca** en el servicio de la app. |
| `AUTH_SECRET` | runtime | Sí | `openssl rand -hex 32`. Rotarlo cierra todas las sesiones. |
| `CRON_SECRET` | runtime + EventBridge | Sí | `openssl rand -hex 32`. |
| `GROQ_API_KEY` | runtime | Sí | Validación de contratos y carnet. |
| `RESEND_API_KEY` | runtime | Sí | Sin ella los correos solo se simulan en el log. |
| `PROXIES_CONFIABLES` | runtime | No | Proxies propios que agregan a `X-Forwarded-For`. `1` = solo App Runner; `2` = CloudFront + App Runner. Ver [verificación](#primer-despliegue). |
| `UPLOADS_PATH` | runtime | No | Directorio de documentos privados (ver bloqueante 1). |

**Prohibidas en producción** (el arranque falla si aparecen): `NODE_TLS_REJECT_UNAUTHORIZED=0`,
`E2E_BYPASS_IDENTITY`. `ALLOW_REMOTE_SEED` tampoco debe existir: habilita los seeds
destructivos contra una base remota.

## Primer despliegue

1. **RDS**: crear la instancia PostgreSQL 16 (privada, cifrada, respaldos automáticos
   activados) y la base `propigo`.
2. **Migraciones** con el usuario maestro:
   ```bash
   docker build --target migraciones --build-arg NEXT_PUBLIC_APP_URL=https://propigo.cl -t propigo-migraciones .
   docker run --rm -e DATABASE_ADMIN_URL="postgresql://<maestro>:<clave>@<rds>:5432/propigo?sslmode=require" propigo-migraciones
   ```
   (En AWS: como tarea única de ECS/CodeBuild dentro de la VPC, no desde un equipo personal.)
3. **Contraseña del rol de la app**: `setup.sql` crea `propigo_app` **sin contraseña**
   (no puede entrar). Asignarla con un valor generado en Secrets Manager:
   ```sql
   alter role propigo_app password '<valor de Secrets Manager>';
   ```
4. **Imagen de la app** → ECR:
   ```bash
   docker build --build-arg NEXT_PUBLIC_APP_URL=https://propigo.cl -t propigo-web .
   ```
5. **App Runner**: puerto 3000, chequeo HTTP en `/api/salud`, variables desde Secrets
   Manager, VPC connector hacia RDS, **máximo 1 instancia** (ver bloqueante 2).
6. **EventBridge Scheduler**: `GET https://propigo.cl/api/cron/recordatorios` diario con el encabezado `Authorization: Bearer <CRON_SECRET>`.
7. **Dominio y correo**: `propigo.cl` en Route 53 hacia App Runner; dominio verificado
   en Resend/SES (SPF, DKIM, DMARC); buzones según [tareas de gestión](../gestion/tareas-gestion-lanzamiento-propigo.md).
8. **Verificación**:
   - `curl https://propigo.cl/api/salud` → `{"estado":"ok"}`.
   - `curl -I https://propigo.cl` → `Strict-Transport-Security` y `Content-Security-Policy` presentes, sin `X-Powered-By`.
   - `curl https://propigo.cl/api/cron/recordatorios` sin encabezado → **401**.
   - **IP del cliente**: entrar al portal con un RUT de prueba y comparar la IP de
     `acceso_log` con tu IP pública. Si aparece una IP de AWS/CloudFront, ajustar
     `PROXIES_CONFIABLES`: con el valor equivocado, los límites de intentos de login,
     OTP y formularios públicos se aplican a la IP equivocada.

## Cada despliegue

1. CI en verde sobre `main`.
2. Construir y publicar la imagen (`runtime`) con el mismo `NEXT_PUBLIC_APP_URL`.
3. Correr la tarea de **migraciones** (idempotente) **antes** de actualizar la app.
4. Actualizar el servicio de App Runner; queda activo solo si `/api/salud` responde 200.

**Rollback**: volver a la imagen anterior en App Runner. Las migraciones son solo hacia
adelante, así que cada migración debe ser compatible con la versión anterior de la app
(agregar antes de quitar; nunca renombrar ni borrar una columna en el mismo despliegue
que deja de usarla).

## Bloqueantes antes de abrir a usuarios reales

1. **Almacenamiento de archivos.** Las fotos de propiedades y perfiles
   (`public/uploads/`) y los documentos privados (cédulas, contratos, comprobantes:
   `private-uploads/`) se escriben en el disco del contenedor. En App Runner ese disco
   es **efímero**: todo se pierde en cada despliegue o reinicio. Hay que mover ambos a
   S3 (documentos privados con URL firmada de corta duración y sin acceso público).
   Requiere cambio de código en `src/app/api/upload/route.ts`, `src/lib/uploads.ts` y
   las rutas que leen documentos.
2. **Rate limiting en memoria** (`src/lib/rate-limit.ts`). Cada instancia lleva su
   propio contador: con N instancias el límite real es N veces el configurado. Mantener
   App Runner en **1 instancia** o mover el contador a Redis (ElastiCache) antes de
   escalar.
3. **Pasarela de pago**: la suscripción usa una pasarela simulada
   (`src/lib/billing/fake-gateway.ts`) y la boleta es de ejemplo (ADR-0014).
4. **Respaldos**: definir RPO/RTO y probar una restauración de RDS antes del lanzamiento.
5. **Nube**: cerrar [ADR-0001](../decisiones/ADR-0001-nube.md) con la decisión tomada.
