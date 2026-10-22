-- Cambios que se aplicaron con `prisma db push` y nunca quedaron migrados:
-- sin esta migración, `prisma migrate deploy` sobre una base vacía (producción)
-- no reproduce el schema actual. Generada con `prisma migrate diff` desde el
-- historial de migraciones hacia schema.prisma. En bases que ya tienen estos
-- cambios (desarrollo) se marca como aplicada: `prisma migrate resolve --applied`.

-- AlterEnum
BEGIN;
CREATE TYPE "RolUsuario_new" AS ENUM ('manager', 'colaborador');
ALTER TABLE "public"."usuario" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "usuario" ALTER COLUMN "rol" TYPE "RolUsuario_new" USING ("rol"::text::"RolUsuario_new");
ALTER TYPE "RolUsuario" RENAME TO "RolUsuario_old";
ALTER TYPE "RolUsuario_new" RENAME TO "RolUsuario";
DROP TYPE "public"."RolUsuario_old";
ALTER TABLE "usuario" ALTER COLUMN "rol" SET DEFAULT 'colaborador';
COMMIT;

-- AlterEnum
ALTER TYPE "TipoAsiento" ADD VALUE 'REAJUSTE_GARANTIA';

-- AlterTable
ALTER TABLE "contrato" DROP COLUMN "multa_meses",
ADD COLUMN     "garantia_denominacion" "Denominacion",
ADD COLUMN     "garantia_monto_base" DECIMAL(14,4);

-- AlterTable
ALTER TABLE "propiedad" ADD COLUMN     "asignado_a_id" UUID;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "desactivado_en" TIMESTAMPTZ(6),
ALTER COLUMN "rol" SET DEFAULT 'colaborador';

-- CreateTable
CREATE TABLE "auditoria_equipo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "objetivo_id" UUID,
    "propiedad_id" UUID,
    "detalle" TEXT,
    "ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimiento_ia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "flujo" TEXT NOT NULL,
    "detalle" TEXT,
    "version" TEXT NOT NULL,
    "ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimiento_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigo_cambio_contacto" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "campo" TEXT NOT NULL,
    "valor_nuevo" TEXT NOT NULL,
    "codigo_hash" CHAR(64) NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "intentos" SMALLINT NOT NULL DEFAULT 0,
    "usado_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_cambio_contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitacion_colaborador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invitado_por_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "usado_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitacion_colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_equipo_tenant_id_created_at_idx" ON "auditoria_equipo"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "consentimiento_ia_usuario_id_flujo_idx" ON "consentimiento_ia"("usuario_id", "flujo");

-- CreateIndex
CREATE INDEX "codigo_cambio_contacto_usuario_id_idx" ON "codigo_cambio_contacto"("usuario_id");

-- CreateIndex
CREATE INDEX "invitacion_colaborador_token_hash_idx" ON "invitacion_colaborador"("token_hash");

-- CreateIndex
CREATE INDEX "invitacion_colaborador_invitado_por_id_idx" ON "invitacion_colaborador"("invitado_por_id");

-- CreateIndex
CREATE INDEX "propiedad_asignado_a_id_idx" ON "propiedad"("asignado_a_id");

-- AddForeignKey
ALTER TABLE "propiedad" ADD CONSTRAINT "propiedad_asignado_a_id_fkey" FOREIGN KEY ("asignado_a_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_equipo" ADD CONSTRAINT "auditoria_equipo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_equipo" ADD CONSTRAINT "auditoria_equipo_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_equipo" ADD CONSTRAINT "auditoria_equipo_objetivo_id_fkey" FOREIGN KEY ("objetivo_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_equipo" ADD CONSTRAINT "auditoria_equipo_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimiento_ia" ADD CONSTRAINT "consentimiento_ia_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimiento_ia" ADD CONSTRAINT "consentimiento_ia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_cambio_contacto" ADD CONSTRAINT "codigo_cambio_contacto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitacion_colaborador" ADD CONSTRAINT "invitacion_colaborador_invitado_por_id_fkey" FOREIGN KEY ("invitado_por_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

