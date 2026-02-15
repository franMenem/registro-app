-- ============================================================================
-- Funciones para cambiar la fecha de una planilla (CAJA o RENTAS)
--
-- Flujo: verificar que la fecha destino esté libre → limpiar fecha vieja →
--        re-insertar con fecha nueva via procesar_*_diario existente
-- ============================================================================

-- Verificar si existen datos para una fecha y tipo de planilla
CREATE OR REPLACE FUNCTION verificar_fecha_planilla(p_fecha DATE, p_tipo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM movimientos WHERE fecha = p_fecha AND tipo = p_tipo
  );
END;
$$;

-- Limpiar todos los datos asociados a una fecha y tipo de planilla.
-- Replica exactamente la fase de cleanup de procesar_caja_diario / procesar_rentas_diario
-- para garantizar consistencia.
CREATE OR REPLACE FUNCTION limpiar_planilla_fecha(p_fecha DATE, p_tipo TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INTEGER := 0;
  v_deleted INTEGER;
BEGIN
  IF p_tipo = 'CAJA' THEN
    DELETE FROM movimientos WHERE fecha = p_fecha AND tipo = 'CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM movimientos_cc WHERE fecha = p_fecha AND concepto = 'CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM control_veps WHERE fecha = p_fecha AND observaciones = 'Registro diario CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM control_epagos WHERE fecha = p_fecha AND observaciones = 'Registro diario CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM gastos_registrales WHERE fecha = p_fecha AND origen = 'CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM gastos_personales WHERE fecha = p_fecha AND observaciones = 'Registro diario CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM adelantos_empleados WHERE fecha_adelanto = p_fecha AND origen = 'CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM movimientos_efectivo WHERE fecha = p_fecha AND concepto = 'Efectivo CAJA entregado';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM gastos_deposito WHERE fecha = p_fecha AND tipo = 'CAJA';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

  ELSIF p_tipo = 'RENTAS' THEN
    DELETE FROM movimientos WHERE fecha = p_fecha AND tipo = 'RENTAS';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM movimientos_cc WHERE fecha = p_fecha AND concepto = 'RENTAS';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM movimientos_efectivo WHERE fecha = p_fecha AND concepto = 'Efectivo RENTAS entregado';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

    DELETE FROM gastos_deposito WHERE fecha = p_fecha AND tipo = 'RENTAS';
    GET DIAGNOSTICS v_deleted = ROW_COUNT; v_total := v_total + v_deleted;

  ELSE
    RAISE EXCEPTION 'Tipo de planilla inválido: %. Usar CAJA o RENTAS.', p_tipo;
  END IF;

  RETURN v_total;
END;
$$;
