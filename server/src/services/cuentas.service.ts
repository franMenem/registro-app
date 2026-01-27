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
}

export default new CuentasService();
