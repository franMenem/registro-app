import { Request, Response } from 'express';
import planillasService from '../services/planillas.service';

export class PlanillasController {
  /**
   * GET /api/planillas/rentas
   */
  async getRentas(req: Request, res: Response) {
    try {
      const filters = {
        fechaDesde: req.query.fecha_desde as string,
        fechaHasta: req.query.fecha_hasta as string,
      };

      const datos = planillasService.obtenerRentasPorDia(filters);

      res.json({
        success: true,
        data: datos,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/planillas/caja
   */
  async getCaja(req: Request, res: Response) {
    try {
      const filters = {
        fechaDesde: req.query.fecha_desde as string,
        fechaHasta: req.query.fecha_hasta as string,
      };

      const datos = planillasService.obtenerCajaPorDia(filters);

      res.json({
        success: true,
        data: datos,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * PUT /api/planillas/rentas/:fecha
   */
  async updateRentas(req: Request, res: Response) {
    try {
      const { fecha } = req.params;
      const valores = req.body;

      const resultado = planillasService.actualizarRentasDia(fecha, valores);

      res.json({
        success: true,
        message: resultado.mensaje,
        alertas: resultado.alertas,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/planillas/caja/:fecha
   */
  async updateCaja(req: Request, res: Response) {
    try {
      const { fecha } = req.params;
      const valores = req.body;

      const resultado = planillasService.actualizarCajaDia(fecha, valores);

      res.json({
        success: true,
        message: resultado.mensaje,
        alertas: resultado.alertas,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new PlanillasController();
