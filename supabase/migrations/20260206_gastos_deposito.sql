-- ============================================================================
-- MIGRACIÓN: gastos_deposito
-- Fecha: 2026-02-06
-- Descripción:
--   1. Crear tabla gastos_deposito para trackear montos individuales de depósitos
--   2. Actualizar procesar_caja_diario para insertar en gastos_deposito
--   3. Actualizar procesar_rentas_diario para usar DEPOSITO_1..12 e insertar en gastos_deposito
-- ============================================================================

-- ============================================================================
-- 1. CREAR TABLA gastos_deposito
-- ============================================================================

CREATE TABLE IF NOT EXISTS gastos_deposito (
  id BIGSERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('CAJA', 'RENTAS')),
  numero_deposito INT NOT NULL CHECK (numero_deposito BETWEEN 1 AND 12),
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  deposito_id BIGINT REFERENCES depositos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE gastos_deposito ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gastos_deposito_all" ON gastos_deposito FOR ALL USING (true);

-- ============================================================================
-- 2. ACTUALIZAR procesar_caja_diario
--    Cambio: INSERT en gastos_deposito dentro del loop DEPOSITO_1..12
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
  -- 3. Depositos (12 posibles) + INSERT en gastos_deposito
  -- ========================================

  -- Limpiar gastos_deposito previos para esta fecha y tipo (re-submissions)
  DELETE FROM gastos_deposito WHERE fecha = p_fecha AND tipo = 'CAJA';

  FOR v_i IN 1..12 LOOP
    v_monto := COALESCE((p_values->>('DEPOSITO_' || v_i))::NUMERIC, 0);
    IF v_monto > 0 THEN
      v_total_depositos := v_total_depositos + v_monto;

      INSERT INTO gastos_deposito (fecha, tipo, numero_deposito, monto)
      VALUES (p_fecha, 'CAJA', v_i, v_monto);
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

-- ============================================================================
-- 3. ACTUALIZAR procesar_rentas_diario
--    Cambio: Reemplazar DEPOSITOS unico por loop DEPOSITO_1..12 + INSERT en gastos_deposito
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
  -- 2. Procesar DEPOSITOS (loop 1..12) + INSERT en gastos_deposito
  -- ========================================

  -- Limpiar gastos_deposito previos para esta fecha y tipo (re-submissions)
  DELETE FROM gastos_deposito WHERE fecha = p_fecha AND tipo = 'RENTAS';

  FOR v_i IN 1..12 LOOP
    v_monto := COALESCE((p_values->>('DEPOSITO_' || v_i))::NUMERIC, 0);
    IF v_monto > 0 THEN
      v_total_depositos := v_total_depositos + v_monto;

      INSERT INTO gastos_deposito (fecha, tipo, numero_deposito, monto)
      VALUES (p_fecha, 'RENTAS', v_i, v_monto);
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
  -- Si hay cualquier error, se hace ROLLBACK automatico de toda la transaccion
  RAISE EXCEPTION 'Error procesando RENTAS diario: %', SQLERRM;
END;
$$;
