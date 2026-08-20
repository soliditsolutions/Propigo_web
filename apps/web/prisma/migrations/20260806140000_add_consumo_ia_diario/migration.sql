-- CreateTable
CREATE TABLE "consumo_ia_diario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "usados" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consumo_ia_diario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consumo_ia_diario_tenant_id_idx" ON "consumo_ia_diario"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumo_ia_diario_tenant_id_fecha_key" ON "consumo_ia_diario"("tenant_id", "fecha");

-- AddForeignKey
ALTER TABLE "consumo_ia_diario" ADD CONSTRAINT "consumo_ia_diario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

