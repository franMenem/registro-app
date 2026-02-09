-- ============================================================================
-- Migracion: Propagacion dinamica de cambios de conceptos
-- Fecha: 2026-02-09
--
-- 1. Trigger que cascadea cambios de concepto.tipo a movimientos.tipo
-- 2. Campo column_key en conceptos (elimina mappings hardcodeados)
-- ============================================================================

-- ============================================================================
-- PARTE 1: Trigger cascada tipo concepto -> movimientos
-- Cuando se cambia conceptos.tipo, actualiza movimientos.tipo para mantener
-- consistencia historica.
-- ============================================================================

CREATE OR REPLACE FUNCTION cascada_tipo_concepto()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.tipo IS DISTINCT FROM NEW.tipo THEN
    UPDATE movimientos
    SET tipo = NEW.tipo
    WHERE concepto_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_concepto_tipo_cascada ON conceptos;

CREATE TRIGGER tr_concepto_tipo_cascada
  AFTER UPDATE OF tipo ON conceptos
  FOR EACH ROW
  EXECUTE FUNCTION cascada_tipo_concepto();

-- ============================================================================
-- PARTE 2: Agregar column_key a conceptos
-- Este campo almacena el key de columna usado en planillas
-- (ej: 'SUAT_PATENTES', 'GIT', 'ARANCEL')
-- Elimina la necesidad de mappings hardcodeados nombre->key
-- ============================================================================

ALTER TABLE conceptos ADD COLUMN IF NOT EXISTS column_key TEXT;

-- Migrar datos: RENTAS conceptos
UPDATE conceptos SET column_key = 'GIT' WHERE nombre = 'GIT';
UPDATE conceptos SET column_key = 'SUAT_ALTA' WHERE nombre = 'SUAT - Alta';
UPDATE conceptos SET column_key = 'SUAT_PATENTES' WHERE nombre = 'SUAT - Patentes';
UPDATE conceptos SET column_key = 'SUAT_INFRACCIONES' WHERE nombre = 'SUAT - Infracciones';
UPDATE conceptos SET column_key = 'SUCERP' WHERE nombre = 'SUCERP';
UPDATE conceptos SET column_key = 'SUGIT' WHERE nombre = 'SUGIT';
UPDATE conceptos SET column_key = 'PROVINCIA' WHERE nombre = 'PROVINCIA (ARBA)';
UPDATE conceptos SET column_key = 'CONSULTA' WHERE nombre = 'Consulta';
UPDATE conceptos SET column_key = 'POSNET' WHERE nombre = 'POSNET';
UPDATE conceptos SET column_key = 'ICBC' WHERE nombre = 'ICBC';

-- Migrar datos: CAJA conceptos
UPDATE conceptos SET column_key = 'ARANCEL' WHERE nombre = 'Arancel';
UPDATE conceptos SET column_key = 'SUAT_SELLADO' WHERE nombre = 'SUAT - Sellado';
UPDATE conceptos SET column_key = 'SUCERP_SELLADO' WHERE nombre = 'SUCERP - Sellado';
UPDATE conceptos SET column_key = 'CONSULTAS' WHERE nombre = 'Consultas CAJA';
UPDATE conceptos SET column_key = 'FORMULARIOS' WHERE nombre = 'Formularios';
UPDATE conceptos SET column_key = 'POSNET_CAJA' WHERE nombre = 'POSNET CAJA';

-- Para cualquier concepto que no tenga column_key asignado,
-- generar uno automaticamente desde el nombre (UPPER, reemplazar espacios/guiones)
UPDATE conceptos
SET column_key = UPPER(REPLACE(REPLACE(REPLACE(nombre, ' - ', '_'), ' ', '_'), '(', ''))
WHERE column_key IS NULL;

-- Ahora hacer NOT NULL y UNIQUE
ALTER TABLE conceptos ALTER COLUMN column_key SET NOT NULL;
ALTER TABLE conceptos ADD CONSTRAINT conceptos_column_key_unique UNIQUE (column_key);

-- Verificar resultado
-- SELECT id, nombre, tipo, column_key FROM conceptos ORDER BY tipo, nombre;
