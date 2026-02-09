-- ============================================================================
-- Fix: gastos_personales - secuencia desincronizada + constraint TERE faltante
-- Fecha: 2026-02-09
-- ============================================================================

-- 1. Resetear secuencia al MAX(id) actual para evitar duplicate key
SELECT setval(
  'gastos_personales_id_seq',
  (SELECT COALESCE(MAX(id), 0) FROM gastos_personales)
);

-- 2. Agregar 'TERE' al CHECK constraint de concepto
ALTER TABLE gastos_personales DROP CONSTRAINT IF EXISTS gastos_personales_concepto_check;

ALTER TABLE gastos_personales ADD CONSTRAINT gastos_personales_concepto_check
  CHECK (concepto = ANY (ARRAY[
    'Gaspar'::text,
    'Nacion'::text,
    'Efectivo'::text,
    'Patagonia'::text,
    'Credicoop'::text,
    'TERE'::text
  ]));
