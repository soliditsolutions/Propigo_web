-- CreateTable
CREATE TABLE "codigo_rectificacion_persona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "campo" TEXT NOT NULL,
    "valor_nuevo" TEXT NOT NULL,
    "codigo_hash" CHAR(64) NOT NULL,
    "expira_at" TIMESTAMPTZ(6) NOT NULL,
    "intentos" SMALLINT NOT NULL DEFAULT 0,
    "usado_at" TIMESTAMPTZ(6),
    "ip_solicitud" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_rectificacion_persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_derecho_persona" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "derecho" TEXT NOT NULL,
    "detalle" TEXT,
    "ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_derecho_persona_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigo_rectificacion_persona_tenant_id_idx" ON "codigo_rectificacion_persona"("tenant_id");

-- CreateIndex
CREATE INDEX "codigo_rectificacion_persona_persona_id_idx" ON "codigo_rectificacion_persona"("persona_id");

-- CreateIndex
CREATE INDEX "solicitud_derecho_persona_tenant_id_idx" ON "solicitud_derecho_persona"("tenant_id");

-- CreateIndex
CREATE INDEX "solicitud_derecho_persona_persona_id_idx" ON "solicitud_derecho_persona"("persona_id");

-- AddForeignKey
ALTER TABLE "codigo_rectificacion_persona" ADD CONSTRAINT "codigo_rectificacion_persona_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigo_rectificacion_persona" ADD CONSTRAINT "codigo_rectificacion_persona_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_derecho_persona" ADD CONSTRAINT "solicitud_derecho_persona_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_derecho_persona" ADD CONSTRAINT "solicitud_derecho_persona_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

