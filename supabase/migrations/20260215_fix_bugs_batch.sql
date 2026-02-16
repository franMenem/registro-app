-- Fix: Eliminar concepto "DEPOSITOS" fantasma (id=16) de la tabla conceptos.
-- Los depósitos se manejan estáticamente como DEPOSITO_1..12 en gastos_deposito.

DELETE FROM conceptos WHERE id = 16;
