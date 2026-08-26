# Cuentas de prueba

> Cuenta de corredor persistente para pruebas manuales en **desarrollo local**.
> Script: `apps/web/prisma/seed-cuenta-prueba.ts`
>
> _Creado 2026-08-06 — verificado end-to-end (login → 2FA → panel)._

## Credenciales

| | |
|---|---|
| **Correo** | `corredor.prueba@housing.local` |
| **Contraseña** | `Kestrel.Vega_47` |
| **Rol** | `manager` (dueño del tenant) |
| **Plan** | `diamond` |
| **RUT** | `16.358.920-6` |
| **Corredora** | Corredora de Prueba SpA |
| **Tenant ID** | `00000000-0000-4000-8000-000000000001` |
| **Usuario ID** | `00000000-0000-4000-8000-000000000002` |

Los IDs son fijos a propósito: se mantienen iguales entre resets, así sirven para
depurar (aparecen igual en logs, URLs y consultas SQL) y hacen el script idempotente.

## Cómo crearla o restaurarla

```bash
npm run db:seed-cuenta -w @housing/web
```

**Es idempotente**: se puede correr las veces que sea. Cada corrida además:

- restaura la contraseña (si se cambió durante una prueba),
- limpia `failed_attempts` y `locked_until` (si quedó bloqueada por intentos fallidos),
- limpia `desactivado_en` (si se desactivó probando el flujo de equipo),
- vuelve a marcar el perfil como completo.

O sea: **si la cuenta quedó en un estado raro, re-correr el script la deja usable otra vez.**

## Orden después de resetear la base

El orden importa — `db:seed` hace `TRUNCATE tenant … CASCADE`, así que **borraría la
cuenta de prueba si se corre después**:

```bash
npx prisma migrate reset -w @housing/web   # 1. esquema limpio
npm run db:setup       -w @housing/web     # 2. RLS, vistas y triggers (NO lo reaplica el reset)
npm run db:seed        -w @housing/web     # 3. datos demo — TRUNCATEA tenant, va ANTES
npm run db:seed-cuenta -w @housing/web     # 4. cuenta de prueba — siempre al final
```

El paso 2 es obligatorio: `prisma migrate reset` no reaplica `setup.sql`.

**El paso 3 necesita `DATABASE_ADMIN_URL` en el `.env`** (rol dueño de las
tablas). El seed arranca con un TRUNCATE y `housing_app` no puede hacerlo por
diseño (ADR-0011): sin esa variable falla con `permission denied for table
tenant`. El `.env` no se versiona, así que en una máquina nueva hay que
agregarla — la URL del rol dueño ya viene comentada en el propio archivo.

## Iniciar sesión

1. Ir a `/login` y entrar con las credenciales de arriba.
2. Pedirá **verificar el dispositivo** (2FA por correo). En local el correo no se
   envía: se imprime en la consola del servidor de desarrollo, así:

```
──────────────────────────────────────────────────────
🔐  EMAIL SIMULADO — Verificación de dispositivo
    Para      : corredor.prueba@housing.local (Carlos Corredor)
    Código    : 330198
    Válido    : 10 minutos
──────────────────────────────────────────────────────
```

3. Copiar el código y pegarlo. Una vez verificado, el dispositivo queda confiable
   y no lo vuelve a pedir en ese navegador.

## Probar el gating por plan

La cuenta viene en `diamond` para que ninguna funcionalidad quede escondida detrás
de un gate mientras se prueba. Para ver el comportamiento de otro plan:

```bash
docker exec housing-db psql -U housing -d housing \
  -c "UPDATE tenant SET plan='bronze' WHERE id='00000000-0000-4000-8000-000000000001';"
```

Valores válidos: `bronze`, `silver`, `gold`, `diamond`. Cualquier otro valor (incluido
`Gratuito`) cae al tier más bajo por diseño — el fallback es conservador a propósito:
un fallo de billing nunca debe abrir permisos. Para volver, re-correr `db:seed-cuenta`.

> Ojo: hoy el plan solo controla **analítica** y **exportación CSV**. Los límites de
> propiedades y de tokens de IA que venden los planes todavía no están implementados
> — ver `rowmap-pagos.md`, Fase B0.

## Seguridad

Esta cuenta tiene contraseña conocida y publicada en este documento. **No debe
existir fuera de desarrollo local.**

El script lo impide: verifica que `DATABASE_URL` apunte a un host local
(`localhost`, `127.0.0.1`, `::1`, `host.docker.internal`, `db`, `housing-db`) y
aborta en cualquier otro caso. El bypass existe pero es explícito y hay que
escribirlo a mano (`ALLOW_REMOTE_SEED=1`).

## Notas de implementación

- **RLS**: `usuario` está bajo `FORCE ROW LEVEL SECURITY` (ADR-0011), así que el
  script fija `app.current_tenant_id` con `set_config(...)` dentro de la transacción
  — mismo mecanismo que `withTenant()` en `lib/tenant-db.ts`. Sin eso el INSERT falla
  el `WITH CHECK` de la política `tenant_isolation`.
  `seed.ts` no lo necesita porque corre **antes** de aplicar `setup.sql`.
- **El RUT y la contraseña fueron validados** contra las propias funciones del
  proyecto (`validarRut()` de `@housing/core` y `evaluatePassword()`), no elegidos a ojo.
- **`e2e-bootstrap.ts` quedó obsoleto** con este script. Era de un solo uso (fallaba
  al segundo run por el UNIQUE de RUT) y estaba marcado como temporal para la
  auditoría E2E de julio 2026, que ya terminó. Se puede eliminar.

## Pendiente / mejoras posibles

- Una cuenta **colaborador** en el mismo tenant, para probar la cascada de permisos
  de ADR-0013 (Manager ve todo / Colaborador solo lo asignado) sin tener que pasar
  por el flujo de invitación por correo.
