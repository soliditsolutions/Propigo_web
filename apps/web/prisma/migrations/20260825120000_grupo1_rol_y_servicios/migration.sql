-- CreateEnum
CREATE TYPE "TipoServicioBasico" AS ENUM ('agua', 'luz', 'gas', 'gastos_comunes', 'otro');

-- CreateEnum
CREATE TYPE "EstadoCuentaServicio" AS ENUM ('registrada', 'no_aplica');

-- CreateEnum
CREATE TYPE "PagadorServicio" AS ENUM ('arrendatario', 'propietario');

-- CreateEnum
CREATE TYPE "TipoRolComplementario" AS ENUM ('estacionamiento', 'bodega', 'otro');

-- AlterTable
-- El rol es obligatorio, pero la tabla ya tiene filas: un ADD COLUMN NOT NULL
-- directo abortaría la migración. Se agrega en tres pasos, y el relleno usa un
-- valor que se reconoce a simple vista como pendiente de completar.
ALTER TABLE "propiedad" ADD COLUMN "rol" TEXT;
UPDATE "propiedad" SET "rol" = '0-0' WHERE "rol" IS NULL;
ALTER TABLE "propiedad" ALTER COLUMN "rol" SET NOT NULL;

-- CreateTable
CREATE TABLE "cuenta_servicio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "tipo" "TipoServicioBasico" NOT NULL,
    "estado" "EstadoCuentaServicio" NOT NULL DEFAULT 'registrada',
    "numero" TEXT,
    "empresa" TEXT,
    "titular" TEXT,
    "paga" "PagadorServicio" NOT NULL DEFAULT 'arrendatario',
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuenta_servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_complementario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "tipo" "TipoRolComplementario" NOT NULL,
    "rol" TEXT NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_complementario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuenta_servicio_tenant_id_idx" ON "cuenta_servicio"("tenant_id");

-- CreateIndex
CREATE INDEX "cuenta_servicio_propiedad_id_idx" ON "cuenta_servicio"("propiedad_id");

-- CreateIndex
CREATE INDEX "rol_complementario_tenant_id_idx" ON "rol_complementario"("tenant_id");

-- CreateIndex
CREATE INDEX "rol_complementario_propiedad_id_idx" ON "rol_complementario"("propiedad_id");

-- AddForeignKey
ALTER TABLE "cuenta_servicio" ADD CONSTRAINT "cuenta_servicio_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuenta_servicio" ADD CONSTRAINT "cuenta_servicio_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_complementario" ADD CONSTRAINT "rol_complementario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_complementario" ADD CONSTRAINT "rol_complementario_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

