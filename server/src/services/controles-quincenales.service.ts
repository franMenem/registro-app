import db from '../db/database';
import { IControlService } from '../interfaces/control.interface';
import { calcularQuincena, calcular5toDiaCorrido } from '../utils/fechas.util';

/**
 * Servicio para controles quincenales (ARBA)
 * Aplicando Single Responsibility Principle
 */
export class ControlQuincenalService implements IControlService {
  /**
   * Actualiza o crea un control quincenal para un concepto
   */
  async actualizarControl(conceptoId: number, fecha: Date, monto: number): Promise<void> {
    const { quincena, fechaInicio, fechaFin, mes, anio } = calcularQuincena(fecha);

    // Buscar control existente
    const controlExistente = db
      .prepare(
        `SELECT * FROM controles_quincenales
         WHERE concepto_id = ? AND mes = ? AND anio = ? AND quincena = ?`
      )
      .get(conceptoId, mes, anio, quincena);

    if (controlExistente) {
      // Actualizar total
      db.prepare(
        `UPDATE controles_quincenales
         SET total_recaudado = total_recaudado + ?
         WHERE id = ?`
      ).run(monto, (controlExistente as any).id);
    } else {
      // Crear nuevo control
      const fechaPagoProgramada = calcular5toDiaCorrido(new Date(fechaFin));

      db.prepare(
        `INSERT INTO controles_quincenales
         (concepto_id, quincena, mes, anio, fecha_inicio, fecha_fin, fecha_pago_programada, total_recaudado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(conceptoId, quincena, mes, anio, fechaInicio, fechaFin, fechaPagoProgramada, monto);
    }
  }

  /**
   * Obtiene todos los controles quincenales con filtros opcionales
   */
  getControles(filters?: { conceptoId?: number; pagado?: boolean }): any[] {
    let query = `
      SELECT cq.*, c.nombre as concepto_nombre
      FROM controles_quincenales cq
      JOIN conceptos c ON cq.concepto_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filters?.conceptoId) {
      query += ' AND cq.concepto_id = ?';
      params.push(filters.conceptoId);
    }

    if (filters?.pagado !== undefined) {
      query += ' AND cq.pagado = ?';
      params.push(filters.pagado ? 1 : 0);
    }

    query += ' ORDER BY cq.fecha_pago_programada DESC';

    return db.prepare(query).all(...params);
  }

  /**
   * Marca un control como pagado
   */
  marcarComoPagado(controlId: number, fechaPago: string): void {
    db.prepare(
      `UPDATE controles_quincenales
       SET pagado = 1, fecha_pago_real = ?
       WHERE id = ?`
    ).run(fechaPago, controlId);
  }
}

export default new ControlQuincenalService();
