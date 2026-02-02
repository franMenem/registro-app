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
   * Recalcula todos los saldos de una cuenta desde una fecha específica en adelante
   * @param cuentaId ID de la cuenta
   * @param desdeFecha Fecha desde donde recalcular (formato YYYY-MM-DD)
   */
  private recalcularSaldosDesdeFecha(cuentaId: number, desdeFecha: string): void {
    transaction(() => {
      // 1. Obtener el saldo anterior a la fecha especificada
      const saldoAnterior = this.obtenerSaldoAnteriorA(cuentaId, desdeFecha);

      // 2. Recalcular todos los saldos usando window function (1 query en lugar de N)
      // Esto es MUCHO más eficiente que hacer UPDATE por cada movimiento
      db.prepare(`
        WITH movimientos_ordenados AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY fecha, id) as rn,
            monto,
            tipo_movimiento
          FROM movimientos_cc
          WHERE cuenta_id = ? AND fecha >= ?
        ),
        saldos_calculados AS (
          SELECT
            id,
            ? + SUM(
              CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE -monto END
            ) OVER (ORDER BY rn) as nuevo_saldo
          FROM movimientos_ordenados
        )
        UPDATE movimientos_cc
        SET saldo_resultante = (
          SELECT nuevo_saldo FROM saldos_calculados
          WHERE saldos_calculados.id = movimientos_cc.id
        )
        WHERE cuenta_id = ? AND fecha >= ?
      `).run(cuentaId, desdeFecha, saldoAnterior, cuentaId, desdeFecha);

      // 3. Actualizar saldo final de la cuenta
      const ultimoMovimiento = db
        .prepare(
          `SELECT saldo_resultante FROM movimientos_cc
           WHERE cuenta_id = ? ORDER BY fecha DESC, id DESC LIMIT 1`
        )
        .get(cuentaId) as { saldo_resultante: number } | undefined;

      db.prepare('UPDATE cuentas_corrientes SET saldo_actual = ? WHERE id = ?').run(
        ultimoMovimiento?.saldo_resultante || 0,
        cuentaId
      );
    });
  }

  /**
   * Obtiene el saldo anterior a una fecha específica
   * @param cuentaId ID de la cuenta
   * @param fecha Fecha límite
   * @returns Saldo anterior a la fecha
   */
  private obtenerSaldoAnteriorA(cuentaId: number, fecha: string): number {
    const resultado = db
      .prepare(
        `SELECT COALESCE(saldo_resultante, 0) as saldo
         FROM movimientos_cc
         WHERE cuenta_id = ? AND fecha < ?
         ORDER BY fecha DESC, id DESC
         LIMIT 1`
      )
      .get(cuentaId, fecha) as { saldo: number } | undefined;

    return resultado?.saldo || 0;
  }

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
   * Obtiene los movimientos de una cuenta con paginación
   */
  obtenerMovimientos(cuentaId: number, filtros?: {
    desde?: string;
    hasta?: string;
    tipo?: 'INGRESO' | 'EGRESO';
    limit?: number;
    offset?: number;
  }): { movimientos: MovimientoCC[]; total: number } {
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

    // Contar total de movimientos (para paginación)
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countQuery).get(...params) as { total: number };

    // Aplicar ordenamiento y paginación
    query += ' ORDER BY fecha DESC, created_at DESC';

    if (filtros?.limit) {
      query += ' LIMIT ?';
      params.push(filtros.limit);
    } else {
      query += ' LIMIT 100'; // Default limit
      params.push(100);
    }

    if (filtros?.offset) {
      query += ' OFFSET ?';
      params.push(filtros.offset);
    }

    const movimientos = db.prepare(query).all(...params) as MovimientoCC[];

    return { movimientos, total };
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

      // Obtener el saldo anterior a la fecha del nuevo movimiento
      const movimientoAnterior = db
        .prepare(
          `SELECT saldo_resultante
           FROM movimientos_cc
           WHERE cuenta_id = ? AND fecha < ?
           ORDER BY fecha DESC, id DESC
           LIMIT 1`
        )
        .get(data.cuenta_id, data.fecha) as { saldo_resultante: number } | undefined;

      let saldoAnterior = movimientoAnterior?.saldo_resultante || 0;

      // Calcular saldo del nuevo movimiento
      let saldoNuevo = saldoAnterior;
      if (data.tipo_movimiento === 'INGRESO') {
        saldoNuevo += data.monto;
      } else {
        saldoNuevo -= data.monto;
      }

      // Insertar movimiento con saldo calculado
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
          saldoNuevo,
          data.movimiento_origen_id || null
        );

      const movimientoId = result.lastInsertRowid as number;

      // Recalcular saldos de todos los movimientos posteriores
      this.recalcularSaldosDesdeFecha(data.cuenta_id, data.fecha);

      // Obtener el movimiento insertado con el saldo recalculado
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

      const cuenta = this.obtenerPorId(movimiento.cuenta_id);
      if (!cuenta) {
        throw new Error('Cuenta corriente no encontrada');
      }

      // Guardar fecha del movimiento a eliminar
      const fechaMovimiento = movimiento.fecha;

      // Eliminar movimiento
      db.prepare('DELETE FROM movimientos_cc WHERE id = ?').run(id);

      // Recalcular saldos desde la fecha del movimiento eliminado
      this.recalcularSaldosDesdeFecha(movimiento.cuenta_id, fechaMovimiento);
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

  /**
   * Recalcula todos los saldos de una cuenta desde el principio
   * Útil para corregir inconsistencias
   */
  recalcularTodosSaldos(cuentaId: number): { movimientos_actualizados: number } {
    return transaction(() => {
      const cuenta = this.obtenerPorId(cuentaId);
      if (!cuenta) {
        throw new Error('Cuenta corriente no encontrada');
      }

      // Obtener el primer movimiento (fecha más antigua)
      const primerMovimiento = db
        .prepare(
          `SELECT fecha
           FROM movimientos_cc
           WHERE cuenta_id = ?
           ORDER BY fecha ASC, id ASC
           LIMIT 1`
        )
        .get(cuentaId) as { fecha: string } | undefined;

      if (!primerMovimiento) {
        // No hay movimientos, solo resetear saldo
        db.prepare('UPDATE cuentas_corrientes SET saldo_actual = 0 WHERE id = ?').run(cuentaId);
        return { movimientos_actualizados: 0 };
      }

      // Recalcular desde el primer movimiento
      this.recalcularSaldosDesdeFecha(cuentaId, primerMovimiento.fecha);

      // Contar movimientos actualizados
      const resultado = db
        .prepare('SELECT COUNT(*) as total FROM movimientos_cc WHERE cuenta_id = ?')
        .get(cuentaId) as { total: number };

      return { movimientos_actualizados: resultado.total };
    });
  }
}

export default new CuentasCorrientesService();
