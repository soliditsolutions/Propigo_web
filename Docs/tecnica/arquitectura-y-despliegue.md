# Arquitectura y despliegue (objetivo)

> Este documento describe la arquitectura **objetivo de producción**. El MVP es local y portable (ver [ADR-0001](../decisiones/ADR-0001-nube.md) y [ADR-0003](../decisiones/ADR-0003-fidelidad-prototipo.md)), pero se construye respetando estos límites para poder graduarse sin reescritura.

> **Estado de implementación (MVP, jul 2026).** Ya realizado del diseño objetivo, con integraciones simuladas: separación plano público (marketplace `/marketplace`) vs. plano financiero (panel `/panel`); núcleo financiero aislado en `@propigo/core`; RLS multi-tenant en PostgreSQL; ledger inmutable (trigger) + audit log; conciliación con fecha real y reajuste IPC; **portal de autoconsulta OTP** de solo lectura (ADR-0007); documentos por endpoint autenticado con auditoría; **MFA para corredores** vía 2FA por dispositivo confiable; CSP con nonce. **Aún simulado/pendiente para producción:** pasarela de pago y Open Banking (Fintoc), cola de eventos + workers, réplica de lectura, proveedor de identidad gestionado y almacenamiento de objetos con URL firmada (hoy disco local). Componente nuevo no previsto en este diagrama: **validación de contratos con IA** (Groq) en el panel.

## Principios rectores

1. **Separar el plano público del plano financiero.** El marketplace B2C (internet, alto tráfico, cacheable) y el panel B2B financiero (transaccional, sensible) son despliegues distintos. El tráfico del público nunca debe poder degradar ni acceder al núcleo financiero.
2. **Núcleo financiero aislado.** La lógica de dinero es un módulo/paquete framework-agnóstico, extraíble como servicio privado.
3. **Defensa en profundidad.** La seguridad no depende de una sola capa: autorización en datos + RLS en BD + aislamiento de red + cifrado.
4. **Portabilidad.** Sin SDKs propietarios en el núcleo. Docker + PostgreSQL estándar. La nube se decide tarde (ver ADR-0001).
5. **Correctitud financiera y auditabilidad** por encima de features. El dinero no admite ambigüedad.

## Vista de alto nivel

```
                 Internet
                    │
        ┌───────────┴───────────┐
        │                       │
   [CDN + WAF]             [CDN + WAF]
        │                       │
  Marketplace B2C         Panel SaaS B2B
  (Next.js SSR,           (Next.js, autenticado)
   solo lectura)                │
        │                       │ (API interna, red privada)
        │                       ▼
        │                ┌──────────────────┐
        │                │  Núcleo financiero│  ← servicio privado, sin acceso a internet
        │                │  (ledger, IPC,    │
        │                │   conciliación)   │
        │                └─────────┬─────────┘
        │                          │
        ▼                          ▼
  [Réplica lectura]          [PostgreSQL primario + RLS]
   (catálogo público)         (datos financieros, cifrado en reposo)
                                   │
                          ┌────────┴────────┐
                     [Cola de eventos]   [Vault de secretos]
                          │
              Workers: conciliación, emisión de
              vouchers, notificaciones, reajuste IPC
                          │
          ┌───────────────┼───────────────┐
     [Pasarela pago]  [Banco/Open Bank]  [Email]
     (Transbank/        (Fintoc)         (transaccional)
      Webpay/Khipu)
```

## Componentes

### Modelo de acceso (ver [ADR-0005](../decisiones/ADR-0005-acceso-partes-y-publicacion.md) y [ADR-0007](../decisiones/ADR-0007-portal-autoconsulta-otp.md))
- **Solo los corredores tienen cuenta** y se autentican en el SaaS privado (plano financiero).
- **Propietarios y arrendatarios no tienen cuenta**: usan el sitio público y un **portal de autoconsulta de solo lectura** con **OTP passwordless** (RUT + ID identifican; el código enviado al contacto registrado autentica). Ven su arriendo, pagos y documentos.
- **Documentos** (contrato, anexos, comprobantes, certificado de reserva) se sirven por **URL firmada y expirable**; nunca enlaces públicos. Cada acceso queda **auditado**.
- Las comunicaciones a las partes (cobros, vouchers, recordatorios, avisos de contrato) van por **notificaciones** (email; simulado en MVP).

### Frontend / aplicación
- **Next.js (App Router) + TypeScript**, desplegado en dos targets: marketplace público y panel B2B. Comparten librería de UI y el paquete de dominio, pero son builds/despliegues separados.
- **Autorización en la capa de acceso a datos** (Route Handlers / Server Actions), nunca delegada solo al middleware (ver [ADR-0002](../decisiones/ADR-0002-stack-y-seguridad.md), CVE-2025-29927).

### Núcleo financiero (servicio privado)
- Paquete TypeScript sin dependencias de Next.js: generación de calendarios de pago, cálculo de comisiones e intereses, **reajuste de IPC por aniversario de contrato**, ledger contable inmutable, conciliación.
- En MVP: corre dentro del monolito. En producción: extraíble a servicio en red privada (sin ruta a internet).

### Datos
- **PostgreSQL** como almacén transaccional principal.
- **Row-Level Security (RLS)** para aislamiento multi-tenant (cada corredora = tenant). Estrategia: base compartida con RLS por `tenant_id` — buen balance costo/aislamiento para el MVP y primeras fases (ver ADR-0002).
- **Dinero en `DECIMAL`/enteros** (unidades mínimas), nunca `float`.
- **UF como serie temporal** (valor diario). Todo monto en UF se resuelve a CLP a la fecha del evento.
- **Ledger append-only**: los vouchers no se editan ni borran; se reversan con asientos nuevos. Esto da auditoría y resuelve los fallos #5 y #8.
- Réplica de lectura para el catálogo del marketplace.
- **Documentos** (contratos, anexos, comprobantes, certificados) en **almacenamiento de objetos**, servidos por **URL firmada y expirable**. En MVP local: carpeta/objeto local con el mismo patrón de acceso firmado.

### Integración de pagos (event-driven)
- **PAC** (cargo recurrente) y **"pago fácil"** vía pasarela local (Transbank/Webpay, Khipu) y **Open Banking (Fintoc)** para *detectar* transferencias entrantes y conciliar sin intervención humana → resuelve el fallo #1.
- Flujo orientado a eventos con **webhooks idempotentes** (un pago jamás se procesa dos veces):
  `pago.recibido → conciliar contra calendario → emitir voucher → notificar (email arrendatario + arrendador)`.
- **Cola de mensajes** para desacoplar picos de carga (resuelve el fallo #3).

## Seguridad (datos altamente sensibles)

| Capa | Control |
|---|---|
| Red | Plano financiero en red privada; WAF + CDN delante de lo público; núcleo financiero sin ruta a internet. |
| Autenticación | Proveedor gestionado (Cognito / Azure AD B2C / Auth0). No construir auth propia. MFA para corredores. |
| Autorización | Verificada en la capa de datos en cada operación; nunca solo en middleware. |
| Multi-tenant | **RLS en PostgreSQL** — el aislamiento lo fuerza la BD, no solo el código. |
| Datos | Cifrado en reposo y en tránsito (TLS). PII y datos financieros cifrados; secretos en vault. |
| Integridad | Ledger inmutable + log de auditoría de toda acción sobre dinero. |
| Entrada | Validación estricta (Zod) en todo borde; consultas parametrizadas (ORM); protección CSRF en mutaciones; rate limiting. |
| Pagos | Idempotencia de webhooks; verificación de firma de la pasarela; nunca almacenar datos de tarjeta (delegado a la pasarela / PCI). |

### Cumplimiento normativo (Chile)
- **Ley 19.628** (protección de la vida privada) — vigente.
- **Ley 21.719** (nueva ley de protección de datos personales; crea la Agencia de Protección de Datos) — su entrada en vigencia plena debe monitorearse; diseñar desde ya con sus principios (consentimiento, minimización, derechos ARCO, brechas notificables).
- Si se opera dinero de terceros (cuenta recaudadora), evaluar perímetro regulatorio **CMF** y modelo de cuenta (recaudación vs. custodia) con asesoría legal antes de producción.

## Escalabilidad
- API stateless detrás de autoescalado horizontal.
- Marketplace público servido con SSR + caché/CDN; lectura desde réplica.
- Picos de pago/liquidación absorbidos por cola + workers (no bloquean la request del usuario).
- Estrategia de tenants: RLS compartido ahora → particionar/aislar por tenant grande cuando el volumen lo justifique (no antes; evitar complejidad operativa prematura).

## Nube
Decisión **diferida** intencionalmente (ver [ADR-0001](../decisiones/ADR-0001-nube.md)). El diseño es portable; AWS y Azure cubren los requisitos (ambos con región en Chile). La elección final dependerá de la experiencia del equipo.

## DevOps — Integración y Despliegue Continuo (CI/CD)

> Repositorio en GitHub (`soliditsolutions/Propigo_web`). El pipeline de CI está **implementado** en [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml); el despliegue (imagen, migraciones, secretos, checklist) está en [despliegue-produccion.md](despliegue-produccion.md). Reglas de contribución en [CONTRIBUTING.md](../../CONTRIBUTING.md).

### Entornos

| Entorno | Propósito | Datos |
|---|---|---|
| **Local** | Desarrollo | PostgreSQL en Docker (puerto 5433), integraciones simuladas |
| **Staging** | Validación previa a producción | BD aislada, claves de sandbox (Resend/Groq de prueba) |
| **Producción** | Operación real | BD gestionada + réplica, secretos en vault, integraciones reales |

### Pipeline (por Pull Request)

```
push / PR  →  npm ci  →  Lint  →  Tipos  →  BD efímera: migraciones + setup.sql + deriva + seeds
           →  Test (vitest web contra Postgres + core)  →  Build  →  Imagen Docker (sin publicar)
           →  [PR] revisión humana ≥1 aprobación
merge a main  →  Imagen → registro  →  Tarea de migraciones (db:deploy)  →  Desplegar  →  /api/salud
```

- **Ningún merge con checks en rojo.** `lint` + `test` + `build` son obligatorios.
- **Migraciones:** solo versionadas (`prisma migrate deploy`), seguidas de `setup.sql` (RLS, trigger inmutable, vistas, rol de la app) — ambas en `npm run db:deploy`. CI falla si `schema.prisma` tiene cambios sin migración.
- **Secretos:** nunca en el repo. Se inyectan por variables de entorno del proveedor / vault (ver tabla de variables en el [README](../../README.md)).
- **Cron:** `/api/cron/recordatorios` se agenda en el scheduler del proveedor (en AWS: EventBridge Scheduler → destino HTTP) con `Authorization: Bearer <CRON_SECRET>`.

### Objetivo de despliegue

- **Dos targets separados** (marketplace público vs. panel B2B) como builds/despliegues independientes detrás de CDN + WAF.
- **Assets/documentos:** migrar `public/uploads/` (disco local, no persiste entre deploys) a **almacenamiento de objetos** (S3/R2) con URL firmada — sin cambios de schema ni UI.
- **Estrategia de respaldos:** backups automáticos de la BD + definición de **RPO/RTO** antes de producción.

## Pendientes de definición (a resolver antes de producción)
- Proveedor de identidad concreto.
- Pasarela(s) de pago y modelo legal de la cuenta recaudadora.
- Proveedor de la serie de UF/IPC (fuente oficial: SII / Banco Central).
- Estrategia de respaldos y RPO/RTO.
- Proveedor de nube y de almacenamiento de objetos.
