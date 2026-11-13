-- CreateTable
CREATE TABLE "uso_ia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "flujo" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "tokens_entrada" INTEGER NOT NULL DEFAULT 0,
    "tokens_salida" INTEGER NOT NULL DEFAULT 0,
    "neuronas" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uso_ia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uso_ia_created_at_idx" ON "uso_ia"("created_at");
