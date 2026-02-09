-- ============================================================================
-- Migracion: Trigger para sincronizar controles_semanales/quincenales
-- desde movimientos reales (SUM) en vez de acumular incrementalmente.
--
-- Fecha: 2026-02-09
--
-- PROBLEMA: upsert_control_semanal/quincenal acumula montos incrementalmente,
-- lo cual puede quedar desincronizado si se editan/eliminan movimientos o si
-- se ejecutan las funciones multiples veces.
--
-- SOLUCION: Trigger AFTER INSERT/UPDATE/DELETE en movimientos que recalcula
-- el total_recaudado usando SUM(monto) de los movimientos reales.
-- ============================================================================

-- ============================================================================
-- 1. Funcion auxiliar: sincroniza un control para un concepto+fecha dado
-- ============================================================================
CREATE OR REPLACE FUNCTION _sync_control_for_movimiento(
  p_concepto_id BIGINT,
  p_fecha DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_frecuencia TEXT;
  v_total NUMERIC(12,2);
  -- Semanal
  v_week_start DATE;
  v_week_end DATE;
  v_fecha_pago DATE;
  v_existing_id BIGINT;
  -- Quincenal
  v_qinfo RECORD;
BEGIN
  -- Obtener frecuencia del concepto
  SELECT frecuencia_pago INTO v_frecuencia
  FROM conceptos
  WHERE id = p_concepto_id;

  -- Si no tiene frecuencia relevante, no hacer nada
  IF v_frecuencia IS NULL OR v_frecuencia NOT IN ('SEMANAL', 'QUINCENAL') THEN
    RETURN;
  END IF;

  -- ==============================
  -- SEMANAL
  -- ==============================
  IF v_frecuencia = 'SEMANAL' THEN
    v_week_start := get_week_start(p_fecha);
    v_week_end   := get_week_end(p_fecha);
    v_fecha_pago := get_next_monday(p_fecha);

    -- Calcular total REAL desde movimientos
    SELECT COALESCE(SUM(monto), 0) INTO v_total
    FROM movimientos
    WHERE concepto_id = p_concepto_id
      AND fecha >= v_week_start
      AND fecha <= v_week_end;

    -- Buscar control existente
    SELECT id INTO v_existing_id
    FROM controles_semanales
    WHERE concepto_id = p_concepto_id
      AND fecha_inicio = v_week_start
      AND fecha_fin = v_week_end;

    IF v_existing_id IS NOT NULL THEN
      IF v_total > 0 THEN
        UPDATE controles_semanales
        SET total_recaudado = v_total
        WHERE id = v_existing_id;
      ELSE
        -- Total 0 y no pagado -> eliminar control
        DELETE FROM controles_semanales
        WHERE id = v_existing_id AND pagado = false;
      END IF;
    ELSIF v_total > 0 THEN
      -- Crear nuevo control
      INSERT INTO controles_semanales (
        concepto_id, fecha_inicio, fecha_fin,
        total_recaudado, fecha_pago_programada, pagado
      ) VALUES (
        p_concepto_id, v_week_start, v_week_end,
        v_total, v_fecha_pago, false
      );
    END IF;

  -- ==============================
  -- QUINCENAL
  -- ==============================
  ELSIF v_frecuencia = 'QUINCENAL' THEN
    SELECT * INTO v_qinfo FROM get_quincena_info(p_fecha);

    -- Calcular total REAL desde movimientos
    SELECT COALESCE(SUM(monto), 0) INTO v_total
    FROM movimientos
    WHERE concepto_id = p_concepto_id
      AND fecha >= v_qinfo.fecha_inicio
      AND fecha <= v_qinfo.fecha_fin;

    -- Buscar control existente
    SELECT id INTO v_existing_id
    FROM controles_quincenales
    WHERE concepto_id = p_concepto_id
      AND quincena = v_qinfo.quincena
      AND mes = v_qinfo.mes
      AND anio = v_qinfo.anio;

    IF v_existing_id IS NOT NULL THEN
      IF v_total > 0 THEN
        UPDATE controles_quincenales
        SET total_recaudado = v_total
        WHERE id = v_existing_id;
      ELSE
        DELETE FROM controles_quincenales
        WHERE id = v_existing_id AND pagado = false;
      END IF;
    ELSIF v_total > 0 THEN
      INSERT INTO controles_quincenales (
        concepto_id, quincena, mes, anio,
        fecha_inicio, fecha_fin, total_recaudado,
        fecha_pago_programada, pagado
      ) VALUES (
        p_concepto_id, v_qinfo.quincena, v_qinfo.mes, v_qinfo.anio,
        v_qinfo.fecha_inicio, v_qinfo.fecha_fin, v_total,
        v_qinfo.fecha_pago, false
      );
    END IF;
  END IF;
END;
$$;

-- ============================================================================
-- 2. Trigger function en movimientos
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_control_desde_movimientos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM _sync_control_for_movimiento(OLD.concepto_id, OLD.fecha);
    RETURN OLD;

  ELSIF TG_OP = 'INSERT' THEN
    PERFORM _sync_control_for_movimiento(NEW.concepto_id, NEW.fecha);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Siempre recalcular para los valores nuevos
    PERFORM _sync_control_for_movimiento(NEW.concepto_id, NEW.fecha);
    -- Si cambio concepto o fecha, recalcular tambien el periodo anterior
    IF OLD.concepto_id != NEW.concepto_id OR OLD.fecha != NEW.fecha THEN
      PERFORM _sync_control_for_movimiento(OLD.concepto_id, OLD.fecha);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================================
-- 3. Crear trigger en tabla movimientos
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sync_controles ON movimientos;

CREATE TRIGGER trg_sync_controles
  AFTER INSERT OR UPDATE OR DELETE ON movimientos
  FOR EACH ROW
  EXECUTE FUNCTION sync_control_desde_movimientos();

-- ============================================================================
-- 4. Eliminar llamadas a upsert_control_semanal/quincenal de procesar_rentas_diario
--    (el trigger lo hace automaticamente al insertar en movimientos)
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
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago, column_key
    FROM conceptos
    WHERE tipo = 'RENTAS'
  LOOP
    v_key := v_concepto.column_key;

    IF v_key IS NOT NULL THEN
      v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);

      IF v_monto > 0 THEN
        -- Insertar movimiento (el trigger trg_sync_controles
        -- se encarga de actualizar controles_semanales/quincenales)
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

        -- POSNET mensual (control aparte, no afectado por este trigger)
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
-- 5. Eliminar llamadas a upsert_control_semanal de procesar_caja_diario
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
  -- ========================================
  FOR v_concepto IN
    SELECT id, nombre, frecuencia_pago, column_key
    FROM conceptos
    WHERE tipo = 'CAJA'
  LOOP
    v_key := v_concepto.column_key;

    IF v_key IS NOT NULL THEN
      v_monto := COALESCE((p_values->>v_key)::NUMERIC, 0);

      IF v_monto > 0 THEN
        -- Insertar movimiento (el trigger trg_sync_controles
        -- se encarga de actualizar controles_semanales/quincenales)
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

        -- POSNET CAJA mensual (control aparte, no afectado por este trigger)
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

-- ============================================================================
-- 6. RECALCULACION INICIAL: Corregir todos los controles existentes
--    usando SUM(monto) real desde la tabla movimientos
-- ============================================================================

-- 6a. Recalcular controles semanales existentes
UPDATE controles_semanales cs
SET total_recaudado = sub.total_real
FROM (
  SELECT
    cs2.id,
    COALESCE(SUM(m.monto), 0) AS total_real
  FROM controles_semanales cs2
  LEFT JOIN movimientos m
    ON m.concepto_id = cs2.concepto_id
    AND m.fecha >= cs2.fecha_inicio
    AND m.fecha <= cs2.fecha_fin
  GROUP BY cs2.id
) sub
WHERE cs.id = sub.id;

-- 6b. Recalcular controles quincenales existentes
UPDATE controles_quincenales cq
SET total_recaudado = sub.total_real
FROM (
  SELECT
    cq2.id,
    COALESCE(SUM(m.monto), 0) AS total_real
  FROM controles_quincenales cq2
  LEFT JOIN movimientos m
    ON m.concepto_id = cq2.concepto_id
    AND m.fecha >= cq2.fecha_inicio
    AND m.fecha <= cq2.fecha_fin
  GROUP BY cq2.id
) sub
WHERE cq.id = sub.id;

-- 6c. Eliminar controles con total 0 que no estan pagados (basura)
DELETE FROM controles_semanales
WHERE total_recaudado = 0 AND pagado = false;

DELETE FROM controles_quincenales
WHERE total_recaudado = 0 AND pagado = false;

-- 6d. Insertar controles faltantes (movimientos existen pero no hay control)
-- Semanales
INSERT INTO controles_semanales (
  concepto_id, fecha_inicio, fecha_fin,
  total_recaudado, fecha_pago_programada, pagado
)
SELECT
  m.concepto_id,
  get_week_start(m.fecha),
  get_week_end(m.fecha),
  SUM(m.monto),
  get_next_monday(m.fecha),
  false
FROM movimientos m
JOIN conceptos c ON c.id = m.concepto_id AND c.frecuencia_pago = 'SEMANAL'
WHERE NOT EXISTS (
  SELECT 1 FROM controles_semanales cs
  WHERE cs.concepto_id = m.concepto_id
    AND cs.fecha_inicio = get_week_start(m.fecha)
    AND cs.fecha_fin = get_week_end(m.fecha)
)
GROUP BY m.concepto_id, get_week_start(m.fecha), get_week_end(m.fecha), get_next_monday(m.fecha);

-- Quincenales
INSERT INTO controles_quincenales (
  concepto_id, quincena, mes, anio,
  fecha_inicio, fecha_fin, total_recaudado,
  fecha_pago_programada, pagado
)
SELECT
  m.concepto_id,
  qi.quincena,
  qi.mes,
  qi.anio,
  qi.fecha_inicio,
  qi.fecha_fin,
  SUM(m.monto),
  qi.fecha_pago,
  false
FROM movimientos m
JOIN conceptos c ON c.id = m.concepto_id AND c.frecuencia_pago = 'QUINCENAL'
CROSS JOIN LATERAL get_quincena_info(m.fecha) qi
WHERE NOT EXISTS (
  SELECT 1 FROM controles_quincenales cq
  WHERE cq.concepto_id = m.concepto_id
    AND cq.quincena = qi.quincena
    AND cq.mes = qi.mes
    AND cq.anio = qi.anio
)
GROUP BY m.concepto_id, qi.quincena, qi.mes, qi.anio, qi.fecha_inicio, qi.fecha_fin, qi.fecha_pago;
