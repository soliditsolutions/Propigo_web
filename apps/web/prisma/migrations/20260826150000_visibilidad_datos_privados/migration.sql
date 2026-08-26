-- AlterTable
ALTER TABLE "cuenta_servicio" ADD COLUMN     "etiqueta" TEXT,
ADD COLUMN     "visible_en_portal" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "propiedad" ADD COLUMN     "rol_visible_en_portal" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "rol_complementario" ADD COLUMN     "visible_en_portal" BOOLEAN NOT NULL DEFAULT true;

