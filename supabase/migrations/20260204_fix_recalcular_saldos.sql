-- ============================================================================
-- Fix: Funciones para recalcular saldos de cuentas corrientes
-- Migración: 20260204_fix_recalcular_saldos.sql
--
-- Problema: sincronizarMovimientos() y otras funciones crean movimientos
-- pero no actualizan cuentas_corrientes.saldo_actual, causando que
-- crear_movimiento_cc() lea saldos desactualizados.
--
-- Solución: Funciones que recalculan saldos desde los movimientos.
-- ============================================================================

-- ============================================================================
-- Función: Recalcular saldos de UNA cuenta específica
-- Recorre todos los movimientos en orden cronológico y recalcula saldo_resultante
-- Luego actualiza cuentas_corrientes.saldo_actual
-- ============================================================================
CREATE OR REPLACE FUNCTION recalcular_saldos_cuenta(p_cuenta_id BIGINT)
RETURNS TABLE(
  movimientos_actualizados INT,
  saldo_final NUMERIC(12,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_mov RECORD;
  v_saldo_actual NUMERIC(12,2) := 0;
  v_contador INT := 0;
BEGIN
  -- Recorrer movimientos en orden cronológico (fecha + created_at para desempate)
  FOR v_mov IN
    SELECT id, tipo_movimiento, monto
    FROM movimientos_cc
    WHERE cuenta_id = p_cuenta_id
    ORDER BY fecha ASC, created_at ASC
  LOOP
    -- Calcular nuevo saldo
    IF v_mov.tipo_movimiento = 'INGRESO' THEN
      v_saldo_actual := v_saldo_actual + v_mov.monto;
    ELSE -- EGRESO
      v_saldo_actual := v_saldo_actual - v_mov.monto;
    END IF;

    -- Actualizar saldo_resultante del movimiento
    UPDATE movimientos_cc
    SET saldo_resultante = v_saldo_actual
    WHERE id = v_mov.id;

    v_contador := v_contador + 1;
  END LOOP;

  -- Actualizar saldo_actual de la cuenta
  UPDATE cuentas_corrientes
  SET saldo_actual = v_saldo_actual
  WHERE id = p_cuenta_id;

  -- Retornar resultados
  movimientos_actualizados := v_contador;
  saldo_final := v_saldo_actual;
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- Función: Recalcular saldos de TODAS las cuentas
-- ============================================================================
CREATE OR REPLACE FUNCTION recalcular_todos_los_saldos()
RETURNS TABLE(
  cuenta_id BIGINT,
  cuenta_nombre TEXT,
  movimientos INT,
  saldo_anterior NUMERIC(12,2),
  saldo_nuevo NUMERIC(12,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuenta RECORD;
  v_resultado RECORD;
BEGIN
  FOR v_cuenta IN
    SELECT id, nombre, saldo_actual
    FROM cuentas_corrientes
    ORDER BY nombre
  LOOP
    -- Recalcular esta cuenta
    SELECT * INTO v_resultado FROM recalcular_saldos_cuenta(v_cuenta.id);

    -- Retornar info de esta cuenta
    cuenta_id := v_cuenta.id;
    cuenta_nombre := v_cuenta.nombre;
    movimientos := v_resultado.movimientos_actualizados;
    saldo_anterior := v_cuenta.saldo_actual;
    saldo_nuevo := v_resultado.saldo_final;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- Otorgar permisos
-- ============================================================================
GRANT EXECUTE ON FUNCTION recalcular_saldos_cuenta TO authenticated;
GRANT EXECUTE ON FUNCTION recalcular_todos_los_saldos TO authenticated;

-- ============================================================================
-- Comentarios
-- ============================================================================
COMMENT ON FUNCTION recalcular_saldos_cuenta IS
'Recalcula todos los saldo_resultante de movimientos_cc para una cuenta,
y actualiza cuentas_corrientes.saldo_actual con el saldo final.
Usar cuando los saldos estén desincronizados.';

COMMENT ON FUNCTION recalcular_todos_los_saldos IS
'Recalcula los saldos de TODAS las cuentas corrientes.
Retorna un resumen con saldo anterior vs nuevo para cada cuenta.';
