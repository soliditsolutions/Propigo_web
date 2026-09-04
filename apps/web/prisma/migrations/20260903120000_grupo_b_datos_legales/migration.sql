-- Grupo B del rowMap de documentos legales: los datos que faltaban para poder
-- emitir un comprobante válido en Chile.
--
-- Sobre el RUT de la corredora: pasa a NOT NULL + UNIQUE. No es la clave
-- primaria —una PK no debería cambiar nunca y un RUT sí se corrige tras un
-- typo, y cambiarla obligaría a alterar tenant_id en las 29 tablas que lo
-- referencian y el cast ::uuid de cada política RLS— pero cumple el mismo rol
-- identificador: no puede faltar y no se puede repetir.
--
-- El UPDATE de abajo normaliza los RUT que se guardaron con puntos. Si queda
-- alguna corredora SIN Rut, el SET NOT NULL falla: es lo correcto, porque
-- ningún valor inventado sirve como identificador tributario. Hay que
-- completarlo a mano antes de migrar.

-- Normaliza a la forma canónica ("76.123.456-0" → "76123456-0").
UPDATE "tenant" SET "rut" = replace(replace("rut", '.', ''), ' ', '') WHERE "rut" IS NOT NULL;

-- AlterTable
ALTER TABLE "tenant" ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "es_persona_juridica" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "giro" TEXT,
ALTER COLUMN "rut" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tenant_rut_key" ON "tenant"("rut");

-- AlterTable
ALTER TABLE "propiedad" ADD COLUMN     "avaluo_fiscal" DECIMAL(14,0);

-- CreateEnum
CREATE TYPE "CausalTermino" AS ENUM ('mutuo_acuerdo', 'vencimiento_plazo', 'desahucio_arrendador', 'desahucio_arrendatario', 'no_pago_renta', 'incumplimiento_contrato', 'destruccion_inmueble', 'expiracion_derecho_arrendador', 'otra');

-- CreateEnum
CREATE TYPE "TipoCuentaBancaria" AS ENUM ('corriente', 'vista', 'ahorro', 'cuenta_rut');

-- AlterTable
ALTER TABLE "contrato" ADD COLUMN     "causal_termino" "CausalTermino",
ADD COLUMN     "es_amoblado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_notificacion_desahucio" DATE,
ADD COLUMN     "firmado_ante_notario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inscripcion_cbr_anio" SMALLINT,
ADD COLUMN     "inscripcion_cbr_conservador" TEXT,
ADD COLUMN     "inscripcion_cbr_fojas" TEXT,
ADD COLUMN     "inscripcion_cbr_numero" TEXT;

-- CreateTable
CREATE TABLE "cuenta_bancaria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "persona_id" UUID,
    "banco" TEXT NOT NULL,
    "tipo" "TipoCuentaBancaria" NOT NULL DEFAULT 'corriente',
    "numero" TEXT NOT NULL,
    "titular" TEXT NOT NULL,
    "rut_titular" TEXT NOT NULL,
    "email" TEXT,
    "visible_en_portal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_bancaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuenta_bancaria_tenant_id_idx" ON "cuenta_bancaria"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cuenta_bancaria_tenant_id_persona_id_key" ON "cuenta_bancaria"("tenant_id", "persona_id");

-- AddForeignKey
ALTER TABLE "cuenta_bancaria" ADD CONSTRAINT "cuenta_bancaria_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_bancaria" ADD CONSTRAINT "cuenta_bancaria_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
