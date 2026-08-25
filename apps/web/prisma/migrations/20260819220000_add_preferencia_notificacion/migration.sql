-- CreateTable
CREATE TABLE "preferencia_notificacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "suscrito" BOOLEAN NOT NULL DEFAULT true,
    "baja_hasta" DATE,
    "motivo" TEXT,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preferencia_notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "preferencia_notificacion_tenant_id_idx" ON "preferencia_notificacion"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "preferencia_notificacion_tenant_id_persona_id_key" ON "preferencia_notificacion"("tenant_id", "persona_id");

-- AddForeignKey
ALTER TABLE "preferencia_notificacion" ADD CONSTRAINT "preferencia_notificacion_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferencia_notificacion" ADD CONSTRAINT "preferencia_notificacion_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

