import db from '../db/database';

export interface FiltrosReporte {
  fecha_desde?: string;
  fecha_hasta?: string;
  cuenta_id?: number;
  cliente_id?: number;
  estado?: string;
}

// ==================== REPORTES DE DEPÓSITOS ====================

export const getDepositosPorPeriodo = (filtros: FiltrosReporte) => {
  let query = `
    SELECT
      DATE(d.fecha_ingreso) as fecha,
      COUNT(*) as cantidad,
      SUM(d.monto_original) as total_monto
    FROM depositos d
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filtros.fecha_desde) {
    query += ` AND d.fecha_ingreso >= ?`;
    params.push(filtros.fecha_desde);
  }

  if (filtros.fecha_hasta) {
    query += ` AND d.fecha_ingreso <= ?`;
    params.push(filtros.fecha_hasta);
  }

  if (filtros.estado) {
    query += ` AND d.estado = ?`;
    params.push(filtros.estado);
  }

  query += ` GROUP BY DATE(d.fecha_ingreso) ORDER BY fecha DESC`;

  return db.prepare(query).all(...params);
};

export const getDepositosPorEstado = (filtros: FiltrosReporte) => {
  let query = `
    SELECT
      d.estado,
      COUNT(*) as cantidad,
      SUM(d.monto_original) as total_monto,
      SUM(d.saldo_actual) as total_saldo
    FROM depositos d
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filtros.fecha_desde) {
    query += ` AND d.fecha_ingreso >= ?`;
    params.push(filtros.fecha_desde);
  }

  if (filtros.fecha_hasta) {
    query += ` AND d.fecha_ingreso <= ?`;
    params.push(filtros.fecha_hasta);
  }

  query += ` GROUP BY d.estado ORDER BY cantidad DESC`;

  return db.prepare(query).all(...params);
};

export const getDepositosPorCliente = (filtros: FiltrosReporte) => {
  let query = `
    SELECT
      cl.id,
      cl.razon_social,
      COUNT(d.id) as cantidad_depositos,
      SUM(d.monto_original) as total_depositado,
      SUM(d.saldo_actual) as saldo_actual_total
    FROM depositos d
    INNER JOIN clientes cl ON d.cliente_id = cl.id
    WHERE d.cliente_id IS NOT NULL
  `;

  const params: any[] = [];

  if (filtros.fecha_desde) {
    query += ` AND d.fecha_ingreso >= ?`;
    params.push(filtros.fecha_desde);
  }

  if (filtros.fecha_hasta) {
    query += ` AND d.fecha_ingreso <= ?`;
    params.push(filtros.fecha_hasta);
  }

  if (filtros.cliente_id) {
    query += ` AND cl.id = ?`;
    params.push(filtros.cliente_id);
  }

  query += ` GROUP BY cl.id, cl.razon_social ORDER BY total_depositado DESC`;

  return db.prepare(query).all(...params);
};

export const getTopDepositos = (limit: number = 10) => {
  const query = `
    SELECT
      d.id,
      d.titular,
      d.monto_original,
      d.saldo_actual,
      d.fecha_ingreso,
      d.estado,
      cl.razon_social as cliente_nombre
    FROM depositos d
    LEFT JOIN clientes cl ON d.cliente_id = cl.id
    ORDER BY d.monto_original DESC
    LIMIT ?
  `;

  return db.prepare(query).all(limit);
};

// ==================== REPORTES DE CUENTAS CORRIENTES ====================

export const getBalanceCuentas = () => {
  const query = `
    SELECT
      cc.id,
      cc.nombre,
      cc.tipo,
      cc.saldo_actual,
      (SELECT COUNT(*) FROM movimientos_cuenta WHERE cuenta_id = cc.id) as total_movimientos,
      (SELECT SUM(monto) FROM movimientos_cuenta WHERE cuenta_id = cc.id AND tipo_movimiento = 'INGRESO') as total_ingresos,
      (SELECT SUM(monto) FROM movimientos_cuenta WHERE cuenta_id = cc.id AND tipo_movimiento = 'EGRESO') as total_egresos
    FROM cuentas_corrientes cc
    WHERE cc.nombre = UPPER(cc.nombre)
    ORDER BY cc.saldo_actual DESC
  `;

  return db.prepare(query).all();
};

export const getMovimientosCuentaPorPeriodo = (filtros: FiltrosReporte) => {
  let query = `
    SELECT
      DATE(mc.fecha) as fecha,
      mc.tipo_movimiento,
      COUNT(*) as cantidad,
      SUM(mc.monto) as total_monto
    FROM movimientos_cuenta mc
    WHERE 1=1
  `;

  const params: any[] = [];

  if (filtros.fecha_desde) {
    query += ` AND mc.fecha >= ?`;
    params.push(filtros.fecha_desde);
  }

  if (filtros.fecha_hasta) {
    query += ` AND mc.fecha <= ?`;
    params.push(filtros.fecha_hasta);
  }

  if (filtros.cuenta_id) {
    query += ` AND mc.cuenta_id = ?`;
    params.push(filtros.cuenta_id);
  }

  query += ` GROUP BY DATE(mc.fecha), mc.tipo_movimiento ORDER BY fecha DESC`;

  return db.prepare(query).all(...params);
};

export const getEvolucionSaldos = (cuenta_id: number, fecha_desde?: string, fecha_hasta?: string) => {
  let query = `
    SELECT
      DATE(mc.fecha) as fecha,
      mc.saldo_resultante
    FROM movimientos_cuenta mc
    WHERE mc.cuenta_id = ?
  `;

  const params: any[] = [cuenta_id];

  if (fecha_desde) {
    query += ` AND mc.fecha >= ?`;
    params.push(fecha_desde);
  }

  if (fecha_hasta) {
    query += ` AND mc.fecha <= ?`;
    params.push(fecha_hasta);
  }

  query += ` ORDER BY mc.fecha ASC, mc.id ASC`;

  return db.prepare(query).all(...params);
};

export const getCuentasConSaldoNegativo = () => {
  const query = `
    SELECT
      cc.id,
      cc.nombre,
      cc.tipo,
      cc.saldo_actual
    FROM cuentas_corrientes cc
    WHERE cc.saldo_actual < 0
    AND cc.nombre = UPPER(cc.nombre)
    ORDER BY cc.saldo_actual ASC
  `;

  return db.prepare(query).all();
};

// ==================== REPORTES DE CLIENTES ====================

export const getClientesConMasDepositos = (limit: number = 10) => {
  const query = `
    SELECT
      cl.id,
      cl.razon_social,
      cl.cuit,
      COUNT(d.id) as cantidad_depositos,
      SUM(d.monto_original) as total_depositado,
      SUM(CASE WHEN d.estado IN ('PENDIENTE', 'A_FAVOR', 'A_CUENTA') THEN d.saldo_actual ELSE 0 END) as saldo_activo
    FROM clientes cl
    LEFT JOIN depositos d ON cl.id = d.cliente_id
    GROUP BY cl.id, cl.razon_social, cl.cuit
    HAVING cantidad_depositos > 0
    ORDER BY cantidad_depositos DESC
    LIMIT ?
  `;

  return db.prepare(query).all(limit);
};

export const getClientesConSaldosActivos = () => {
  const query = `
    SELECT
      cl.id,
      cl.razon_social,
      cl.cuit,
      COUNT(d.id) as cantidad_depositos_activos,
      SUM(d.saldo_actual) as saldo_total
    FROM clientes cl
    INNER JOIN depositos d ON cl.id = d.cliente_id
    WHERE d.estado IN ('PENDIENTE', 'A_FAVOR', 'A_CUENTA')
    AND d.saldo_actual > 0
    GROUP BY cl.id, cl.razon_social, cl.cuit
    ORDER BY saldo_total DESC
  `;

  return db.prepare(query).all();
};

// ==================== REPORTES FINANCIEROS GENERALES ====================

export const getResumenMensual = (anio: number, mes: number) => {
  const fecha_desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const fecha_hasta = new Date(anio, mes, 0).toISOString().split('T')[0]; // Último día del mes

  const query = `
    SELECT
      'Depósitos Ingresados' as concepto,
      SUM(d.monto_original) as monto
    FROM depositos d
    WHERE d.fecha_ingreso >= ? AND d.fecha_ingreso <= ?

    UNION ALL

    SELECT
      'Depósitos Liquidados' as concepto,
      SUM(d.monto_original) as monto
    FROM depositos d
    WHERE d.fecha_uso >= ? AND d.fecha_uso <= ?
    AND d.estado = 'LIQUIDADO'

    UNION ALL

    SELECT
      'Egresos Cuentas Corrientes' as concepto,
      SUM(mc.monto) as monto
    FROM movimientos_cuenta mc
    WHERE mc.fecha >= ? AND mc.fecha <= ?
    AND mc.tipo_movimiento = 'EGRESO'

    UNION ALL

    SELECT
      'Ingresos Cuentas Corrientes' as concepto,
      SUM(mc.monto) as monto
    FROM movimientos_cuenta mc
    WHERE mc.fecha >= ? AND mc.fecha <= ?
    AND mc.tipo_movimiento = 'INGRESO'
  `;

  return db.prepare(query).all(
    fecha_desde, fecha_hasta,
    fecha_desde, fecha_hasta,
    fecha_desde, fecha_hasta,
    fecha_desde, fecha_hasta
  );
};

export const getComparativaMensual = (anio: number) => {
  const query = `
    SELECT
      strftime('%m', d.fecha_ingreso) as mes,
      COUNT(*) as cantidad_depositos,
      SUM(d.monto_original) as total_depositado,
      SUM(CASE WHEN d.estado = 'LIQUIDADO' THEN d.monto_original ELSE 0 END) as total_liquidado
    FROM depositos d
    WHERE strftime('%Y', d.fecha_ingreso) = ?
    GROUP BY strftime('%m', d.fecha_ingreso)
    ORDER BY mes ASC
  `;

  return db.prepare(query).all(String(anio));
};

export const getFlujoCajaProyectado = () => {
  const query = `
    SELECT
      'Saldo Disponible en Depósitos' as concepto,
      SUM(d.saldo_actual) as monto
    FROM depositos d
    WHERE d.estado IN ('PENDIENTE', 'A_FAVOR', 'A_CUENTA')

    UNION ALL

    SELECT
      'Saldo Total Cuentas Corrientes' as concepto,
      SUM(cc.saldo_actual) as monto
    FROM cuentas_corrientes cc
    WHERE cc.nombre = UPPER(cc.nombre)
  `;

  return db.prepare(query).all();
};

export const getTopMovimientos = (limit: number = 10) => {
  const query = `
    SELECT
      mc.id,
      mc.fecha,
      mc.concepto,
      mc.tipo_movimiento,
      mc.monto,
      cc.nombre as cuenta_nombre
    FROM movimientos_cuenta mc
    INNER JOIN cuentas_corrientes cc ON mc.cuenta_id = cc.id
    ORDER BY mc.monto DESC
    LIMIT ?
  `;

  return db.prepare(query).all(limit);
};
