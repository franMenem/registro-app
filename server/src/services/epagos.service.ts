import db from '../db/database';

export class EpagosService {
  /**
   * Registrar un nuevo ePago
   */
  crear(fecha: string, monto: number, tipo: 'RENTAS' | 'CAJA', observaciones?: string) {
    const result = db
      .prepare(
        `INSERT INTO control_epagos (fecha, monto, tipo, observaciones)
         VALUES (?, ?, ?, ?)`
      )
      .run(fecha, monto, tipo, observaciones || null);

    return { id: result.lastInsertRowid };
  }

  /**
   * Obtener todos los ePagos con filtros opcionales
   */
  obtenerTodos(filters?: { fechaDesde?: string; fechaHasta?: string }) {
    let query = 'SELECT * FROM control_epagos WHERE 1=1';
    const params: any[] = [];

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
   * Obtener totales (siempre CAJA)
   */
  obtenerTotales(filters?: { fechaDesde?: string; fechaHasta?: string }) {
    let query = `
      SELECT
        SUM(monto) as total_general
      FROM control_epagos
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.fechaDesde) {
      query += ' AND fecha >= ?';
      params.push(filters.fechaDesde);
    }

    if (filters?.fechaHasta) {
      query += ' AND fecha <= ?';
      params.push(filters.fechaHasta);
    }

    return db.prepare(query).get(...params);
  }

  /**
   * Actualizar un ePago
   */
  actualizar(id: number, datos: { fecha?: string; monto?: number; tipo?: 'RENTAS' | 'CAJA'; observaciones?: string }) {
    const fields = [];
    const values = [];

    if (datos.fecha !== undefined) {
      fields.push('fecha = ?');
      values.push(datos.fecha);
    }

    if (datos.monto !== undefined) {
      fields.push('monto = ?');
      values.push(datos.monto);
    }

    if (datos.tipo !== undefined) {
      fields.push('tipo = ?');
      values.push(datos.tipo);
    }

    if (datos.observaciones !== undefined) {
      fields.push('observaciones = ?');
      values.push(datos.observaciones);
    }

    if (fields.length === 0) {
      throw new Error('No hay campos para actualizar');
    }

    values.push(id);

    db.prepare(`UPDATE control_epagos SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  /**
   * Eliminar un ePago
   */
  eliminar(id: number) {
    db.prepare('DELETE FROM control_epagos WHERE id = ?').run(id);
  }
}

export default new EpagosService();
