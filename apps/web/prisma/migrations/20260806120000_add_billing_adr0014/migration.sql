-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('trial', 'activa', 'pago_pendiente', 'suspendida', 'cancelada', 'expirada');

-- CreateEnum
CREATE TYPE "CicloFacturacion" AS ENUM ('mensual', 'anual');

-- CreateEnum
CREATE TYPE "TipoCargo" AS ENUM ('suscripcion', 'comision_plataforma');

-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('pendiente', 'pagado', 'fallido', 'reembolsado');

-- CreateEnum
CREATE TYPE "EstadoComision" AS ENUM ('devengada', 'facturada', 'anulada');

-- CreateTable
CREATE TABLE "suscripcion_tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "plan_id" TEXT NOT NULL,
    "ciclo" "CicloFacturacion" NOT NULL,
    "estado" "EstadoSuscripcion" NOT NULL DEFAULT 'activa',
    "gateway_ref" TEXT,
    "medio_pago_ref" TEXT,
    "periodo_actual_hasta" TIMESTAMPTZ(6) NOT NULL,
    "cancela_al_fin_del_periodo" BOOLEAN NOT NULL DEFAULT false,
    "plan_agendado_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "suscripcion_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_billing" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "suscripcion_id" UUID,
    "tipo" "TipoCargo" NOT NULL,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'pendiente',
    "periodo" TEXT NOT NULL,
    "monto_neto_clp" DECIMAL(14,0) NOT NULL,
    "iva_clp" DECIMAL(14,0) NOT NULL,
    "monto_total_clp" DECIMAL(14,0) NOT NULL,
    "monto_uf" DECIMAL(14,4),
    "uf_aplicada" DECIMAL(12,2),
    "idempotency_key" TEXT NOT NULL,
    "gateway_ref" TEXT,
    "intentos" SMALLINT NOT NULL DEFAULT 0,
    "ultimo_error_categoria" TEXT,
    "ultimo_error_mensaje" TEXT,
    "pagado_en" TIMESTAMPTZ(6),
    "mora_notificada_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cargo_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comision_plataforma" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "pago_entrante_id" UUID NOT NULL,
    "estado" "EstadoComision" NOT NULL DEFAULT 'devengada',
    "monto_clp" DECIMAL(14,0) NOT NULL,
    "cargo_id" UUID,
    "devengada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comision_plataforma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_gateway_pago" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proveedor" TEXT NOT NULL,
    "id_externo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "procesado_en" TIMESTAMPTZ(6),
    "error_proceso" TEXT,
    "recibido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evento_gateway_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "suscripcion_tenant_tenant_id_idx" ON "suscripcion_tenant"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_billing_idempotency_key_key" ON "cargo_billing"("idempotency_key");

-- CreateIndex
CREATE INDEX "cargo_billing_tenant_id_idx" ON "cargo_billing"("tenant_id");

-- CreateIndex
CREATE INDEX "cargo_billing_estado_idx" ON "cargo_billing"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "comision_plataforma_pago_entrante_id_key" ON "comision_plataforma"("pago_entrante_id");

-- CreateIndex
CREATE INDEX "comision_plataforma_tenant_id_idx" ON "comision_plataforma"("tenant_id");

-- CreateIndex
CREATE INDEX "comision_plataforma_estado_idx" ON "comision_plataforma"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "evento_gateway_pago_id_externo_key" ON "evento_gateway_pago"("id_externo");

-- CreateIndex
CREATE INDEX "evento_gateway_pago_proveedor_tipo_idx" ON "evento_gateway_pago"("proveedor", "tipo");

-- AddForeignKey
ALTER TABLE "suscripcion_tenant" ADD CONSTRAINT "suscripcion_tenant_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_billing" ADD CONSTRAINT "cargo_billing_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_billing" ADD CONSTRAINT "cargo_billing_suscripcion_id_fkey" FOREIGN KEY ("suscripcion_id") REFERENCES "suscripcion_tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision_plataforma" ADD CONSTRAINT "comision_plataforma_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision_plataforma" ADD CONSTRAINT "comision_plataforma_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargo_billing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision_plataforma" ADD CONSTRAINT "comision_plataforma_pago_entrante_id_fkey" FOREIGN KEY ("pago_entrante_id") REFERENCES "pago_entrante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

