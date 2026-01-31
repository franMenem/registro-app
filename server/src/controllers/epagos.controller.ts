import { Request, Response } from 'express';
import epagosService from '../services/epagos.service';

export class EpagosController {
  /**
   * GET /api/epagos
   */
  async getAll(req: Request, res: Response) {
    try {
      const filters = {
        fechaDesde: req.query.fecha_desde as string,
        fechaHasta: req.query.fecha_hasta as string,
        tipo: req.query.tipo as string,
      };

      const epagos = epagosService.obtenerTodos(filters);
      const totales = epagosService.obtenerTotales(filters);

      res.json({
        data: epagos,
        totales,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * POST /api/epagos
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

      const resultado = epagosService.crear(fecha, parseFloat(monto), tipo, observaciones);

      res.status(201).json({
        data: resultado,
        message: 'ePago registrado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/epagos/:id
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

      epagosService.actualizar(id, { fecha, monto, tipo, observaciones });

      res.json({
        message: 'ePago actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/epagos/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      epagosService.eliminar(id);

      res.json({
        message: 'ePago eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new EpagosController();
