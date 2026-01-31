import db from '../db/database';

export class VepsService {
  /**
   * Registrar un nuevo VEP
   */
  crear(fecha: string, monto: number, tipo: 'RENTAS' | 'CAJA', observaciones?: string) {
    const result = db
      .prepare(
        `INSERT INTO control_veps (fecha, monto, tipo, observaciones)
         VALUES (?, ?, ?, ?)`
      )
      .run(fecha, monto, tipo, observaciones || null);

    return { id: result.lastInsertRowid };
  }

  /**
   * Obtener todos los VEPs con filtros opcionales
   */
  obtenerTodos(filters?: { fechaDesde?: string; fechaHasta?: string }) {
    let query = 'SELECT * FROM control_veps WHERE 1=1';
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
      FROM control_veps
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
   * Actualizar un VEP
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

    db.prepare(`UPDATE control_veps SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  /**
   * Eliminar un VEP
   */
  eliminar(id: number) {
    db.prepare('DELETE FROM control_veps WHERE id = ?').run(id);
  }
}

export default new VepsService();
