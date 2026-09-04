-- Estado para las notificaciones de ciclo de vida que quedan obsoletas cuando
-- sale una más nueva del mismo contrato (ver lib/notificaciones-ciclo.ts).
-- No se enviaron: no es un fallo, es un colapso intencional.
ALTER TYPE "EstadoNotificacion" ADD VALUE IF NOT EXISTS 'reemplazada';
