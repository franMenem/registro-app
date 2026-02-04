-- ============================================================================
-- Fix: Marcar formularios de 2021-2024 como PAGADO
-- Migración: 20260204_fix_formularios_historicos.sql
--
-- Problema: Los formularios de 2021-2024 aparecen como PENDIENTE cuando ya
-- fueron pagados fuera del sistema.
--
-- Solución: Marcar el 3er vencimiento como PAGADO (solo se necesita 1 vencimiento
-- pagado para que el formulario aparezca en "Históricos")
-- ============================================================================

-- ============================================================================
-- Paso 1: Ver cuántos formularios se van a afectar (query de verificación)
-- ============================================================================
-- SELECT
--   f.id,
--   f.numero,
--   v3.fecha_vencimiento as fecha_3er_venc,
--   v3.estado as estado_3er_venc,
--   EXTRACT(YEAR FROM v3.fecha_vencimiento::DATE) as anio_3er_venc
-- FROM formularios f
-- JOIN formularios_vencimientos v3 ON v3.formulario_id = f.id AND v3.numero_vencimiento = 3
-- WHERE
--   v3.estado = 'PENDIENTE'
--   AND EXTRACT(YEAR FROM v3.fecha_vencimiento::DATE) < 2025
-- ORDER BY v3.fecha_vencimiento;

-- ============================================================================
-- Paso 2: Función para marcar formularios históricos como pagados
-- ============================================================================
CREATE OR REPLACE FUNCTION marcar_formularios_historicos_pagados(
  p_anio_limite INT DEFAULT 2025  -- Marcar formularios con 3er vencimiento antes de este año
)
RETURNS TABLE(
  formularios_actualizados INT,
  detalle JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT := 0;
  v_detalle JSONB := '[]'::JSONB;
  v_venc RECORD;
BEGIN
  -- Actualizar todos los vencimientos #3 que están PENDIENTE y son anteriores al año límite
  FOR v_venc IN
    SELECT
      v.id as vencimiento_id,
      v.fecha_vencimiento,
      f.id as formulario_id,
      f.numero as formulario_numero
    FROM formularios_vencimientos v
    JOIN formularios f ON f.id = v.formulario_id
    WHERE
      v.numero_vencimiento = 3
      AND v.estado IN ('PENDIENTE', 'VENCIDO')
      AND EXTRACT(YEAR FROM v.fecha_vencimiento::DATE) < p_anio_limite
  LOOP
    -- Marcar como PAGADO usando la fecha del vencimiento como fecha_pago
    UPDATE formularios_vencimientos
    SET
      estado = 'PAGADO',
      fecha_pago = fecha_vencimiento,
      updated_at = NOW()
    WHERE id = v_venc.vencimiento_id;

    v_count := v_count + 1;

    -- Agregar al detalle
    v_detalle := v_detalle || jsonb_build_object(
      'formulario_id', v_venc.formulario_id,
      'numero', v_venc.formulario_numero,
      'fecha_vencimiento', v_venc.fecha_vencimiento
    );
  END LOOP;

  formularios_actualizados := v_count;
  detalle := v_detalle;
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- Paso 3: Función para ver formularios pendientes por año
-- ============================================================================
CREATE OR REPLACE FUNCTION ver_formularios_pendientes_por_anio()
RETURNS TABLE(
  anio INT,
  cantidad_formularios BIGINT,
  ejemplo_numeros TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(YEAR FROM v3.fecha_vencimiento::DATE)::INT as anio,
    COUNT(DISTINCT f.id) as cantidad_formularios,
    ARRAY_AGG(DISTINCT f.numero ORDER BY f.numero) FILTER (WHERE f.numero IS NOT NULL) as ejemplo_numeros
  FROM formularios f
  JOIN formularios_vencimientos v3 ON v3.formulario_id = f.id AND v3.numero_vencimiento = 3
  WHERE
    -- Formulario no tiene ningún vencimiento PAGADO
    NOT EXISTS (
      SELECT 1 FROM formularios_vencimientos vp
      WHERE vp.formulario_id = f.id AND vp.estado = 'PAGADO'
    )
  GROUP BY EXTRACT(YEAR FROM v3.fecha_vencimiento::DATE)
  ORDER BY anio;
END;
$$;

-- ============================================================================
-- Permisos
-- ============================================================================
GRANT EXECUTE ON FUNCTION marcar_formularios_historicos_pagados TO authenticated;
GRANT EXECUTE ON FUNCTION ver_formularios_pendientes_por_anio TO authenticated;

-- ============================================================================
-- Comentarios
-- ============================================================================
COMMENT ON FUNCTION marcar_formularios_historicos_pagados IS
'Marca como PAGADO el 3er vencimiento de todos los formularios anteriores al año límite.
Usar cuando se migraron datos históricos que ya fueron pagados fuera del sistema.
Por defecto marca todos los de antes de 2025.';

COMMENT ON FUNCTION ver_formularios_pendientes_por_anio IS
'Muestra cuántos formularios pendientes hay por año (basado en fecha del 3er vencimiento).';
