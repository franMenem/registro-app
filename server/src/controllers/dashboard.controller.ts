import { Request, Response } from 'express';
import db from '../db/database';
import { format } from 'date-fns';

export class DashboardController {
  /**
   * GET /api/dashboard/stats
   */
  async getStats(req: Request, res: Response) {
    try {
      const hoy = format(new Date(), 'yyyy-MM-dd');

      // Total RENTAS hoy
      const totalRentasHoy = db
        .prepare(
          `SELECT COALESCE(SUM(monto), 0) as total
           FROM movimientos
           WHERE tipo = 'RENTAS' AND fecha = ?`
        )
        .get(hoy) as any;

      // Total CAJA hoy
      const totalCajaHoy = db
        .prepare(
          `SELECT COALESCE(SUM(monto), 0) as total
           FROM movimientos
           WHERE tipo = 'CAJA' AND fecha = ?`
        )
        .get(hoy) as any;

      // Movimientos hoy
      const movimientosCount = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM movimientos
           WHERE fecha = ?`
        )
        .get(hoy) as any;

      // Alertas de pagos próximos (próximos 7 días)
      const alertasPagos = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM (
             SELECT fecha_pago_programada
             FROM controles_semanales
             WHERE pagado = 0 AND fecha_pago_programada BETWEEN date('now') AND date('now', '+7 days')
             UNION ALL
             SELECT fecha_pago_programada
             FROM controles_quincenales
             WHERE pagado = 0 AND fecha_pago_programada BETWEEN date('now') AND date('now', '+7 days')
           )`
        )
        .get() as any;

      res.json({
        data: {
          total_rentas_hoy: totalRentasHoy.total,
          total_caja_hoy: totalCajaHoy.total,
          movimientos_count: movimientosCount.count,
          alertas_pagos: alertasPagos.count,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new DashboardController();
