import db from '../db/database';

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
    // Obtener saldo actual de la cuenta
    const cuenta = db
      .prepare('SELECT saldo_actual FROM cuentas_corrientes WHERE id = ?')
      .get(cuentaId) as any;

    if (!cuenta) {
      throw new Error('Cuenta no encontrada');
    }

    // Calcular nuevo saldo
    const nuevoSaldo =
      tipoMovimiento === 'INGRESO'
        ? cuenta.saldo_actual + monto
        : cuenta.saldo_actual - monto;

    // Insertar movimiento
    db.prepare(
      `INSERT INTO movimientos_cc
       (cuenta_id, fecha, tipo_movimiento, concepto, monto, saldo_resultante, movimiento_origen_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(cuentaId, fecha, tipoMovimiento, concepto, monto, nuevoSaldo, movimientoOrigenId);

    // Actualizar saldo de la cuenta
    db.prepare(
      `UPDATE cuentas_corrientes
       SET saldo_actual = ?
       WHERE id = ?`
    ).run(nuevoSaldo, cuentaId);
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
    datos: { monto?: number; concepto?: string }
  ): Promise<void> {
    // Obtener el movimiento actual
    const movimiento = db
      .prepare('SELECT * FROM movimientos_cc WHERE id = ?')
      .get(movimientoId) as any;

    if (!movimiento) {
      throw new Error('Movimiento no encontrado');
    }

    // Si solo se actualiza el concepto, no hay que recalcular saldos
    if (datos.concepto && !datos.monto) {
      db.prepare('UPDATE movimientos_cc SET concepto = ? WHERE id = ?').run(
        datos.concepto,
        movimientoId
      );
      return;
    }

    // Si se actualiza el monto, hay que recalcular todos los saldos
    if (datos.monto !== undefined) {
      // Actualizar el movimiento
      db.prepare('UPDATE movimientos_cc SET monto = ?, concepto = ? WHERE id = ?').run(
        datos.monto,
        datos.concepto || movimiento.concepto,
        movimientoId
      );

      // Recalcular saldos desde este movimiento en adelante
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
   */
  private recalcularSaldos(cuentaId: number): void {
    // Obtener todos los movimientos ordenados cronológicamente
    const movimientos = db
      .prepare(
        `SELECT * FROM movimientos_cc
         WHERE cuenta_id = ?
         ORDER BY fecha ASC, id ASC`
      )
      .all(cuentaId) as any[];

    let saldoActual = 0;

    // Recalcular cada saldo
    for (const mov of movimientos) {
      if (mov.tipo_movimiento === 'INGRESO') {
        saldoActual += mov.monto;
      } else {
        saldoActual -= mov.monto;
      }

      // Actualizar saldo del movimiento
      db.prepare('UPDATE movimientos_cc SET saldo_resultante = ? WHERE id = ?').run(
        saldoActual,
        mov.id
      );
    }

    // Actualizar saldo actual de la cuenta
    db.prepare('UPDATE cuentas_corrientes SET saldo_actual = ? WHERE id = ?').run(
      saldoActual,
      cuentaId
    );
  }
}

export default new CuentasService();
