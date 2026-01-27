import db from '../db/database';
import { obtenerMesAnio } from '../utils/fechas.util';

/**
 * Servicio para control POSNET mensual
 * POSNET requiere control manual - este servicio solo registra los totales
 * Aplicando Single Responsibility Principle
 */
export class ControlPOSNETService {
  /**
   * Actualiza el control POSNET mensual
   * Solo registra, no calcula pagos automáticos
   */
  async actualizarControl(fecha: Date, monto: number, tipo: 'RENTAS' | 'CAJA'): Promise<void> {
    const { mes, anio } = obtenerMesAnio(fecha);

    // Buscar control existente
    const controlExistente = db
      .prepare(
        `SELECT * FROM control_posnet
         WHERE mes = ? AND anio = ?`
      )
      .get(mes, anio);

    if (controlExistente) {
      // Actualizar total según tipo
      const campo = tipo === 'RENTAS' ? 'total_rentas' : 'total_caja';

      db.prepare(
        `UPDATE control_posnet
         SET ${campo} = ${campo} + ?,
             total_general = total_rentas + total_caja + ?
         WHERE id = ?`
      ).run(monto, monto, (controlExistente as any).id);
    } else {
      // Crear nuevo control
      const totalRentas = tipo === 'RENTAS' ? monto : 0;
      const totalCaja = tipo === 'CAJA' ? monto : 0;

      db.prepare(
        `INSERT INTO control_posnet
         (mes, anio, total_rentas, total_caja, total_general)
         VALUES (?, ?, ?, ?, ?)`
      ).run(mes, anio, totalRentas, totalCaja, monto);
    }
  }

  /**
   * Obtiene el control POSNET de un mes específico
   */
  getControl(mes: number, anio: number): any {
    return db
      .prepare(
        `SELECT * FROM control_posnet
         WHERE mes = ? AND anio = ?`
      )
      .get(mes, anio);
  }

  /**
   * Obtiene todos los controles POSNET
   */
  getControles(): any[] {
    return db
      .prepare(
        `SELECT * FROM control_posnet
         ORDER BY anio DESC, mes DESC`
      )
      .all();
  }
}

export default new ControlPOSNETService();
