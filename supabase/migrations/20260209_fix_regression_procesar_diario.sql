-- ============================================================================
-- FIX: Regresion en procesar_caja_diario y procesar_rentas_diario
-- Fecha: 2026-02-09
--
-- PROBLEMA: La migracion 20260209_trigger_sync_controles.sql sobreescribio
-- ambas funciones perdiendo los siguientes fixes:
--   - 20260206_fix_routing_gastos.sql: routing correcto de gastos
--   - 20260206_gastos_deposito.sql: INSERT en gastos_deposito
--   - 20260206_fix_parentesis.sql: parentesis correctos en depositos
--
-- SOLUCION: Reescribir ambas funciones combinando:
--   - Trigger approach (sin upsert_control_semanal/quincenal manual)
--   - column_key dinamico de conceptos
--   - Routing correcto de gastos registrales/personales/adelantos
--   - INSERT en gastos_deposito con parentesis correctos
--
-- ERRORES CORREGIDOS:
--   1. gastos_registrales: lista expandida (12 items, no 4)
--   2. TERE -> gastos_personales (no adelantos)
--   3. MARIA -> gastos_registrales (no adelantos)
--   4. Adelantos: solo DAMI, MUMI
--   5. gastos_deposito: INSERT individual por deposito
--   6. Parentesis: p_values->>('DEPOSITO_' || v_i)
--   7. Rentas depositos: loop 1..12 (no key unica)
--   8. VEP/EPAGOS: eliminar filas espurias de conceptos
--   9. sort_order: orden correcto en formularios
--  10. Totales: todos los gastos contabilizados
-- ============================================================================

-- ============================================================================
-- PARTE 1: Reescribir procesar_caja_diario
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
  --    NOTA: parentesis correctos en ('DEPOSITO_' || v_i)
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
  -- 5. Gastos registrales (lista COMPLETA)
  --    LIBRERIA, AGUA, EDESUR, ACARA, CARGAS_SOCIALES, OTROS,
  --    SUPERMERCADO, SEC, OSECAC, MARIA, REPO_CAJA_CHICA, REPO_RENTAS_CHICA
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
-- PARTE 2: Reescribir procesar_rentas_diario
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
  --    NOTA: parentesis correctos en ('DEPOSITO_' || v_i)
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
  RAISE EXCEPTION 'Error procesando RENTAS diario: %', SQLERRM;
END;
$$;

-- ============================================================================
-- PARTE 3: Ocultar conceptos espurios (VEP, EPAGOS y variantes)
-- Estos son items estaticos en el UI, NO conceptos de la tabla.
-- Si existen en la tabla con tipo CAJA/RENTAS, aparecen como inputs extra.
-- No se pueden borrar porque tienen movimientos asociados (FK constraint).
-- Solucion: ampliar CHECK constraint para permitir 'INACTIVO', luego cambiar tipo.
-- ============================================================================
ALTER TABLE conceptos DROP CONSTRAINT IF EXISTS conceptos_tipo_check;
ALTER TABLE conceptos ADD CONSTRAINT conceptos_tipo_check
  CHECK (tipo IN ('RENTAS', 'CAJA', 'INACTIVO'));

-- Desactivar trigger cascada para que no propague 'INACTIVO' a movimientos
ALTER TABLE conceptos DISABLE TRIGGER tr_concepto_tipo_cascada;

UPDATE conceptos SET tipo = 'INACTIVO'
WHERE UPPER(REPLACE(REPLACE(nombre, ' ', ''), '-', ''))
IN ('VEP', 'EPAGOS', 'VEPCAJA', 'EPAGOSCAJA', 'VEPRENTAS', 'EPAGOSRENTAS');

-- Reactivar trigger
ALTER TABLE conceptos ENABLE TRIGGER tr_concepto_tipo_cascada;

-- ============================================================================
-- PARTE 4: Agregar sort_order a conceptos para mantener orden en formularios
-- ============================================================================
ALTER TABLE conceptos ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- CAJA: Arancel, SUAT-Sellado, SUCERP-Sellado, Consultas CAJA, Formularios, POSNET CAJA
UPDATE conceptos SET sort_order = 1 WHERE column_key = 'ARANCEL';
UPDATE conceptos SET sort_order = 2 WHERE column_key = 'SUAT_SELLADO';
UPDATE conceptos SET sort_order = 3 WHERE column_key = 'SUCERP_SELLADO';
UPDATE conceptos SET sort_order = 4 WHERE column_key = 'CONSULTAS';
UPDATE conceptos SET sort_order = 5 WHERE column_key = 'FORMULARIOS';
UPDATE conceptos SET sort_order = 6 WHERE column_key = 'POSNET_CAJA';

-- RENTAS: GIT, SUAT-Alta, SUAT-Patentes, SUAT-Infracciones, Consulta, SUCERP, SUGIT, PROVINCIA, POSNET, ICBC
UPDATE conceptos SET sort_order = 1 WHERE column_key = 'GIT';
UPDATE conceptos SET sort_order = 2 WHERE column_key = 'SUAT_ALTA';
UPDATE conceptos SET sort_order = 3 WHERE column_key = 'SUAT_PATENTES';
UPDATE conceptos SET sort_order = 4 WHERE column_key = 'SUAT_INFRACCIONES';
UPDATE conceptos SET sort_order = 5 WHERE column_key = 'CONSULTA';
UPDATE conceptos SET sort_order = 6 WHERE column_key = 'SUCERP';
UPDATE conceptos SET sort_order = 7 WHERE column_key = 'SUGIT';
UPDATE conceptos SET sort_order = 8 WHERE column_key = 'PROVINCIA';
UPDATE conceptos SET sort_order = 9 WHERE column_key = 'POSNET';
UPDATE conceptos SET sort_order = 10 WHERE column_key = 'ICBC';
