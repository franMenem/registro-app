import db, { transaction } from '../db/database';

/**
 * Servicio para gestión de cuentas corrientes
 * Aplicando Single Responsibility Principle
 */
export class CuentasService {
  /**
   * Crea un movimiento en cuenta corriente
   */
  async crearMovimiento(
    cuentaId: number,
    fecha: string,
    tipoMovimiento: 'INGRESO' | 'EGRESO',
    concepto: string,
    monto: number,
    movimientoOrigenId?: number
  ): Promise<void> {
    // Verificar que la cuenta existe
    const cuenta = db
      .prepare('SELECT id FROM cuentas_corrientes WHERE id = ?')
      .get(cuentaId) as any;

    if (!cuenta) {
      throw new Error('Cuenta no encontrada');
    }

    // Insertar movimiento con saldo temporal (será recalculado)
    db.prepare(
      `INSERT INTO movimientos_cc
       (cuenta_id, fecha, tipo_movimiento, concepto, monto, saldo_resultante, movimiento_origen_id)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).run(cuentaId, fecha, tipoMovimiento, concepto, monto, movimientoOrigenId);

    // Recalcular todos los saldos desde el principio
    // Esto asegura que los saldos sean correctos incluso si se inserta
    // un movimiento con fecha anterior a otros existentes
    this.recalcularSaldos(cuentaId);
  }

  /**
   * Obtiene todas las cuentas corrientes
   */
  getCuentas(): any[] {
    return db
      .prepare(
        `SELECT * FROM cuentas_corrientes
         ORDER BY nombre`
      )
      .all();
  }

  /**
   * Obtiene una cuenta por ID
   */
  getCuentaById(id: number): any {
    return db.prepare('SELECT * FROM cuentas_corrientes WHERE id = ?').get(id);
  }

  /**
   * Obtiene una cuenta por nombre
   */
  getCuentaByNombre(nombre: string): any {
    return db.prepare('SELECT * FROM cuentas_corrientes WHERE nombre = ?').get(nombre);
  }

  /**
   * Obtiene movimientos de una cuenta con filtros
   */
  getMovimientos(
    cuentaId: number,
    filters?: {
      fechaDesde?: string;
      fechaHasta?: string;
    }
  ): any[] {
    let query = `
      SELECT * FROM movimientos_cc
      WHERE cuenta_id = ?
    `;

    const params: any[] = [cuentaId];

    if (filters?.fechaDesde) {
      query += ' AND fecha >= ?';
      params.push(filters.fechaDesde);
    }

    if (filters?.fechaHasta) {
      query += ' AND fecha <= ?';
      params.push(filters.fechaHasta);
    }

    query += ' ORDER BY fecha DESC, id DESC';

    return db.prepare(query).all(...params);
  }

  /**
   * Actualiza un movimiento de cuenta corriente
   * Recalcula todos los saldos posteriores
   */
  async actualizarMovimiento(
    movimientoId: number,
    datos: { monto?: number; concepto?: string; fecha?: string }
  ): Promise<void> {
    // Obtener el movimiento actual
    const movimiento = db
      .prepare('SELECT * FROM movimientos_cc WHERE id = ?')
      .get(movimientoId) as any;

    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    // Si solo se actualiza el concepto, no hay que recalcular saldos
    if (datos.concepto && !datos.monto && !datos.fecha) {
      db.prepare('UPDATE movimientos_cc SET concepto = ? WHERE id = ?').run(
        datos.concepto,
        movimientoId
      );
      return;
    }

    // Si se actualiza el monto o la fecha, hay que recalcular todos los saldos
    if (datos.monto !== undefined || datos.fecha !== undefined) {
      // Actualizar el movimiento
      const updateFields = [];
      const updateValues = [];

      if (datos.monto !== undefined) {
        updateFields.push('monto = ?');
        updateValues.push(datos.monto);
      }

      if (datos.concepto) {
        updateFields.push('concepto = ?');
        updateValues.push(datos.concepto);
      }

      if (datos.fecha) {
        updateFields.push('fecha = ?');
        updateValues.push(datos.fecha);
      }

      updateValues.push(movimientoId);

      db.prepare(`UPDATE movimientos_cc SET ${updateFields.join(', ')} WHERE id = ?`).run(
        ...updateValues
      );

      // Recalcular saldos desde el inicio (porque la fecha puede cambiar el orden)
      this.recalcularSaldos(movimiento.cuenta_id);
    }
  }

  /**
   * Elimina un movimiento de cuenta corriente
   * Recalcula todos los saldos posteriores
   */
  async eliminarMovimiento(movimientoId: number): Promise<void> {
    // Obtener el movimiento
    const movimiento = db
      .prepare('SELECT * FROM movimientos_cc WHERE id = ?')
      .get(movimientoId) as any;

    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    // Eliminar el movimiento
    db.prepare('DELETE FROM movimientos_cc WHERE id = ?').run(movimientoId);

    // Recalcular saldos
    this.recalcularSaldos(movimiento.cuenta_id);
  }

  /**
   * Recalcula todos los saldos de una cuenta desde el principio
   * Optimizado con window functions para evitar N queries
   */
  recalcularSaldos(cuentaId: number): void {
    transaction(() => {
      // Recalcular todos los saldos usando window function (1 query en lugar de N)
      db.prepare(`
        WITH movimientos_ordenados AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY fecha, id) as rn,
            monto,
            tipo_movimiento
          FROM movimientos_cc
          WHERE cuenta_id = ?
        ),
        saldos_calculados AS (
          SELECT
            id,
            SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE -monto END)
              OVER (ORDER BY rn) as nuevo_saldo
          FROM movimientos_ordenados
        )
        UPDATE movimientos_cc
        SET saldo_resultante = (
          SELECT nuevo_saldo FROM saldos_calculados
          WHERE saldos_calculados.id = movimientos_cc.id
        )
        WHERE cuenta_id = ?
      `).run(cuentaId, cuentaId);

      // Actualizar saldo actual de la cuenta
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
}

export default new CuentasService();
