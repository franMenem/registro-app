-- ============================================================================
-- Postgres Functions para operaciones batch transaccionales
-- Migración: 20260203_postgres_functions_batch.sql
--
-- Estas funciones reemplazan las operaciones client-side en movimientos.ts
-- para garantizar integridad transaccional (todo o nada).
-- ============================================================================

-- ============================================================================
-- Helper: Calcular próximo lunes para controles semanales
-- ============================================================================
CREATE OR REPLACE FUNCTION get_next_monday(p_date DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_day INT;
  v_diff INT;
BEGIN
  v_day := EXTRACT(DOW FROM p_date)::INT;
  v_diff := CASE WHEN v_day = 0 THEN 1 ELSE 8 - v_day END;
  RETURN p_date + v_diff;
END;
$$;

-- ============================================================================
-- Helper: Calcular inicio de semana (lunes)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_week_start(p_date DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_day INT;
  v_diff INT;
BEGIN
  v_day := EXTRACT(DOW FROM p_date)::INT;
  v_diff := CASE WHEN v_day = 0 THEN -6 ELSE 1 - v_day END;
  RETURN p_date + v_diff;
END;
$$;

-- ============================================================================
-- Helper: Calcular fin de semana (domingo)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_week_end(p_date DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN get_week_start(p_date) + 6;
END;
$$;

-- ============================================================================
-- Helper: Información de quincena
-- ============================================================================
CREATE OR REPLACE FUNCTION get_quincena_info(p_date DATE)
RETURNS TABLE(
  quincena TEXT,
  mes INT,
  anio INT,
  fecha_inicio DATE,
  fecha_fin DATE,
  fecha_pago DATE
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_day INT;
  v_month INT;
  v_year INT;
BEGIN
  v_day := EXTRACT(DAY FROM p_date)::INT;
  v_month := EXTRACT(MONTH FROM p_date)::INT;
  v_year := EXTRACT(YEAR FROM p_date)::INT;

  IF v_day <= 15 THEN
    quincena := 'PRIMERA';
    fecha_inicio := DATE_TRUNC('month', p_date)::DATE;
    fecha_fin := DATE_TRUNC('month', p_date)::DATE + 14;
  ELSE
    quincena := 'SEGUNDA';
    fecha_inicio := DATE_TRUNC('month', p_date)::DATE + 15;
    fecha_fin := (DATE_TRUNC('month', p_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  END IF;

  mes := v_month;
  anio := v_year;
  fecha_pago := fecha_fin + 5; -- 5 días corridos después del fin

  RETURN NEXT;
END;
$$;

-- ============================================================================
-- Helper: Actualizar o crear control semanal
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_control_semanal(
  p_concepto_id BIGINT,
  p_fecha DATE,
  p_monto NUMERIC(12,2)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_inicio DATE;
  v_fin DATE;
  v_fecha_pago DATE;
  v_existing_id BIGINT;
  v_existing_total NUMERIC(12,2);
BEGIN
  v_inicio := get_week_start(p_fecha);
  v_fin := get_week_end(p_fecha);
  v_fecha_pago := get_next_monday(p_fecha);

  -- Buscar control existente
  SELECT id, total_recaudado INTO v_existing_id, v_existing_total
  FROM controles_semanales
  WHERE concepto_id = p_concepto_id
    AND fecha_inicio = v_inicio
    AND fecha_fin = v_fin;

  IF v_existing_id IS NOT NULL THEN
    -- Actualizar existente
    UPDATE controles_semanales
    SET total_recaudado = v_existing_total + p_monto
    WHERE id = v_existing_id;
  ELSE
    -- Crear nuevo
    INSERT INTO controles_semanales (
      concepto_id, fecha_inicio, fecha_fin,
      total_recaudado, fecha_pago_programada, pagado
    ) VALUES (
      p_concepto_id, v_inicio, v_fin,
      p_monto, v_fecha_pago, false
    );
  END IF;
END;
$$;

-- ============================================================================
-- Helper: Actualizar o crear control quincenal
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_control_quincenal(
  p_concepto_id BIGINT,
  p_fecha DATE,
  p_monto NUMERIC(12,2)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_info RECORD;
  v_existing_id BIGINT;
  v_existing_total NUMERIC(12,2);
BEGIN
  SELECT * INTO v_info FROM get_quincena_info(p_fecha);

  -- Buscar control existente
  SELECT id, total_recaudado INTO v_existing_id, v_existing_total
  FROM controles_quincenales
  WHERE concepto_id = p_concepto_id
    AND quincena = v_info.quincena
    AND mes = v_info.mes
    AND anio = v_info.anio;

  IF v_existing_id IS NOT NULL THEN
    -- Actualizar existente
    UPDATE controles_quincenales
    SET total_recaudado = v_existing_total + p_monto
    WHERE id = v_existing_id;
  ELSE
    -- Crear nuevo
    INSERT INTO controles_quincenales (
      concepto_id, quincena, mes, anio,
      fecha_inicio, fecha_fin, total_recaudado,
      fecha_pago_programada, pagado
    ) VALUES (
      p_concepto_id, v_info.quincena, v_info.mes, v_info.anio,
      v_info.fecha_inicio, v_info.fecha_fin, p_monto,
      v_info.fecha_pago, false
    );
  END IF;
END;
$$;

-- ============================================================================
-- Helper: Actualizar control POSNET mensual
-- Usa INSERT ... ON CONFLICT para upsert atómico
-- ============================================================================
CREATE OR REPLACE FUNCTION upsert_control_posnet(
  p_fecha DATE,
  p_monto NUMERIC(12,2),
  p_tipo TEXT  -- 'RENTAS' o 'CAJA'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_mes INT;
  v_anio INT;
BEGIN
  v_mes := EXTRACT(MONTH FROM p_fecha)::INT;
  v_anio := EXTRACT(YEAR FROM p_fecha)::INT;

  -- Upsert atómico usando ON CONFLICT
  INSERT INTO control_posnet (mes, anio, total_rentas, total_caja, total_general)
  VALUES (
    v_mes, v_anio,
    CASE WHEN p_tipo = 'RENTAS' THEN p_monto ELSE 0 END,
    CASE WHEN p_tipo = 'CAJA' THEN p_monto ELSE 0 END,
    p_monto
  )
  ON CONFLICT (mes, anio) DO UPDATE SET
    total_rentas = CASE
      WHEN p_tipo = 'RENTAS' THEN control_posnet.total_rentas + p_monto
      ELSE control_posnet.total_rentas
    END,
    total_caja = CASE
      WHEN p_tipo = 'CAJA' THEN control_posnet.total_caja + p_monto
      ELSE control_posnet.total_caja
    END,
    total_general = CASE
      WHEN p_tipo = 'RENTAS' THEN control_posnet.total_rentas + p_monto + control_posnet.total_caja
      ELSE control_posnet.total_rentas + control_posnet.total_caja + p_monto
    END;
END;
$$;

-- ============================================================================
-- Helper: Crear movimiento en cuenta corriente
-- ============================================================================
CREATE OR REPLACE FUNCTION crear_movimiento_cc(
  p_cuenta_nombre TEXT,
  p_fecha DATE,
  p_tipo_movimiento TEXT,
  p_concepto TEXT,
  p_monto NUMERIC(12,2)
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_cuenta_id BIGINT;
  v_saldo_actual NUMERIC(12,2);
  v_nuevo_saldo NUMERIC(12,2);
  v_mov_id BIGINT;
BEGIN
  -- Buscar cuenta por nombre
  SELECT id, saldo_actual INTO v_cuenta_id, v_saldo_actual
  FROM cuentas_corrientes
  WHERE nombre = p_cuenta_nombre;

  IF v_cuenta_id IS NULL THEN
    RETURN NULL; -- Cuenta no encontrada
  END IF;

  -- Calcular nuevo saldo
  IF p_tipo_movimiento = 'INGRESO' THEN
    v_nuevo_saldo := COALESCE(v_saldo_actual, 0) + p_monto;
  ELSE
    v_nuevo_saldo := COALESCE(v_saldo_actual, 0) - p_monto;
  END IF;

  -- Insertar movimiento
  INSERT INTO movimientos_cc (
    cuenta_id, fecha, tipo_movimiento, concepto, monto, saldo_resultante
  ) VALUES (
    v_cuenta_id, p_fecha, p_tipo_movimiento, p_concepto, p_monto, v_nuevo_saldo
  ) RETURNING id INTO v_mov_id;

  -- Actualizar saldo de la cuenta
  UPDATE cuentas_corrientes
  SET saldo_actual = v_nuevo_saldo
  WHERE id = v_cuenta_id;

  RETURN v_mov_id;
END;
$$;

-- ============================================================================
-- FUNCIÓN PRINCIPAL: procesar_rentas_diario
-- Procesa el formulario diario de RENTAS con integridad transaccional
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

  -- Totales para cálculo de diferencia
  v_total_suman NUMERIC(12,2) := 0;
  v_total_restan NUMERIC(12,2) := 0;
  v_total_gastos NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_diferencia NUMERIC(12,2);

  -- Mapeo concepto -> key JSON
  v_concepto_map JSONB := '{
    "GIT": "GIT",
    "SUAT - Alta": "SUAT_ALTA",
    "SUAT - Patentes": "SUAT_PATENTES",
    "SUAT - Infracciones": "SUAT_INFRACCIONES",
    "Consulta": "CONSULTA",
    "SUCERP": "SUCERP",
    "SUGIT": "SUGIT",
    "PROVINCIA (ARBA)": "PROVINCIA",
    "POSNET": "POSNET",
    "ICBC": "ICBC"
  }'::JSONB;

  -- Mapeo cuenta -> key JSON para gastos
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
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago
    FROM conceptos
    WHERE tipo = 'RENTAS'
  LOOP
    -- Obtener key del JSON para este concepto
    v_key := v_concepto_map->>v_concepto.nombre;

    IF v_key IS NOT NULL THEN
      v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);

      IF v_monto > 0 THEN
        -- Insertar movimiento
        INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
        VALUES (p_fecha, 'RENTAS', v_cuit, v_concepto.id, v_monto,
                'Registro diario - ' || v_concepto.nombre);

        v_total_movimientos := v_total_movimientos + 1;

        -- Acumular para totales
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
    -- ICBC ya se procesó arriba
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
  -- Si hay cualquier error, se hace ROLLBACK automático de toda la transacción
  RAISE EXCEPTION 'Error procesando RENTAS diario: %', SQLERRM;
END;
$$;

-- ============================================================================
-- FUNCIÓN PRINCIPAL: procesar_caja_diario
-- Procesa el formulario diario de CAJA con integridad transaccional
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

  -- Totales para cálculo de diferencia
  v_total_suman NUMERIC(12,2) := 0;
  v_total_restan NUMERIC(12,2) := 0;
  v_total_otros_gastos NUMERIC(12,2) := 0;
  v_total_gastos_cuentas NUMERIC(12,2) := 0;
  v_total_depositos NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_diferencia NUMERIC(12,2);

  -- Mapeo concepto -> key JSON
  v_concepto_map JSONB := '{
    "Arancel": "ARANCEL",
    "SUAT - Sellado": "SUAT_SELLADO",
    "SUCERP - Sellado": "SUCERP_SELLADO",
    "Consultas CAJA": "CONSULTAS",
    "Formularios": "FORMULARIOS",
    "POSNET CAJA": "POSNET"
  }'::JSONB;

  -- Mapeo cuenta -> key JSON
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
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago
    FROM conceptos
    WHERE tipo = 'CAJA'
  LOOP
    v_key := v_concepto_map->>v_concepto.nombre;

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
  -- 3. Depósitos (12 posibles)
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
      'Total depósitos: $' || v_total_depositos::TEXT || ' (restados del total)');
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

-- ============================================================================
-- Comentarios y permisos
-- ============================================================================
COMMENT ON FUNCTION procesar_rentas_diario IS
'Procesa el formulario diario de RENTAS con integridad transaccional completa.
Si cualquier operación falla, se revierte todo automáticamente.';

COMMENT ON FUNCTION procesar_caja_diario IS
'Procesa el formulario diario de CAJA con integridad transaccional completa.
Si cualquier operación falla, se revierte todo automáticamente.';

-- Otorgar permisos para que el cliente pueda llamar estas funciones
GRANT EXECUTE ON FUNCTION procesar_rentas_diario TO authenticated;
GRANT EXECUTE ON FUNCTION procesar_caja_diario TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_monday TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_start TO authenticated;
GRANT EXECUTE ON FUNCTION get_week_end TO authenticated;
GRANT EXECUTE ON FUNCTION get_quincena_info TO authenticated;
