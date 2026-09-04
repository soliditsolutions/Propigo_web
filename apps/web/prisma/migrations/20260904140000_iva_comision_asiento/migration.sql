-- IVA de la comisión como tipo de asiento (L-IV). Lo soporta el propietario:
-- se descuenta de su liquidación junto con la comisión.
ALTER TYPE "TipoAsiento" ADD VALUE IF NOT EXISTS 'IVA_COMISION';
