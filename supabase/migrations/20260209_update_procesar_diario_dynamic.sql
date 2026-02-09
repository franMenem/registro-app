-- ============================================================================
-- Migracion: Actualizar procesar_rentas_diario y procesar_caja_diario
-- para usar column_key desde tabla conceptos en vez de mappings hardcodeados.
-- Fecha: 2026-02-09
--
-- CAMBIO PRINCIPAL: Se elimina v_concepto_map y se usa column_key directo.
-- Esto permite que al cambiar el tipo de un concepto, las funciones
-- automáticamente lo procesen en la planilla correcta.
-- ============================================================================

-- ============================================================================
-- procesar_rentas_diario (version dinamica)
-- ============================================================================
CREATE OR REPLACE FUNCTION procesar_rentas_diario(
  p_fecha DATE,
  p_values JSONB,
  p_entregado NUMERIC(12,2)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_concepto RECORD;
  v_total_movimientos INT := 0;
  v_alertas TEXT[] := ARRAY[]::TEXT[];
  v_monto NUMERIC(12,2);
  v_key TEXT;
  v_cuit TEXT := '00-00000000-0';

  -- Totales para calculo de diferencia
  v_total_suman NUMERIC(12,2) := 0;
  v_total_restan NUMERIC(12,2) := 0;
  v_total_gastos NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_diferencia NUMERIC(12,2);

  -- Mapeo cuenta -> key JSON para gastos (CC accounts are static)
  v_cuenta_map JSONB := '{
    "ICBC": "ICBC",
    "FORD": "FORD",
    "SICARDI": "SICARDI",
    "PATAGONIA": "PATAGONIA",
    "IVECO": "IVECO",
    "CNH": "CNH",
    "GESTORIA FORD": "GESTORIA_FORD",
    "ALRA": "ALRA"
  }'::JSONB;

  v_cuenta_nombre TEXT;
  v_cuenta_key TEXT;
BEGIN
  -- ========================================
  -- 1. Procesar conceptos RENTAS
  --    Usa column_key desde la tabla conceptos (dinamico)
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago, column_key
    FROM conceptos
    WHERE tipo = 'RENTAS'
  LOOP
    -- column_key directo de la tabla, sin mapping hardcodeado
    v_key := v_concepto.column_key;

    IF v_key IS NOT NULL THEN
      v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);

      IF v_monto > 0 THEN
        -- Insertar movimiento
        INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
        VALUES (p_fecha, 'RENTAS', v_cuit, v_concepto.id, v_monto,
                'Registro diario - ' || v_concepto.nombre);

        v_total_movimientos := v_total_movimientos + 1;

        -- Acumular para totales (POSNET resta, ICBC va a cuentas, resto suma)
        IF v_concepto.nombre IN ('POSNET') THEN
          v_total_restan := v_total_restan + v_monto;
        ELSIF v_concepto.nombre NOT IN ('ICBC') THEN
          v_total_suman := v_total_suman + v_monto;
        END IF;

        -- Control semanal
        IF v_concepto.frecuencia_pago = 'SEMANAL' THEN
          PERFORM upsert_control_semanal(v_concepto.id, p_fecha, v_monto);
          v_alertas := array_append(v_alertas,
            'Control semanal actualizado para ' || v_concepto.nombre);
        END IF;

        -- Control quincenal
        IF v_concepto.frecuencia_pago = 'QUINCENAL' THEN
          PERFORM upsert_control_quincenal(v_concepto.id, p_fecha, v_monto);
          v_alertas := array_append(v_alertas,
            'Control quincenal actualizado para ' || v_concepto.nombre);
        END IF;

        -- POSNET mensual
        IF v_concepto.nombre = 'POSNET' THEN
          PERFORM upsert_control_posnet(p_fecha, v_monto, 'RENTAS');
          v_alertas := array_append(v_alertas, 'Control POSNET mensual actualizado.');
        END IF;

        -- Movimiento cuenta ICBC
        IF v_concepto.nombre = 'ICBC' THEN
          PERFORM crear_movimiento_cc('ICBC', p_fecha, 'EGRESO', 'RENTAS', v_monto);
          v_alertas := array_append(v_alertas,
            'Egreso registrado en cuenta "ICBC" por $' || v_monto::TEXT);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- ========================================
  -- 2. Procesar DEPOSITOS (solo para totales)
  -- ========================================
  v_monto := COALESCE((p_values->>'DEPOSITOS')::NUMERIC, 0);
  IF v_monto > 0 THEN
    v_total_restan := v_total_restan + v_monto;
    v_alertas := array_append(v_alertas,
      'DEPOSITOS: $' || v_monto::TEXT || ' (restado del total)');
  END IF;

  -- ========================================
  -- 3. Procesar gastos a cuentas corrientes
  -- ========================================
  FOR v_cuenta_nombre, v_cuenta_key IN
    SELECT key, value FROM jsonb_each_text(v_cuenta_map)
  LOOP
    -- ICBC ya se proceso arriba
    IF v_cuenta_nombre = 'ICBC' THEN
      CONTINUE;
    END IF;

    v_monto := COALESCE((p_values->>v_cuenta_key)::NUMERIC, 0);
    IF v_monto > 0 THEN
      IF crear_movimiento_cc(v_cuenta_nombre, p_fecha, 'EGRESO', 'RENTAS', v_monto) IS NOT NULL THEN
        v_alertas := array_append(v_alertas,
          'Egreso registrado en cuenta "' || v_cuenta_nombre || '" por $' || v_monto::TEXT);
        v_total_movimientos := v_total_movimientos + 1;
      ELSE
        v_alertas := array_append(v_alertas,
          'Advertencia: Cuenta "' || v_cuenta_nombre || '" no encontrada');
      END IF;
      v_total_gastos := v_total_gastos + v_monto;
    END IF;
  END LOOP;

  -- ========================================
  -- 4. Calcular diferencia
  -- ========================================
  v_total := v_total_suman - v_total_restan - v_total_gastos;
  v_diferencia := p_entregado - v_total;

  -- ========================================
  -- 5. Registrar efectivo entregado
  -- ========================================
  IF p_entregado > 0 THEN
    INSERT INTO movimientos_efectivo (fecha, tipo, concepto, monto, observaciones)
    VALUES (
      p_fecha, 'INGRESO', 'Efectivo RENTAS entregado', p_entregado,
      CASE WHEN v_diferencia != 0
        THEN 'Diferencia: ' || CASE WHEN v_diferencia > 0 THEN '+' ELSE '' END || v_diferencia::TEXT
        ELSE NULL
      END
    );
  END IF;

  -- ========================================
  -- Retornar resultado
  -- ========================================
  RETURN jsonb_build_object(
    'message', 'Registro RENTAS guardado exitosamente. ' || v_total_movimientos || ' movimientos creados.',
    'data', jsonb_build_object(
      'totalMovimientos', v_total_movimientos,
      'diferencia', v_diferencia,
      'alertas', v_alertas
    )
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error procesando RENTAS diario: %', SQLERRM;
END;
$$;

-- ============================================================================
-- procesar_caja_diario (version dinamica)
-- ============================================================================
CREATE OR REPLACE FUNCTION procesar_caja_diario(
  p_fecha DATE,
  p_values JSONB,
  p_entregado NUMERIC(12,2)
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_concepto RECORD;
  v_total_movimientos INT := 0;
  v_alertas TEXT[] := ARRAY[]::TEXT[];
  v_monto NUMERIC(12,2);
  v_key TEXT;
  v_cuit TEXT := '00-00000000-0';
  v_i INT;

  -- Totales para calculo de diferencia
  v_total_suman NUMERIC(12,2) := 0;
  v_total_restan NUMERIC(12,2) := 0;
  v_total_otros_gastos NUMERIC(12,2) := 0;
  v_total_gastos_cuentas NUMERIC(12,2) := 0;
  v_total_depositos NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_diferencia NUMERIC(12,2);

  -- Mapeo cuenta -> key JSON (CC accounts are static)
  v_cuenta_map JSONB := '{
    "ICBC": "ICBC",
    "FORD": "FORD",
    "SICARDI": "SICARDI",
    "PATAGONIA": "PATAGONIA",
    "IVECO": "IVECO",
    "CNH": "CNH",
    "GESTORIA FORD": "GESTORIA_FORD",
    "ALRA": "ALRA"
  }'::JSONB;

  v_cuenta_nombre TEXT;
  v_cuenta_key TEXT;
  v_empleado TEXT;
BEGIN
  -- ========================================
  -- 1. Procesar conceptos CAJA
  --    Usa column_key desde la tabla conceptos (dinamico)
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago, column_key
    FROM conceptos
    WHERE tipo = 'CAJA'
  LOOP
    -- column_key directo de la tabla, sin mapping hardcodeado
    v_key := v_concepto.column_key;

    IF v_key IS NOT NULL THEN
      v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);

      IF v_monto > 0 THEN
        INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
        VALUES (p_fecha, 'CAJA', v_cuit, v_concepto.id, v_monto,
                'Registro diario - ' || v_concepto.nombre);

        v_total_movimientos := v_total_movimientos + 1;

        -- Acumular para totales
        IF v_concepto.nombre = 'POSNET CAJA' THEN
          v_total_restan := v_total_restan + v_monto;
        ELSE
          v_total_suman := v_total_suman + v_monto;
        END IF;

        -- Control semanal
        IF v_concepto.frecuencia_pago = 'SEMANAL' THEN
          PERFORM upsert_control_semanal(v_concepto.id, p_fecha, v_monto);
          v_alertas := array_append(v_alertas,
            'Control semanal actualizado para ' || v_concepto.nombre);
        END IF;

        -- POSNET CAJA mensual
        IF v_concepto.nombre = 'POSNET CAJA' THEN
          PERFORM upsert_control_posnet(p_fecha, v_monto, 'CAJA');
          v_alertas := array_append(v_alertas, 'Control POSNET mensual actualizado.');
        END IF;

        -- Formularios -> cuenta Gastos Formularios
        IF v_concepto.nombre = 'Formularios' THEN
          PERFORM crear_movimiento_cc('Gastos Formularios', p_fecha, 'EGRESO', 'CAJA', v_monto);
          v_alertas := array_append(v_alertas,
            'Egreso registrado en cuenta "Gastos Formularios" por $' || v_monto::TEXT);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- ========================================
  -- 2. VEP y ePagos
  -- ========================================
  v_monto := COALESCE((p_values->>'VEP')::NUMERIC, 0);
  IF v_monto > 0 THEN
    INSERT INTO control_veps (fecha, monto, observaciones)
    VALUES (p_fecha, v_monto, 'Registro diario CAJA');
    v_total_restan := v_total_restan + v_monto;
    v_alertas := array_append(v_alertas, 'VEP registrado: $' || v_monto::TEXT);
  END IF;

  v_monto := COALESCE((p_values->>'EPAGOS')::NUMERIC, 0);
  IF v_monto > 0 THEN
    INSERT INTO control_epagos (fecha, monto, observaciones)
    VALUES (p_fecha, v_monto, 'Registro diario CAJA');
    v_total_restan := v_total_restan + v_monto;
    v_alertas := array_append(v_alertas, 'ePago registrado: $' || v_monto::TEXT);
  END IF;

  -- ========================================
  -- 3. Depositos (12 posibles)
  -- ========================================
  FOR v_i IN 1..12 LOOP
    v_monto := COALESCE((p_values->>'DEPOSITO_' || v_i)::NUMERIC, 0);
    IF v_monto > 0 THEN
      v_total_depositos := v_total_depositos + v_monto;
    END IF;
  END LOOP;

  IF v_total_depositos > 0 THEN
    v_total_restan := v_total_restan + v_total_depositos;
    v_alertas := array_append(v_alertas,
      'Total depositos: $' || v_total_depositos::TEXT || ' (restados del total)');
  END IF;

  -- ========================================
  -- 4. Gastos a cuentas corrientes
  -- ========================================
  FOR v_cuenta_nombre, v_cuenta_key IN
    SELECT key, value FROM jsonb_each_text(v_cuenta_map)
  LOOP
    v_monto := COALESCE((p_values->>v_cuenta_key)::NUMERIC, 0);
    IF v_monto > 0 THEN
      IF crear_movimiento_cc(v_cuenta_nombre, p_fecha, 'EGRESO', 'CAJA', v_monto) IS NOT NULL THEN
        v_alertas := array_append(v_alertas,
          'Egreso registrado en cuenta "' || v_cuenta_nombre || '" por $' || v_monto::TEXT);
        v_total_movimientos := v_total_movimientos + 1;
      END IF;
      v_total_gastos_cuentas := v_total_gastos_cuentas + v_monto;
    END IF;
  END LOOP;

  -- ========================================
  -- 5. Gastos registrales (LIBRERIA, AGUA, EDESUR, ACARA)
  -- ========================================
  FOREACH v_key IN ARRAY ARRAY['LIBRERIA', 'AGUA', 'EDESUR', 'ACARA'] LOOP
    v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);
    IF v_monto > 0 THEN
      INSERT INTO gastos_registrales (fecha, concepto, monto, observaciones, origen)
      VALUES (p_fecha, INITCAP(LOWER(v_key)), v_monto, 'Registro diario CAJA', 'CAJA');
      v_alertas := array_append(v_alertas,
        'Gasto registral "' || v_key || '" registrado: $' || v_monto::TEXT);
      v_total_otros_gastos := v_total_otros_gastos + v_monto;
    END IF;
  END LOOP;

  -- ========================================
  -- 6. Adelantos empleados (MARIA, TERE, DAMI, MUMI)
  -- ========================================
  FOREACH v_empleado IN ARRAY ARRAY['MARIA', 'TERE', 'DAMI', 'MUMI'] LOOP
    v_monto := COALESCE((p_values->>v_empleado)::NUMERIC, 0);
    IF v_monto > 0 THEN
      INSERT INTO adelantos_empleados (empleado, fecha_adelanto, monto, estado, observaciones, origen)
      VALUES (INITCAP(LOWER(v_empleado)), p_fecha, v_monto, 'Pendiente', 'Adelanto desde formulario CAJA', 'CAJA');
      v_alertas := array_append(v_alertas,
        'Adelanto "' || v_empleado || '" registrado: $' || v_monto::TEXT);
      v_total_otros_gastos := v_total_otros_gastos + v_monto;
    END IF;
  END LOOP;

  -- ========================================
  -- 7. Otros gastos para totales
  -- ========================================
  v_total_otros_gastos := v_total_otros_gastos +
    COALESCE((p_values->>'CARGAS_SOCIALES')::NUMERIC, 0) +
    COALESCE((p_values->>'OTROS')::NUMERIC, 0) +
    COALESCE((p_values->>'REPO_CAJA_CHICA')::NUMERIC, 0) +
    COALESCE((p_values->>'REPO_RENTAS_CHICA')::NUMERIC, 0);

  -- ========================================
  -- 8. Calcular diferencia
  -- ========================================
  v_total := v_total_suman - v_total_restan - v_total_otros_gastos - v_total_gastos_cuentas;
  v_diferencia := p_entregado - v_total;

  -- ========================================
  -- 9. Registrar efectivo entregado
  -- ========================================
  IF p_entregado > 0 THEN
    INSERT INTO movimientos_efectivo (fecha, tipo, concepto, monto, observaciones)
    VALUES (
      p_fecha, 'INGRESO', 'Efectivo CAJA entregado', p_entregado,
      CASE WHEN v_diferencia != 0
        THEN 'Diferencia: ' || CASE WHEN v_diferencia > 0 THEN '+' ELSE '' END || v_diferencia::TEXT
        ELSE NULL
      END
    );
  END IF;

  -- ========================================
  -- Retornar resultado
  -- ========================================
  RETURN jsonb_build_object(
    'message', 'Registro CAJA guardado exitosamente. ' || v_total_movimientos || ' movimientos creados.',
    'data', jsonb_build_object(
      'totalMovimientos', v_total_movimientos,
      'diferencia', v_diferencia,
      'alertas', v_alertas
    )
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error procesando CAJA diario: %', SQLERRM;
END;
$$;
