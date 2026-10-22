# Propigo — Plataforma PropTech de gestión de arriendos

**Propigo** (_Publica más. Complica menos._ — [propigo.cl](https://propigo.cl)) es una plataforma chilena de doble vía. (Antes se llamaba "Housing"; el nombre se reemplazó por completo, incluidos paquetes `@propigo/*` y base de datos.)

- **SaaS B2B** — panel para corredores de propiedades: inventario, contratos, calendario de pagos, conciliación automática con la **fecha real** del pago, reajuste de IPC por aniversario, ledger contable inmutable y liquidación a propietarios.
- **Marketplace B2C** — sitio público de arriendos con búsqueda/filtros, ficha de propiedad, contacto con el corredor, valoraciones y denuncias, más un **portal de autoconsulta** (OTP) para que arrendatarios y propietarios vean su arriendo sin cuenta.

Empresa responsable: **SOLIDIT SpA** (no aparece en el logo). Marca, eslogan, dominio y correos se definen solo en `apps/web/src/lib/marca.ts`. Mercado: Chile. Indexación: **UF** y **CLP + IPC**.

> **Estado:** MVP local ~97 % (núcleo financiero real + integraciones simuladas). Detalle en [`Docs/gestion/PROGRESO.md`](Docs/gestion/PROGRESO.md). Documentación completa en [`Docs/`](Docs/README.md).

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Lenguaje | TypeScript 5 |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react |
| ORM / BD | Prisma 7 (driver adapter `@prisma/adapter-pg`) + PostgreSQL |
| Núcleo financiero | `@propigo/core` — paquete sin framework (dinero, UF, IPC, calendario) |
| Auth | JWT con `jose` (cookies `pgo_session` / `pgo_portal`) + 2FA por dispositivo |
| Email | Resend (real) / simulado en consola (dev) |
| IA | Groq SDK + `@google/genai` (validación de contratos) |
| Tests | Vitest + Testing Library |

Monorepo con **npm workspaces**: `apps/web` (aplicación) y `packages/core` (dominio).

---

## Prerrequisitos

- **Node.js ≥ 20**
- **npm ≥ 10** (workspaces)
- **PostgreSQL 16** — vía Docker (`docker compose`) o instalación local
- **Docker Desktop** (opcional, para la BD con `npm run db:up`)

---

## Instalación y ejecución

```bash
# 1. Instalar dependencias (monorepo completo)
npm install

# 2. Configurar entorno: copiar el ejemplo y ajustar
cp .env.example apps/web/.env
#   → editar apps/web/.env (ver "Variables de entorno" abajo)

# 3. Levantar PostgreSQL (Docker, puerto host 5433)
npm run db:up

# 4. Preparar la base de datos
npm run db:push  -w @propigo/web    # crea tablas desde schema.prisma
npm run db:setup -w @propigo/web    # RLS + trigger inmutable + vistas (setup.sql)
npm run db:seed  -w @propigo/web    # datos demo (corredora, contratos, UF/IPC)

# 5. Correr en desarrollo
npm run dev                          # http://localhost:3000
```

- Marketplace público: `http://localhost:3000/marketplace`
- Panel del corredor: `http://localhost:3000/panel` (demo: `maria@corredorademo.cl` / `Demo1234!`)
- Portal del arrendatario: `http://localhost:3000/portal`

---

## Comandos

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) en :3000 |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm test -w @propigo/web` | Tests (Vitest) |
| `npm test -w @propigo/core` | Tests del núcleo de dominio |
| `npm run db:up` / `db:down` | Levanta / detiene PostgreSQL (Docker) |
| `npm run db:push -w @propigo/web` | Sincroniza el schema con la BD |
| `npm run db:setup -w @propigo/web` | Aplica `prisma/sql/setup.sql` (RLS, trigger, vistas) |
| `npm run db:seed -w @propigo/web` | Carga datos de demostración |
| `npm run db:generate -w @propigo/web` | Regenera el cliente Prisma |

> Guía detallada de levantamiento y troubleshooting: [`Docs/tecnica/guia-local.md`](Docs/tecnica/guia-local.md).

---

## Variables de entorno

Se definen en `apps/web/.env`. El arranque las valida (`src/lib/startup-check.ts`) y **falla rápido** si falta una crítica.

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | ✅ | Cadena de conexión PostgreSQL. Con Docker: `postgresql://propigo:propigo_dev@localhost:5433/propigo?schema=public` |
| `AUTH_SECRET` | ✅ | Secreto para firmar JWT (panel, portal OTP y 2FA por dispositivo). Mínimo 32 caracteres. |
| `GROQ_API_KEY` | ✅ (prod) | Clave de Groq para la validación de contratos con IA. En dev puede omitirse (la validación se salta). |
| `CRON_SECRET` | ✅ (prod) | Protege el endpoint `/api/cron/recordatorios`. Obligatorio si el endpoint es accesible. |
| `RESEND_API_KEY` | ⬜ | Clave de Resend para envío real de emails. Sin ella, los correos se simulan en consola. |
| `NEXT_PUBLIC_APP_URL` | ⬜ | URL base para los enlaces en emails (ej. `http://localhost:3000`). |
| `UPLOADS_PATH` | ⬜ | Ruta de almacenamiento de documentos/imágenes. Por defecto `public/uploads/`. |
| `NODE_TLS_REJECT_UNAUTHORIZED` | ⚠️ | **SOLO DEV.** `0` permite TLS autofirmado local. **Nunca en producción** (el startup-check lo bloquea). |
| `E2E_BYPASS_IDENTITY` | ⬜ | **SOLO DEV/QA.** `1` omite la verificación de identidad por cédula (IA) en `/registro`, para pruebas E2E automatizadas. **Nunca en producción** (el startup-check lo bloquea). |

---

## Estructura del repositorio

```
Propigo/
├── apps/web/            # Aplicación Next.js (panel + marketplace + portal + API)
│   ├── src/app/         #   Rutas (App Router) + Route Handlers en src/app/api/
│   ├── src/components/  #   Componentes de UI
│   ├── src/lib/         #   Auth, DB, email, queries, formato, dominio auxiliar
│   └── prisma/          #   schema.prisma, sql/setup.sql, seed.ts
├── packages/core/       # @propigo/core — núcleo financiero (dinero, UF, IPC, calendario, RUT)
├── Docs/                # Documentación (técnica / funcional / gestión / decisiones)
├── BRAIN.md             # Contexto vivo del desarrollo (guía para asistentes/IA)
├── CONTRIBUTING.md      # Guía de contribución (ramas, commits, PRs, estilo)
└── docker-compose.yml   # PostgreSQL local
```

---

## Documentación

Todo vive en [`Docs/`](Docs/README.md), organizado en tres bloques: **Técnica**, **Funcional** y **Gestión**, más los **ADRs** (decisiones de arquitectura). Empieza por [`Docs/README.md`](Docs/README.md).

## Licencia

Software propietario de SOLIDIT. Todos los derechos reservados.
