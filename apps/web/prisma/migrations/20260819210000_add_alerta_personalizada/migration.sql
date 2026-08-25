-- CreateEnum
CREATE TYPE "DestinatarioAlerta" AS ENUM ('arrendatario', 'propietario');

-- CreateEnum
CREATE TYPE "DisparadorAlerta" AS ENUM ('antes_de_vencimiento', 'dias_de_mora');

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'alerta_personalizada';

-- AlterTable
ALTER TABLE "notificacion" ADD COLUMN     "alerta_id" UUID,
ADD COLUMN     "periodo_id" UUID;

-- CreateTable
CREATE TABLE "alerta_personalizada" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "asunto" TEXT NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "destinatario" "DestinatarioAlerta" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "disparador" "DisparadorAlerta",
    "dias_offset" SMALLINT,
    "creada_por_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_personalizada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerta_personalizada_tenant_id_idx" ON "alerta_personalizada"("tenant_id");

-- CreateIndex
CREATE INDEX "notificacion_alerta_id_periodo_id_idx" ON "notificacion"("alerta_id", "periodo_id");

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_alerta_id_fkey" FOREIGN KEY ("alerta_id") REFERENCES "alerta_personalizada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_personalizada" ADD CONSTRAINT "alerta_personalizada_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta_personalizada" ADD CONSTRAINT "alerta_personalizada_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

