-- M-21 (auditoría de mensajes 2026-11): estado de entrega del correo de cada
-- consulta del marketplace, para reintentar las que no salieron.
ALTER TABLE "consulta_contacto"
  ADD COLUMN "correo_enviado_en" TIMESTAMPTZ(6),
  ADD COLUMN "intentos_envio" INTEGER NOT NULL DEFAULT 0;

-- Las consultas anteriores a esta migración se dan por entregadas: no hay
-- forma de saber cuáles fallaron y reenviar consultas viejas confundiría al
-- corredor.
UPDATE "consulta_contacto" SET "correo_enviado_en" = "created_at";

CREATE INDEX "consulta_contacto_correo_enviado_en_created_at_idx"
  ON "consulta_contacto"("correo_enviado_en", "created_at");
