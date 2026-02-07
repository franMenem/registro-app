-- =====================================================
-- FIX: Actualizar control_posnet_diario desde formularios
-- =====================================================
-- PROBLEMA: procesar_rentas_diario() y procesar_caja_diario()
-- actualizaban control_posnet (mensual) pero NUNCA tocaban
-- control_posnet_diario (diario). Los campos monto_rentas,
-- monto_caja y total_posnet siempre quedaban en 0.
--
-- SOLUCIÓN: Crear upsert_control_posnet_diario() y llamarla
-- desde ambas funciones de procesamiento.
-- =====================================================

-- 1. Nueva función: upsert para control_posnet_diario
CREATE OR REPLACE FUNCTION upsert_control_posnet_diario(
  p_fecha DATE,
  p_monto NUMERIC(12,2),
  p_tipo TEXT  -- 'RENTAS' o 'CAJA'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO control_posnet_diario (fecha, monto_rentas, monto_caja, total_posnet, diferencia)
  VALUES (
    p_fecha,
    CASE WHEN p_tipo = 'RENTAS' THEN p_monto ELSE 0 END,
    CASE WHEN p_tipo = 'CAJA' THEN p_monto ELSE 0 END,
    p_monto,
    -(p_monto)  -- diferencia = ingresado_banco(0) - total_posnet
  )
  ON CONFLICT (fecha) DO UPDATE SET
    monto_rentas = CASE
      WHEN p_tipo = 'RENTAS' THEN control_posnet_diario.monto_rentas + p_monto
      ELSE control_posnet_diario.monto_rentas
    END,
    monto_caja = CASE
      WHEN p_tipo = 'CAJA' THEN control_posnet_diario.monto_caja + p_monto
      ELSE control_posnet_diario.monto_caja
    END,
    total_posnet = CASE
      WHEN p_tipo = 'RENTAS' THEN control_posnet_diario.monto_rentas + p_monto + control_posnet_diario.monto_caja
      ELSE control_posnet_diario.monto_rentas + control_posnet_diario.monto_caja + p_monto
    END,
    diferencia = control_posnet_diario.monto_ingresado_banco - CASE
      WHEN p_tipo = 'RENTAS' THEN control_posnet_diario.monto_rentas + p_monto + control_posnet_diario.monto_caja
      ELSE control_posnet_diario.monto_rentas + control_posnet_diario.monto_caja + p_monto
    END,
    updated_at = now();
END;
$$;

-- 2. Actualizar procesar_rentas_diario: agregar llamada a upsert_control_posnet_diario
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
  v_total_suman NUMERIC(12,2) := 0;
  v_total_restan NUMERIC(12,2) := 0;
  v_total_gastos NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_diferencia NUMERIC(12,2);

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
  -- 1. Procesar conceptos RENTAS
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago
    FROM conceptos
    WHERE tipo = 'RENTAS'
  LOOP
    v_key := v_concepto_map->>v_concepto.nombre;

    IF v_key IS NOT NULL THEN
      v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);

      IF v_monto > 0 THEN
        INSERT INTO movimientos (fecha, tipo, cuit, concepto_id, monto, observaciones)
        VALUES (p_fecha, 'RENTAS', v_cuit, v_concepto.id, v_monto,
                'Registro diario - ' || v_concepto.nombre);

        v_total_movimientos := v_total_movimientos + 1;

        IF v_concepto.nombre IN ('POSNET') THEN
          v_total_restan := v_total_restan + v_monto;
        ELSIF v_concepto.nombre NOT IN ('ICBC') THEN
          v_total_suman := v_total_suman + v_monto;
        END IF;

        IF v_concepto.frecuencia_pago = 'SEMANAL' THEN
          PERFORM upsert_control_semanal(v_concepto.id, p_fecha, v_monto);
          v_alertas := array_append(v_alertas,
            'Control semanal actualizado para ' || v_concepto.nombre);
        END IF;

        IF v_concepto.frecuencia_pago = 'QUINCENAL' THEN
          PERFORM upsert_control_quincenal(v_concepto.id, p_fecha, v_monto);
          v_alertas := array_append(v_alertas,
            'Control quincenal actualizado para ' || v_concepto.nombre);
        END IF;

        IF v_concepto.nombre = 'POSNET' THEN
          PERFORM upsert_control_posnet(p_fecha, v_monto, 'RENTAS');
          PERFORM upsert_control_posnet_diario(p_fecha, v_monto, 'RENTAS');
          v_alertas := array_append(v_alertas, 'Control POSNET actualizado.');
        END IF;

        IF v_concepto.nombre = 'ICBC' THEN
          PERFORM crear_movimiento_cc('ICBC', p_fecha, 'EGRESO', 'RENTAS', v_monto);
          v_alertas := array_append(v_alertas,
            'Egreso registrado en cuenta "ICBC" por $' || v_monto::TEXT);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 2. Procesar DEPOSITOS (solo para totales)
  v_monto := COALESCE((p_values->>'DEPOSITOS')::NUMERIC, 0);
  IF v_monto > 0 THEN
    v_total_restan := v_total_restan + v_monto;
    v_alertas := array_append(v_alertas,
      'DEPOSITOS: $' || v_monto::TEXT || ' (restado del total)');
  END IF;

  -- 3. Procesar gastos a cuentas corrientes
  FOR v_cuenta_nombre, v_cuenta_key IN
    SELECT key, value FROM jsonb_each_text(v_cuenta_map)
  LOOP
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

  -- 4. Calcular diferencia
  v_total := v_total_suman - v_total_restan - v_total_gastos;
  v_diferencia := p_entregado - v_total;

  -- 5. Registrar efectivo entregado
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

-- 3. Actualizar procesar_caja_diario: agregar llamada a upsert_control_posnet_diario
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

  v_total_suman NUMERIC(12,2) := 0;
  v_total_restan NUMERIC(12,2) := 0;
  v_total_otros_gastos NUMERIC(12,2) := 0;
  v_total_gastos_cuentas NUMERIC(12,2) := 0;
  v_total_depositos NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_diferencia NUMERIC(12,2);

  v_concepto_map JSONB := '{
    "Arancel": "ARANCEL",
    "SUAT - Sellado": "SUAT_SELLADO",
    "SUCERP - Sellado": "SUCERP_SELLADO",
    "Consultas CAJA": "CONSULTAS",
    "Formularios": "FORMULARIOS",
    "POSNET CAJA": "POSNET"
  }'::JSONB;

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
  -- 1. Procesar conceptos CAJA
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

        IF v_concepto.nombre = 'POSNET CAJA' THEN
          v_total_restan := v_total_restan + v_monto;
        ELSE
          v_total_suman := v_total_suman + v_monto;
        END IF;

        IF v_concepto.frecuencia_pago = 'SEMANAL' THEN
          PERFORM upsert_control_semanal(v_concepto.id, p_fecha, v_monto);
          v_alertas := array_append(v_alertas,
            'Control semanal actualizado para ' || v_concepto.nombre);
        END IF;

        IF v_concepto.nombre = 'POSNET CAJA' THEN
          PERFORM upsert_control_posnet(p_fecha, v_monto, 'CAJA');
          PERFORM upsert_control_posnet_diario(p_fecha, v_monto, 'CAJA');
          v_alertas := array_append(v_alertas, 'Control POSNET actualizado.');
        END IF;

        IF v_concepto.nombre = 'Formularios' THEN
          PERFORM crear_movimiento_cc('Gastos Formularios', p_fecha, 'EGRESO', 'CAJA', v_monto);
          v_alertas := array_append(v_alertas,
            'Egreso registrado en cuenta "Gastos Formularios" por $' || v_monto::TEXT);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- 2. VEP y ePagos
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

  -- 3. Depósitos (12 posibles)
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

  -- 4. Gastos a cuentas corrientes
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

  -- 5. Gastos registrales (LIBRERIA, AGUA, EDESUR, ACARA)
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

  -- 6. Adelantos empleados (MARIA, TERE, DAMI, MUMI)
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

  -- 7. Otros gastos para totales
  v_total_otros_gastos := v_total_otros_gastos +
    COALESCE((p_values->>'CARGAS_SOCIALES')::NUMERIC, 0) +
    COALESCE((p_values->>'OTROS')::NUMERIC, 0) +
    COALESCE((p_values->>'REPO_CAJA_CHICA')::NUMERIC, 0) +
    COALESCE((p_values->>'REPO_RENTAS_CHICA')::NUMERIC, 0);

  -- 8. Calcular diferencia
  v_total := v_total_suman - v_total_restan - v_total_otros_gastos - v_total_gastos_cuentas;
  v_diferencia := p_entregado - v_total;

  -- 9. Registrar efectivo entregado
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

-- 4. Backfill: rellenar control_posnet_diario con datos históricos de movimientos
-- Esto agrega las entradas que faltan desde movimientos existentes
INSERT INTO control_posnet_diario (fecha, monto_rentas, monto_caja, total_posnet, diferencia)
SELECT
  m.fecha,
  COALESCE(SUM(CASE WHEN m.tipo = 'RENTAS' THEN m.monto ELSE 0 END), 0) AS monto_rentas,
  COALESCE(SUM(CASE WHEN m.tipo = 'CAJA' THEN m.monto ELSE 0 END), 0) AS monto_caja,
  COALESCE(SUM(m.monto), 0) AS total_posnet,
  -COALESCE(SUM(m.monto), 0) AS diferencia
FROM movimientos m
JOIN conceptos c ON c.id = m.concepto_id
WHERE c.nombre IN ('POSNET', 'POSNET CAJA')
GROUP BY m.fecha
ON CONFLICT (fecha) DO UPDATE SET
  monto_rentas = EXCLUDED.monto_rentas,
  monto_caja = EXCLUDED.monto_caja,
  total_posnet = EXCLUDED.total_posnet,
  diferencia = control_posnet_diario.monto_ingresado_banco - EXCLUDED.total_posnet,
  updated_at = now();
