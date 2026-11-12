-- CreateTable
CREATE TABLE "solicitud_derecho" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio" TEXT NOT NULL,
    "derecho" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'recibida',
    "ip" INET,
    "recibida_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vence_at" TIMESTAMPTZ(6) NOT NULL,
    "respondida_at" TIMESTAMPTZ(6),
    "avisada_at" TIMESTAMPTZ(6),

    CONSTRAINT "solicitud_derecho_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_derecho_folio_key" ON "solicitud_derecho"("folio");

-- CreateIndex
CREATE INDEX "solicitud_derecho_estado_vence_at_idx" ON "solicitud_derecho"("estado", "vence_at");

-- CreateIndex
CREATE INDEX "solicitud_derecho_recibida_at_idx" ON "solicitud_derecho"("recibida_at");

