import { Request, Response } from 'express';
import vepsService from '../services/veps.service';

export class VepsController {
  /**
   * GET /api/veps
   */
  async getAll(req: Request, res: Response) {
    try {
      const filters = {
        fechaDesde: req.query.fecha_desde as string,
        fechaHasta: req.query.fecha_hasta as string,
        tipo: req.query.tipo as string,
      };

      const veps = vepsService.obtenerTodos(filters);
      const totales = vepsService.obtenerTotales(filters);

      res.json({
        data: veps,
        totales,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * POST /api/veps
   */
  async create(req: Request, res: Response) {
    try {
      const { fecha, monto, tipo, observaciones } = req.body;

      // Validaciones
      if (!fecha || !monto || !tipo) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, monto, tipo',
        });
      }

      if (monto <= 0) {
        return res.status(400).json({
          message: 'El monto debe ser mayor a 0',
        });
      }

      if (!['RENTAS', 'CAJA'].includes(tipo)) {
        return res.status(400).json({
          message: 'El tipo debe ser RENTAS o CAJA',
        });
      }

      const resultado = vepsService.crear(fecha, parseFloat(monto), tipo, observaciones);

      res.status(201).json({
        data: resultado,
        message: 'VEP registrado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/veps/:id
   */
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { fecha, monto, tipo, observaciones } = req.body;

      // Validaciones
      if (monto !== undefined && monto <= 0) {
        return res.status(400).json({
          message: 'El monto debe ser mayor a 0',
        });
      }

      if (tipo !== undefined && !['RENTAS', 'CAJA'].includes(tipo)) {
        return res.status(400).json({
          message: 'El tipo debe ser RENTAS o CAJA',
        });
      }

      vepsService.actualizar(id, { fecha, monto, tipo, observaciones });

      res.json({
        message: 'VEP actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/veps/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      vepsService.eliminar(id);

      res.json({
        message: 'VEP eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new VepsController();
