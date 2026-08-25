-- CreateEnum
CREATE TYPE "AlcanceBaja" AS ENUM ('solo_opcionales', 'todos');

-- AlterTable
ALTER TABLE "preferencia_notificacion" ADD COLUMN     "alcance" "AlcanceBaja" NOT NULL DEFAULT 'solo_opcionales';

