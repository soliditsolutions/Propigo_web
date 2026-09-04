-- Folio legible de documentos (L-CP4): correlativo por corredora, tipo y año.

-- AlterTable
ALTER TABLE "voucher" ADD COLUMN     "folio" TEXT;

-- CreateTable
CREATE TABLE "folio_counter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "tipo" "TipoVoucher" NOT NULL,
    "anio" SMALLINT NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "folio_counter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "folio_counter_tenant_id_tipo_anio_key" ON "folio_counter"("tenant_id", "tipo", "anio");

-- AddForeignKey
ALTER TABLE "folio_counter" ADD CONSTRAINT "folio_counter_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
