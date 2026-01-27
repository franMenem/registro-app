import db from '../db/database';
import { IControlService } from '../interfaces/control.interface';
import { calcularSemanaLaboral, calcularProximoLunes } from '../utils/fechas.util';

/**
 * Servicio para controles semanales (GIT, SUAT, SUCERP, SUGIT)
 * Aplicando Single Responsibility Principle
 */
export class ControlSemanalService implements IControlService {
  /**
   * Actualiza o crea un control semanal para un concepto
   */
  async actualizarControl(conceptoId: number, fecha: Date, monto: number): Promise<void> {
    const { fechaInicio, fechaFin } = calcularSemanaLaboral(fecha);

    // Buscar control existente
    const controlExistente = db
      .prepare(
        `SELECT * FROM controles_semanales
         WHERE concepto_id = ? AND fecha_inicio = ? AND fecha_fin = ?`
      )
      .get(conceptoId, fechaInicio, fechaFin);

    if (controlExistente) {
      // Actualizar total
      db.prepare(
        `UPDATE controles_semanales
         SET total_recaudado = total_recaudado + ?
         WHERE id = ?`
      ).run(monto, (controlExistente as any).id);
    } else {
      // Crear nuevo control
      const fechaPagoProgramada = calcularProximoLunes(new Date(fechaFin));

      db.prepare(
        `INSERT INTO controles_semanales
         (concepto_id, fecha_inicio, fecha_fin, fecha_pago_programada, total_recaudado)
         VALUES (?, ?, ?, ?, ?)`
      ).run(conceptoId, fechaInicio, fechaFin, fechaPagoProgramada, monto);
    }
  }

  /**
   * Obtiene todos los controles semanales con filtros opcionales
   */
  getControles(filters?: { conceptoId?: number; pagado?: boolean }): any[] {
    let query = `
      SELECT cs.*, c.nombre as concepto_nombre
      FROM controles_semanales cs
      JOIN conceptos c ON cs.concepto_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.conceptoId) {
      query += ' AND cs.concepto_id = ?';
      params.push(filters.conceptoId);
    }

    if (filters?.pagado !== undefined) {
      query += ' AND cs.pagado = ?';
      params.push(filters.pagado ? 1 : 0);
    }

    query += ' ORDER BY cs.fecha_pago_programada DESC';

    return db.prepare(query).all(...params);
  }

  /**
   * Marca un control como pagado
   */
  marcarComoPagado(controlId: number, fechaPago: string): void {
    db.prepare(
      `UPDATE controles_semanales
       SET pagado = 1, fecha_pago_real = ?
       WHERE id = ?`
    ).run(fechaPago, controlId);
  }
}

export default new ControlSemanalService();
