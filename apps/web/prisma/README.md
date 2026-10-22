# Capa de datos (Prisma)

Traducción de [`docs/04-esquema-bd.md`](../../../docs/04-esquema-bd.md).

- `schema.prisma` — tablas, enums y relaciones (modelado por Prisma).
- `sql/setup.sql` — lo que Prisma no modela: índice único parcial (un contrato
  vigente por propiedad), trigger de inmutabilidad del ledger, políticas RLS y
  vistas de saldos. **Idempotente.**

## Orden de aplicación (requiere Postgres corriendo)

```bash
# 1. Levantar Postgres (con Docker Desktop instalado)
npm run db:up                       # desde la raíz del repo

# 2. Migraciones versionadas + RLS, trigger, vistas y rol de la app (setup.sql)
npm run db:deploy  -w @propigo/web

# 3. Cargar datos de ejemplo (borra la base; solo contra un host local)
npm run db:seed    -w @propigo/web
```

> Roles (ADR-0011): el CLI de Prisma y los seeds usan `DATABASE_ADMIN_URL` (rol
> dueño, ver `prisma.config.ts`); la app se conecta con `DATABASE_URL` como
> `propigo_app`, sin privilegios de dueño, así que RLS restringe de verdad.
> `setup.sql` crea `propigo_app` **sin contraseña**: en local la asigna
> `docker/initdb/` y en producción el gestor de secretos.
>
> Cambios de schema: generar la migración con `prisma migrate diff` (ver BRAIN.md),
> nunca dejar un cambio aplicado solo con `db push` — producción se construye
> únicamente con `migrate deploy`.
