import { Request, Response } from 'express';
import cuentasService from '../services/cuentas.service';
import cuentasCorrientesImportService from '../services/cuentas-corrientes-import.service';

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

  /**
   * PUT /api/cuentas/movimientos/:movimientoId
   */
  async updateMovimiento(req: Request, res: Response) {
    try {
      const movimientoId = parseInt(req.params.movimientoId);
      const { monto, concepto, fecha } = req.body;

      // Validaciones
      if (monto !== undefined && monto <= 0) {
        return res.status(400).json({
          message: 'El monto debe ser mayor a 0',
        });
      }

      await cuentasService.actualizarMovimiento(movimientoId, { monto, concepto, fecha });

      res.json({
        message: 'Movimiento actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/cuentas/movimientos/:movimientoId
   */
  async deleteMovimiento(req: Request, res: Response) {
    try {
      const movimientoId = parseInt(req.params.movimientoId);

      await cuentasService.eliminarMovimiento(movimientoId);

      res.json({
        message: 'Movimiento eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * POST /api/cuentas/:id/importar
   * Importa movimientos desde CSV
   */
  async importarCSV(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { contenido } = req.body;

      if (!contenido || typeof contenido !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar el contenido del CSV',
        });
      }

      const resultado = cuentasCorrientesImportService.importarMovimientosCSV(id, contenido);

      res.json({
        success: true,
        message: `Importación completada: ${resultado.insertados} movimientos insertados`,
        insertados: resultado.insertados,
        errores: resultado.errores,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al importar movimientos',
      });
    }
  }

  /**
   * DELETE /api/cuentas/:id/limpiar
   * Limpia todos los movimientos de una cuenta corriente
   */
  async limpiarCuenta(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      // Necesitamos importar el servicio correcto
      const cuentasCorrientesService = require('../services/cuentas-corrientes.service').default;
      const resultado = cuentasCorrientesService.limpiarCuenta(id);

      res.json({
        success: true,
        message: `Cuenta limpiada correctamente: ${resultado.movimientos_eliminados} movimientos eliminados`,
        movimientos_eliminados: resultado.movimientos_eliminados,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al limpiar la cuenta',
      });
    }
  }


  /**
   * POST /api/cuentas/:id/recalcular-saldos
   * Recalcula todos los saldos de una cuenta desde el principio
   */
  async recalcularSaldos(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      // Recalcular saldos
      cuentasService.recalcularSaldos(id);

      // Contar movimientos actualizados
      const movimientos = cuentasService.getMovimientos(id, {});

      res.json({
        success: true,
        message: `Saldos recalculados correctamente: ${movimientos.length} movimientos actualizados`,
        movimientos_actualizados: movimientos.length,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al recalcular saldos',
      });
    }
  }

}

export default new CuentasController();
