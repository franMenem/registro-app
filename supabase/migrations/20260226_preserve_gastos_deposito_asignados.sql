-- ============================================================================
-- MIGRATION: Preservar gastos_deposito asignados en procesar_*_diario
-- Fecha: 2026-02-26
--
-- PROBLEMA: El DELETE en gastos_deposito borraba TODOS los gastos de esa fecha
-- (incluyendo los que ya tenían deposito_id asignado), y luego los re-insertaba
-- sin deposito_id, perdiendo el link y sin restaurar el saldo del depósito.
--
-- SOLUCION:
--   1. DELETE solo borra gastos SIN deposito_id (AND deposito_id IS NULL)
--   2. En el loop de depósitos:
--      - Si existe gasto asignado para ese numero_deposito → preservar, usar su monto
--      - Si no existe → insertar nuevo sin asignar
--
-- CAMBIOS MINIMOS: solo DECLARE + DELETE + loop depósitos.
-- El resto de la función queda idéntico.
-- ============================================================================

-- ============================================================================
-- PARTE 1: procesar_caja_diario
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

  -- Para idempotencia: POSNET viejo
  v_old_posnet NUMERIC(12,2);

  -- Para preservar gastos_deposito asignados
  v_gasto_monto NUMERIC(12,2);

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
  -- 0. CLEANUP para idempotencia (re-submissions seguras)
  -- ========================================

  -- 0a. Leer POSNET viejo ANTES de borrar movimientos (para restar del acumulado mensual)
  v_old_posnet := COALESCE(
    (SELECT SUM(m.monto) FROM movimientos m
     JOIN conceptos c ON c.id = m.concepto_id
     WHERE m.fecha = p_fecha AND m.tipo = 'CAJA' AND c.column_key = 'POSNET_CAJA'),
    0
  );

  -- 0b. Restar POSNET viejo del control mensual
  IF v_old_posnet > 0 THEN
    UPDATE control_posnet
    SET total_caja = GREATEST(total_caja - v_old_posnet, 0),
        total_general = GREATEST(total_general - v_old_posnet, 0)
    WHERE mes = EXTRACT(MONTH FROM p_fecha)::INT
    AND anio = EXTRACT(YEAR FROM p_fecha)::INT;
  END IF;

  -- 0c. Borrar datos previos para esta fecha
  DELETE FROM movimientos WHERE fecha = p_fecha AND tipo = 'CAJA';
  DELETE FROM movimientos_cc WHERE fecha = p_fecha AND concepto = 'CAJA';
  DELETE FROM control_veps WHERE fecha = p_fecha AND observaciones = 'Registro diario CAJA';
  DELETE FROM control_epagos WHERE fecha = p_fecha AND observaciones = 'Registro diario CAJA';
  DELETE FROM gastos_registrales WHERE fecha = p_fecha AND origen = 'CAJA';
  DELETE FROM gastos_personales WHERE fecha = p_fecha AND observaciones = 'Registro diario CAJA';
  DELETE FROM adelantos_empleados WHERE fecha_adelanto = p_fecha AND origen = 'CAJA';
  DELETE FROM movimientos_efectivo WHERE fecha = p_fecha AND concepto = 'Efectivo CAJA entregado';
  -- Solo borrar gastos NO asignados (preservar los que tienen deposito_id)
  DELETE FROM gastos_deposito WHERE fecha = p_fecha AND tipo = 'CAJA' AND deposito_id IS NULL;

  -- ========================================
  -- 1. Procesar conceptos CAJA (dinamico con column_key)
  --    El trigger trg_sync_controles se encarga de
  --    actualizar controles_semanales/quincenales
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago, column_key
    FROM conceptos
    WHERE tipo = 'CAJA'
    ORDER BY sort_order, id
  LOOP
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

        -- POSNET CAJA mensual (control aparte)
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
  -- 2. VEP y ePagos (items estaticos, no conceptos)
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
  -- 3. Depositos (12 posibles) + INSERT en gastos_deposito
  --    Si ya existe un gasto asignado para ese numero_deposito, preservarlo.
  -- ========================================
  FOR v_i IN 1..12 LOOP
    v_monto := COALESCE((p_values->>('DEPOSITO_' || v_i))::NUMERIC, 0);
    IF v_monto > 0 THEN
      -- Buscar si ya existe un gasto asignado (con deposito_id) para este slot
      SELECT monto INTO v_gasto_monto
      FROM gastos_deposito
      WHERE fecha = p_fecha AND tipo = 'CAJA' AND numero_deposito = v_i AND deposito_id IS NOT NULL
      LIMIT 1;

      IF v_gasto_monto IS NOT NULL THEN
        -- Gasto ya asignado: preservar, sumar su monto real al total
        v_total_depositos := v_total_depositos + v_gasto_monto;
      ELSE
        -- Sin asignación previa: insertar nuevo gasto sin asignar
        INSERT INTO gastos_deposito (fecha, tipo, numero_deposito, monto)
        VALUES (p_fecha, 'CAJA', v_i, v_monto);
        v_total_depositos := v_total_depositos + v_monto;
      END IF;

      v_gasto_monto := NULL;
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
  -- 5. Gastos registrales (lista COMPLETA)
  -- ========================================
  FOREACH v_key IN ARRAY ARRAY[
    'LIBRERIA', 'AGUA', 'EDESUR', 'ACARA',
    'CARGAS_SOCIALES', 'OTROS', 'SUPERMERCADO', 'SEC', 'OSECAC',
    'MARIA', 'REPO_CAJA_CHICA', 'REPO_RENTAS_CHICA'
  ] LOOP
    v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);
    IF v_monto > 0 THEN
      INSERT INTO gastos_registrales (fecha, concepto, monto, observaciones, origen)
      VALUES (p_fecha, INITCAP(REPLACE(LOWER(v_key), '_', ' ')), v_monto, 'Registro diario CAJA', 'CAJA');
      v_alertas := array_append(v_alertas,
        'Gasto registral "' || v_key || '" registrado: $' || v_monto::TEXT);
      v_total_otros_gastos := v_total_otros_gastos + v_monto;
    END IF;
  END LOOP;

  -- ========================================
  -- 6. TERE -> gastos_personales (NO adelantos)
  -- ========================================
  v_monto := COALESCE((p_values->>'TERE')::NUMERIC, 0);
  IF v_monto > 0 THEN
    INSERT INTO gastos_personales (fecha, concepto, monto, observaciones, estado)
    VALUES (p_fecha, 'Tere', v_monto, 'Registro diario CAJA', 'Pagado');
    v_alertas := array_append(v_alertas,
      'Gasto personal "TERE" registrado: $' || v_monto::TEXT);
    v_total_otros_gastos := v_total_otros_gastos + v_monto;
  END IF;

  -- ========================================
  -- 7. Adelantos empleados (SOLO DAMI, MUMI)
  -- ========================================
  FOREACH v_empleado IN ARRAY ARRAY['DAMI', 'MUMI'] LOOP
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
  -- 10. Recalcular saldos CC (corrige después del DELETE+INSERT de movimientos_cc)
  -- ========================================
  PERFORM recalcular_todos_los_saldos();

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

-- ============================================================================
-- PARTE 2: procesar_rentas_diario
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
  v_i INT;

  -- Totales para calculo de diferencia
  v_total_suman NUMERIC(12,2) := 0;
  v_total_restan NUMERIC(12,2) := 0;
  v_total_gastos NUMERIC(12,2) := 0;
  v_total_depositos NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_diferencia NUMERIC(12,2);

  -- Para idempotencia: POSNET viejo
  v_old_posnet NUMERIC(12,2);

  -- Para preservar gastos_deposito asignados
  v_gasto_monto NUMERIC(12,2);

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
  -- 0. CLEANUP para idempotencia (re-submissions seguras)
  -- ========================================

  -- 0a. Leer POSNET RENTAS viejo ANTES de borrar
  v_old_posnet := COALESCE(
    (SELECT SUM(m.monto) FROM movimientos m
     JOIN conceptos c ON c.id = m.concepto_id
     WHERE m.fecha = p_fecha AND m.tipo = 'RENTAS' AND c.column_key = 'POSNET'),
    0
  );

  -- 0b. Restar POSNET viejo del control mensual
  IF v_old_posnet > 0 THEN
    UPDATE control_posnet
    SET total_rentas = GREATEST(total_rentas - v_old_posnet, 0),
        total_general = GREATEST(total_general - v_old_posnet, 0)
    WHERE mes = EXTRACT(MONTH FROM p_fecha)::INT
    AND anio = EXTRACT(YEAR FROM p_fecha)::INT;
  END IF;

  -- 0c. Borrar datos previos para esta fecha
  DELETE FROM movimientos WHERE fecha = p_fecha AND tipo = 'RENTAS';
  DELETE FROM movimientos_cc WHERE fecha = p_fecha AND concepto = 'RENTAS';
  DELETE FROM movimientos_efectivo WHERE fecha = p_fecha AND concepto = 'Efectivo RENTAS entregado';
  -- Solo borrar gastos NO asignados (preservar los que tienen deposito_id)
  DELETE FROM gastos_deposito WHERE fecha = p_fecha AND tipo = 'RENTAS' AND deposito_id IS NULL;

  -- ========================================
  -- 1. Procesar conceptos RENTAS (dinamico con column_key)
  --    El trigger trg_sync_controles se encarga de
  --    actualizar controles_semanales/quincenales
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago, column_key
    FROM conceptos
    WHERE tipo = 'RENTAS'
    ORDER BY sort_order, id
  LOOP
    v_key := v_concepto.column_key;

    IF v_key IS NOT NULL THEN
      v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);

      IF v_monto > 0 THEN
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

        -- POSNET mensual (control aparte)
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
  -- 2. Procesar DEPOSITOS (loop 1..12) + INSERT en gastos_deposito
  --    Si ya existe un gasto asignado para ese numero_deposito, preservarlo.
  -- ========================================
  FOR v_i IN 1..12 LOOP
    v_monto := COALESCE((p_values->>('DEPOSITO_' || v_i))::NUMERIC, 0);
    IF v_monto > 0 THEN
      -- Buscar si ya existe un gasto asignado (con deposito_id) para este slot
      SELECT monto INTO v_gasto_monto
      FROM gastos_deposito
      WHERE fecha = p_fecha AND tipo = 'RENTAS' AND numero_deposito = v_i AND deposito_id IS NOT NULL
      LIMIT 1;

      IF v_gasto_monto IS NOT NULL THEN
        -- Gasto ya asignado: preservar, sumar su monto real al total
        v_total_depositos := v_total_depositos + v_gasto_monto;
      ELSE
        -- Sin asignación previa: insertar nuevo gasto sin asignar
        INSERT INTO gastos_deposito (fecha, tipo, numero_deposito, monto)
        VALUES (p_fecha, 'RENTAS', v_i, v_monto);
        v_total_depositos := v_total_depositos + v_monto;
      END IF;

      v_gasto_monto := NULL;
    END IF;
  END LOOP;

  IF v_total_depositos > 0 THEN
    v_total_restan := v_total_restan + v_total_depositos;
    v_alertas := array_append(v_alertas,
      'Total depositos: $' || v_total_depositos::TEXT || ' (restados del total)');
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
  -- 6. Recalcular saldos CC (corrige después del DELETE+INSERT de movimientos_cc)
  -- ========================================
  PERFORM recalcular_todos_los_saldos();

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
