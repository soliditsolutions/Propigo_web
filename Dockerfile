# syntax=docker/dockerfile:1.7
#
# Imagen de producción de Propigo (Next.js standalone) — ver
# Docs/tecnica/despliegue-produccion.md.
#
#   docker build --build-arg NEXT_PUBLIC_APP_URL=https://propigo.cl -t propigo-web .
#   docker build --target migraciones -t propigo-migraciones .
#
# Ningún secreto entra a la imagen: DATABASE_URL, AUTH_SECRET, GROQ_API_KEY,
# CRON_SECRET, RESEND_API_KEY se inyectan como variables de entorno al correr.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ── Dependencias (capa cacheable: solo cambia si cambia el lockfile) ─────────
FROM base AS deps
# openssl: lo necesita el motor de esquema de Prisma (migrate) en esta imagen
# y en la de migraciones; el runtime usa el driver adapter de pg y no lo requiere.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN npm ci

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
# Next incrusta las variables NEXT_PUBLIC_* al compilar (también en el código
# de servidor): la URL pública debe pasarse aquí, no solo en runtime.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN test -n "$NEXT_PUBLIC_APP_URL" || (echo "Falta --build-arg NEXT_PUBLIC_APP_URL" && exit 1)
RUN npm run db:generate -w @propigo/web && npm run build -w @propigo/web

# ── Migraciones: tarea aparte, con el rol dueño (DATABASE_ADMIN_URL) ─────────
# Aplica migraciones versionadas y luego setup.sql (RLS, trigger, vistas, rol
# de runtime). Idempotente: se corre antes de cada despliegue.
FROM build AS migraciones
WORKDIR /app/apps/web
USER node
CMD ["npm", "run", "db:deploy"]

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
# Directorios de subida escribibles por el usuario sin privilegios.
# OJO: el disco del contenedor es efímero — ver "Almacenamiento" en el runbook.
RUN mkdir -p apps/web/private-uploads/documentos apps/web/public/uploads \
 && chown -R node:node apps/web/private-uploads apps/web/public/uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
