import { Request, Response } from 'express';
import cuentasService from '../services/cuentas.service';

export class CuentasController {
  /**
   * GET /api/cuentas
   */
  async getAll(req: Request, res: Response) {
    try {
      const cuentas = cuentasService.getCuentas();

      res.json({
        data: cuentas,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/cuentas/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const cuenta = cuentasService.getCuentaById(id);

      if (!cuenta) {
        return res.status(404).json({ message: 'Cuenta no encontrada' });
      }

      res.json({
        data: cuenta,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/cuentas/:id/movimientos
   */
  async getMovimientos(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      const filters = {
        fechaDesde: req.query.fecha_desde as string,
        fechaHasta: req.query.fecha_hasta as string,
      };

      const movimientos = cuentasService.getMovimientos(id, filters);

      res.json({
        data: movimientos,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * POST /api/cuentas/:id/movimientos
   */
  async createMovimiento(req: Request, res: Response) {
    try {
      const cuentaId = parseInt(req.params.id);
      const { fecha, tipo_movimiento, concepto, monto } = req.body;

      // Validaciones
      if (!fecha || !tipo_movimiento || !concepto || !monto) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, tipo_movimiento, concepto, monto',
        });
      }

      if (monto <= 0) {
        return res.status(400).json({
          message: 'El monto debe ser mayor a 0',
        });
      }

      await cuentasService.crearMovimiento(
        cuentaId,
        fecha,
        tipo_movimiento,
        concepto,
        parseFloat(monto)
      );

      const movimientos = cuentasService.getMovimientos(cuentaId);

      res.status(201).json({
        data: movimientos[0], // El más reciente
        message: 'Movimiento registrado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new CuentasController();
