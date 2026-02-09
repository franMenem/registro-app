-- ============================================================================
-- FIX: depositos.movimiento_origen_id FK apunta a tabla incorrecta
-- Fecha: 2026-02-10
--
-- PROBLEMA: El FK depositos_movimiento_origen_id_fkey apunta a "movimientos"
-- pero el código guarda IDs de "movimientos_cc" (al asociar depósito a cuenta).
-- Esto causa: "insert or update on table depositos violates foreign key
-- constraint depositos_movimiento_origen_id_fkey"
--
-- FIX: Cambiar FK para apuntar a movimientos_cc
-- ============================================================================

ALTER TABLE depositos
  DROP CONSTRAINT IF EXISTS depositos_movimiento_origen_id_fkey;

ALTER TABLE depositos
  ADD CONSTRAINT depositos_movimiento_origen_id_fkey
  FOREIGN KEY (movimiento_origen_id) REFERENCES movimientos_cc(id)
  ON DELETE SET NULL;
