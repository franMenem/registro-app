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

      // Total RENTAS efectivo hoy
      const totalRentasHoy = db
        .prepare(
          `SELECT COALESCE(SUM(monto), 0) as total
           FROM movimientos
           WHERE tipo = 'RENTAS' AND fecha = ?`
        )
        .get(hoy) as any;

      // Total CAJA efectivo hoy
      const totalCajaHoy = db
        .prepare(
          `SELECT COALESCE(SUM(monto), 0) as total
           FROM movimientos
           WHERE tipo = 'CAJA' AND fecha = ?`
        )
        .get(hoy) as any;

      // Total controles semanales pendientes
      const totalSemanalPendiente = db
        .prepare(
          `SELECT COALESCE(SUM(total_recaudado), 0) as total
           FROM controles_semanales
           WHERE pagado = 0`
        )
        .get() as any;

      // Total controles quincenales pendientes
      const totalQuincenalPendiente = db
        .prepare(
          `SELECT COALESCE(SUM(total_recaudado), 0) as total
           FROM controles_quincenales
           WHERE pagado = 0`
        )
        .get() as any;

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
          total_semanal_pendiente: totalSemanalPendiente.total,
          total_quincenal_pendiente: totalQuincenalPendiente.total,
          alertas_pagos: alertasPagos.count,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/dashboard/controles-pendientes
   */
  async getControlesPendientes(req: Request, res: Response) {
    try {
      // Obtener controles semanales pendientes
      const semanales = db
        .prepare(
          `SELECT cs.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo,
            'SEMANAL' as frecuencia
           FROM controles_semanales cs
           JOIN conceptos c ON cs.concepto_id = c.id
           WHERE cs.pagado = 0
           ORDER BY cs.fecha_pago_programada ASC`
        )
        .all();

      // Obtener controles quincenales pendientes
      const quincenales = db
        .prepare(
          `SELECT cq.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo,
            'QUINCENAL' as frecuencia
           FROM controles_quincenales cq
           JOIN conceptos c ON cq.concepto_id = c.id
           WHERE cq.pagado = 0
           ORDER BY cq.fecha_pago_programada ASC`
        )
        .all();

      // Combinar ambos arrays
      const controles = [...semanales, ...quincenales].sort((a: any, b: any) => {
        return a.fecha_pago_programada.localeCompare(b.fecha_pago_programada);
      });

      res.json({
        data: controles,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/dashboard/alertas-pagos
   */
  async getAlertasPagos(req: Request, res: Response) {
    try {
      // Obtener controles semanales próximos a vencer (próximos 7 días)
      const semanales = db
        .prepare(
          `SELECT cs.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo,
            'SEMANAL' as frecuencia
           FROM controles_semanales cs
           JOIN conceptos c ON cs.concepto_id = c.id
           WHERE cs.pagado = 0
             AND cs.fecha_pago_programada BETWEEN date('now') AND date('now', '+7 days')
           ORDER BY cs.fecha_pago_programada ASC`
        )
        .all();

      // Obtener controles quincenales próximos a vencer
      const quincenales = db
        .prepare(
          `SELECT cq.*, c.nombre as concepto_nombre, c.tipo as concepto_tipo,
            'QUINCENAL' as frecuencia
           FROM controles_quincenales cq
           JOIN conceptos c ON cq.concepto_id = c.id
           WHERE cq.pagado = 0
             AND cq.fecha_pago_programada BETWEEN date('now') AND date('now', '+7 days')
           ORDER BY cq.fecha_pago_programada ASC`
        )
        .all();

      // Combinar y ordenar
      const alertas = [...semanales, ...quincenales].sort((a: any, b: any) => {
        return a.fecha_pago_programada.localeCompare(b.fecha_pago_programada);
      });

      res.json({
        data: alertas,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new DashboardController();
