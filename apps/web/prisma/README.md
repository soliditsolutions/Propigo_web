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

# 2. Crear el esquema en la BD
npm run db:push    -w @propigo/web  # o: prisma migrate dev

# 3. Aplicar RLS, trigger y vistas
npm run db:setup   -w @propigo/web

# 4. (próximo) Cargar datos de ejemplo
# npm run db:seed  -w @propigo/web
```

> Nota de seguridad: RLS queda instalado, pero para que **restrinja de verdad** la
> app debe conectarse con un rol sin privilegios de dueño (`propigo_app`). En el MVP
> local app y migraciones usan el mismo rol; el endurecimiento con rol dedicado es un
> paso posterior (ver `docs/01-arquitectura-produccion.md`).
