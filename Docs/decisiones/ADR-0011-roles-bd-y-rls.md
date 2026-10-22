# ADR-0011 — Rol de base de datos dedicado para runtime (`propigo_app`), separado del rol de migraciones

- **Fecha**: 2026-07-10
- **Estado**: Aceptada

## Contexto

Propigo usa Row-Level Security (RLS) en PostgreSQL para el aislamiento multi-tenant (ver ADR-0002). Una auditoría pre-producción encontró que, en el estado actual del proyecto, esa RLS **no restringe nada en la práctica**:

- El rol `propigo` (usado tanto por la app en runtime como por las migraciones vía `prisma migrate`/`db push`) es el **dueño** de todas las tablas.
- Además, por cómo `POSTGRES_USER` inicializa el contenedor oficial de Postgres, `propigo` es también **superusuario** (`rolsuper = true`, `rolbypassrls = true`).
- Postgres exime siempre de RLS a los superusuarios, y por defecto también al dueño de la tabla (salvo `FORCE ROW LEVEL SECURITY`, que de todas formas no ayuda contra un superusuario).
- El código de la app nunca ejecuta `SET app.current_tenant_id` — y aunque lo hiciera, sería irrelevante mientras la conexión sea con un rol que bypassa RLS.

En consecuencia, el aislamiento entre corredoras (tenants) depende **exclusivamente** de que cada consulta Prisma incluya manualmente el filtro `tenantId` correcto. Por revisión exhaustiva de código, esto se cumple hoy de forma consistente en todas las rutas — pero no hay ningún respaldo de base de datos si una consulta futura lo omite.

## Decisión

Separar el rol que **corre la app** del rol que **migra el esquema**:

| Rol | Usado por | Privilegios |
|---|---|---|
| `propigo` | Solo migraciones (`prisma migrate`/`db push`, `setup.sql`), nunca la app en runtime | Superusuario/dueño (sin cambios — sigue siendo el bootstrap del contenedor) |
| `propigo_app` (nuevo) | La app Next.js completa (marketplace, panel, portal) en cualquier entorno | `SELECT/INSERT/UPDATE/DELETE` sobre las tablas de negocio; sin DDL, sin superusuario, sin ownership |

Al no ser dueño ni superusuario, `propigo_app` queda sujeto a las políticas `tenant_isolation` ya existentes sin cambios adicionales (no se necesita `FORCE ROW LEVEL SECURITY`: esa opción solo afecta al dueño, y `propigo_app` nunca lo es).

El aislamiento real requiere además que la app ejecute `SET LOCAL app.current_tenant_id = '<uuid>'` al inicio de cada transacción, usando el `tenantId` de la sesión autenticada — sin este paso, `current_setting(..., true)` devuelve `NULL` y la política no filtra ninguna fila (ver comentario en `setup.sql`). Este trabajo de aplicación (Fase 2) se implementa por separado de la creación de roles (Fase 1), dado que requiere envolver cada operación tenant-scoped en una transacción — un cambio con superficie mucho mayor sobre el código existente.

## Alternativas consideradas

**Un rol de base de datos por área de la aplicación** (marketplace, portal, panel), cada uno con privilegios distintos según lo que esa área necesita.

Descartada por ahora:
- Prisma en este proyecto es un **cliente único** (`src/lib/db.ts`). Sostener varios roles implicaría múltiples `PrismaClient` y lógica para elegir el correcto en cada archivo — con el riesgo concreto de que un desarrollador use el cliente equivocado, lo que sería en sí mismo un bug de seguridad nuevo.
- Ninguna área es realmente de solo lectura (marketplace escribe en contacto/denuncia/valoración; portal escribe en accesoOtp/accesoLog/comentarios), así que se necesitarían roles de lectura *y* escritura por área — la cantidad de roles crece sin beneficio proporcional.
- El vector de ataque que esta separación defendería (inyección SQL aislada a una sola área) no es practicable hoy: toda consulta pasa por Prisma parametrizado; no se encontró SQL armado por concatenación de input de usuario en código de producción.
- El riesgo real identificado en la auditoría — una consulta futura del panel que olvide el filtro `tenantId` — ya queda completamente cubierto por la barrera de `tenant_id` de `propigo_app`, sin importar el área de la que provenga la consulta.

Se prioriza el beneficio real (aislamiento multi-tenant garantizado por la BD, no solo por el código) sobre una granularidad adicional que aporta poco beneficio marginal a cambio de complejidad y riesgo de mantenimiento permanentes.

## Consecuencias

- `DATABASE_URL` de producción debe apuntar a `propigo_app`; `propigo` (o su equivalente en el proveedor final) se reserva para migraciones (CI/manual), nunca para el proceso de la app.
- Rutas de sistema sin sesión de usuario (ej. `/api/cron/recordatorios`, que itera todos los tenants) deben `SET LOCAL app.current_tenant_id` por cada tenant dentro de su propia transacción — sin usar ningún rol con `BYPASSRLS`.

### Fase 2 — completada (2026-07-11)

El wiring de aplicación quedó implementado y verificado extremo a extremo:

- `src/lib/tenant-db.ts` expone `withTenant(tenantId, fn)`: abre una transacción interactiva de Prisma, ejecuta `SET LOCAL app.current_tenant_id` y corre `fn` dentro de ella. Todas las rutas/queries que tocan tablas con política `tenant_isolation` pasan por este helper (panel, auth, marketplace, portal).
- Los accesos genuinamente cross-tenant (login por email, unicidad de RUT/email, lookups de marketplace/portal por token o RUT) usan funciones `SECURITY DEFINER` dedicadas y auditables en `setup.sql`, nunca acceso directo a la tabla.
- `apps/web/.env` migrado a `DATABASE_URL` con `propigo_app`.
- Verificación en vivo (navegador real, no solo scripts) confirmó: login, panel completo (Resumen/Propiedades/Contratos/Cobros/Vouchers/Notificaciones/Perfil), registro de tenant nuevo (incluyendo el `set_config` a mitad de transacción al crear el tenant), verificación de dispositivo, y el flujo de portal RUT→OTP→contrato — todos funcionando sin errores bajo `propigo_app`.
- **Prueba de aislamiento cross-tenant**: se creó un tenant B desechable con su propio contrato y, autenticado como un usuario del tenant A, se confirmó que `/panel/contratos/[id]` de un contrato del tenant B no es accesible (404, sin fuga de datos) — la RLS bloquea a nivel de base de datos, no solo por lógica de aplicación.
- De paso se corrigió un patrón inseguro pre-existente: varias queries usaban `Promise.all` para lanzar múltiples operaciones sobre el mismo cliente de una transacción interactiva (`tx`), lo cual dispara `DeprecationWarning: Calling client.query() when the client is already executing a query` en `pg` — una única conexión Postgres no puede ejecutar queries en paralelo. Se cambiaron a `await` secuenciales en `getResumen`, `getContratoDetalleTx` (`queries.ts`), `generarRecordatorios` (`panel/notificaciones/actions.ts`), y en `panel/cobros/page.tsx` y `panel/cobros/actions.ts`.
