# Propigo — Guía de desarrollo local

## Requisitos previos

- Node.js ≥ 20 y pnpm ≥ 9
- PostgreSQL corriendo en **puerto 5433** (ver `prisma/.env`)
- Variables de entorno configuradas en `.env.local` (ver `.env.example` si existe)

---

## Arrancar el proyecto

Desde la raíz del monorepo (`Propigo/`):

```bash
pnpm install          # instala todas las dependencias
pnpm --filter web dev # arranca el servidor Next.js en http://localhost:3000
```

O directamente desde `apps/web/`:

```bash
cd apps/web
pnpm dev
```

El servidor corre en **http://localhost:3000**.

---

## Credenciales de demo

| Campo        | Valor                          |
|--------------|-------------------------------|
| Email        | `maria@corredorademo.cl`       |
| Contraseña   | `Demo1234!`                    |

---

## Flujo de login (2 pasos)

### Paso 1 — Credenciales
Ingresa email + contraseña en `/login`. Si son correctas, el servidor crea una sesión JWT y redirige.

### Paso 2 — Verificación de dispositivo
Si el dispositivo **no está registrado** como de confianza, el middleware redirige automáticamente a `/verificar-dispositivo`. Esta pantalla:

1. Envía un código de 6 dígitos por email (o simula el envío en dev).
2. El usuario ingresa el código para confirmar el dispositivo.
3. Una vez confirmado, el JWT se actualiza con un `deviceToken` y el usuario accede al panel.

### ⚠️ Dónde encontrar el código en desarrollo

**En dev, no se envía email real.** El código aparece en la **consola del servidor** (la terminal donde corre `pnpm dev`):

```
🔐  EMAIL SIMULADO — Verificación de dispositivo
    Para      : maria@corredorademo.cl (María Corredora)
    Código    : 482917
    IP        : ::1
    Navegador : Chrome en Windows
    Válido    : 10 minutos
```

Busca la línea `Código :` en la terminal. También aparece en la UI una nota verde indicando esto.

### Otros logs en consola del servidor

| Tipo                        | Prefijo en consola              |
|-----------------------------|----------------------------------|
| Verificación de dispositivo | `🔐 EMAIL SIMULADO — Verificación de dispositivo` |
| Recuperación de contraseña  | `📧 EMAIL SIMULADO — Recuperación de contraseña` |
| OTP portal autoconsulta     | `🔑 EMAIL SIMULADO — Portal OTP` |
| Notificaciones generales    | `📧 EMAIL SIMULADO — Notificación` |

---

## Base de datos

```bash
# Generar cliente Prisma
pnpm prisma generate

# Aplicar migraciones
pnpm prisma migrate dev

# Abrir Prisma Studio (explorador visual)
pnpm prisma studio
```

La base de datos de dev está en PostgreSQL puerto **5433**. Revisa `prisma/.env` o `apps/web/.env.local` para la cadena de conexión exacta.

---

## Variables de entorno relevantes

| Variable              | Descripción                                      | Dev default          |
|-----------------------|--------------------------------------------------|----------------------|
| `DATABASE_URL`        | Conexión PostgreSQL                              | `postgres://...5433` |
| `AUTH_SECRET`         | Secreto HMAC para JWT y hashes OTP              | requerido            |
| `NEXT_PUBLIC_APP_URL` | URL base de la app (usada en emails)             | `http://localhost:3000` |
| `RESEND_API_KEY`      | API key de Resend (emails reales) — opcional en dev | (vacío = consola) |

---

## Estructura relevante

```
apps/web/src/
├── app/
│   ├── login/               # Página + acción de login
│   ├── verificar-dispositivo/ # Verificación de nuevo dispositivo (OTP)
│   ├── panel/               # Panel del corredor (protegido)
│   └── api/auth/            # Endpoints de auth (logout, dispositivo)
├── lib/
│   ├── auth.ts              # JWT, cookies, sesión
│   └── email.ts             # Envío de emails (dev → console.log)
└── proxy.ts                 # Middleware: protección de rutas + CSP
```
