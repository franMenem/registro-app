import db, { transaction } from '../db/database';

interface CuentaCorriente {
  id: number;
  nombre: string;
  tipo: string;
  saldo_actual: number;
}

interface MovimientoCC {
  id: number;
  cuenta_id: number;
  fecha: string;
  tipo_movimiento: 'INGRESO' | 'EGRESO';
  concepto: string;
  monto: number;
  saldo_resultante: number;
  movimiento_origen_id: number | null;
  created_at: string;
}

/**
 * Servicio de Cuentas Corrientes
 */
export class CuentasCorrientesService {
  /**
   * Obtiene todas las cuentas corrientes
   */
  obtenerTodas(): CuentaCorriente[] {
    return db
      .prepare('SELECT * FROM cuentas_corrientes ORDER BY nombre ASC')
      .all() as CuentaCorriente[];
  }

  /**
   * Obtiene una cuenta por ID
   */
  obtenerPorId(id: number): CuentaCorriente | null {
    const cuenta = db
      .prepare('SELECT * FROM cuentas_corrientes WHERE id = ?')
      .get(id) as CuentaCorriente | undefined;

    return cuenta || null;
  }

  /**
   * Obtiene una cuenta por nombre
   */
  obtenerPorNombre(nombre: string): CuentaCorriente | null {
    const cuenta = db
      .prepare('SELECT * FROM cuentas_corrientes WHERE nombre = ?')
      .get(nombre) as CuentaCorriente | undefined;

    return cuenta || null;
  }

  /**
   * Obtiene los movimientos de una cuenta
   */
  obtenerMovimientos(cuentaId: number, filtros?: {
    desde?: string;
    hasta?: string;
    tipo?: 'INGRESO' | 'EGRESO';
  }): MovimientoCC[] {
    let query = 'SELECT * FROM movimientos_cc WHERE cuenta_id = ?';
    const params: any[] = [cuentaId];

    if (filtros?.desde) {
      query += ' AND fecha >= ?';
      params.push(filtros.desde);
    }

    if (filtros?.hasta) {
      query += ' AND fecha <= ?';
      params.push(filtros.hasta);
    }

    if (filtros?.tipo) {
      query += ' AND tipo_movimiento = ?';
      params.push(filtros.tipo);
    }

    query += ' ORDER BY fecha DESC, created_at DESC';

    return db.prepare(query).all(...params) as MovimientoCC[];
  }

  /**
   * Crea un movimiento en una cuenta corriente
   */
  crearMovimiento(data: {
    cuenta_id: number;
    fecha: string;
    tipo_movimiento: 'INGRESO' | 'EGRESO';
    concepto: string;
    monto: number;
    movimiento_origen_id?: number;
  }): MovimientoCC {
    return transaction(() => {
      // Obtener cuenta
      const cuenta = this.obtenerPorId(data.cuenta_id);
      if (!cuenta) {
        throw new Error('Cuenta corriente no encontrada');
      }

      // Calcular nuevo saldo
      let nuevoSaldo = cuenta.saldo_actual;
      if (data.tipo_movimiento === 'INGRESO') {
        nuevoSaldo += data.monto;
      } else {
        nuevoSaldo -= data.monto;
      }

      // Insertar movimiento
      const result = db
        .prepare(
          `INSERT INTO movimientos_cc
           (cuenta_id, fecha, tipo_movimiento, concepto, monto, saldo_resultante, movimiento_origen_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.cuenta_id,
          data.fecha,
          data.tipo_movimiento,
          data.concepto,
          data.monto,
          nuevoSaldo,
          data.movimiento_origen_id || null
        );

      // Actualizar saldo de la cuenta
      db.prepare('UPDATE cuentas_corrientes SET saldo_actual = ? WHERE id = ?').run(
        nuevoSaldo,
        data.cuenta_id
      );

      const movimientoId = result.lastInsertRowid as number;
      const movimiento = db
        .prepare('SELECT * FROM movimientos_cc WHERE id = ?')
        .get(movimientoId) as MovimientoCC;

      return movimiento;
    });
  }

  /**
   * Elimina un movimiento
   */
  eliminarMovimiento(id: number): void {
    transaction(() => {
      const movimiento = db
        .prepare('SELECT * FROM movimientos_cc WHERE id = ?')
        .get(id) as MovimientoCC | undefined;

      if (!movimiento) {
        throw new Error('Movimiento no encontrado');
      }

      // Recalcular saldo de la cuenta
      const cuenta = this.obtenerPorId(movimiento.cuenta_id);
      if (!cuenta) {
        throw new Error('Cuenta corriente no encontrada');
      }

      let nuevoSaldo = cuenta.saldo_actual;
      if (movimiento.tipo_movimiento === 'INGRESO') {
        nuevoSaldo -= movimiento.monto;
      } else {
        nuevoSaldo += movimiento.monto;
      }

      // Eliminar movimiento
      db.prepare('DELETE FROM movimientos_cc WHERE id = ?').run(id);

      // Actualizar saldo de la cuenta
      db.prepare('UPDATE cuentas_corrientes SET saldo_actual = ? WHERE id = ?').run(
        nuevoSaldo,
        movimiento.cuenta_id
      );
    });
  }

  /**
   * Obtiene resumen de una cuenta
   */
  obtenerResumen(cuentaId: number): any {
    const cuenta = this.obtenerPorId(cuentaId);
    if (!cuenta) {
      throw new Error('Cuenta corriente no encontrada');
    }

    const resumen = db
      .prepare(
        `SELECT
          COUNT(*) as total_movimientos,
          SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE 0 END) as total_ingresos,
          SUM(CASE WHEN tipo_movimiento = 'EGRESO' THEN monto ELSE 0 END) as total_egresos
         FROM movimientos_cc
         WHERE cuenta_id = ?`
      )
      .get(cuentaId) as any;

    return {
      cuenta,
      total_movimientos: resumen.total_movimientos || 0,
      total_ingresos: resumen.total_ingresos || 0,
      total_egresos: resumen.total_egresos || 0,
      saldo_actual: cuenta.saldo_actual,
    };
  }

  /**
   * Limpia todos los movimientos de una cuenta corriente
   */
  limpiarCuenta(cuentaId: number): { movimientos_eliminados: number } {
    return transaction(() => {
      const cuenta = this.obtenerPorId(cuentaId);
      if (!cuenta) {
        throw new Error('Cuenta corriente no encontrada');
      }

      // Contar movimientos antes de eliminar
      const resultado = db
        .prepare('SELECT COUNT(*) as total FROM movimientos_cc WHERE cuenta_id = ?')
        .get(cuentaId) as { total: number };

      const movimientosEliminados = resultado.total;

      // Eliminar todos los movimientos de la cuenta
      db.prepare('DELETE FROM movimientos_cc WHERE cuenta_id = ?').run(cuentaId);

      // Resetear saldo a 0
      db.prepare('UPDATE cuentas_corrientes SET saldo_actual = 0 WHERE id = ?').run(cuentaId);

      return { movimientos_eliminados: movimientosEliminados };
    });
  }
}

export default new CuentasCorrientesService();
