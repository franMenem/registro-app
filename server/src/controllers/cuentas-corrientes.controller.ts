import { Request, Response } from 'express';
import cuentasCorrientesService from '../services/cuentas-corrientes.service';
import cuentasCorrientesImportService from '../services/cuentas-corrientes-import.service';

export class CuentasCorrientesController {
  /**
   * Obtiene todas las cuentas corrientes
   */
  obtenerTodas(req: Request, res: Response) {
    try {
      const cuentas = cuentasCorrientesService.obtenerTodas();
      res.json({ success: true, cuentas });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener cuentas corrientes',
      });
    }
  }

  /**
   * Obtiene una cuenta por ID
   */
  obtenerPorId(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const cuenta = cuentasCorrientesService.obtenerPorId(id);

      if (!cuenta) {
        return res.status(404).json({
          success: false,
          message: 'Cuenta corriente no encontrada',
        });
      }

      res.json({ success: true, cuenta });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener cuenta corriente',
      });
    }
  }

  /**
   * Obtiene los movimientos de una cuenta
   */
  obtenerMovimientos(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { desde, hasta, tipo, limit, offset } = req.query;

      const resultado = cuentasCorrientesService.obtenerMovimientos(id, {
        desde: desde as string,
        hasta: hasta as string,
        tipo: tipo as 'INGRESO' | 'EGRESO',
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      res.json({
        success: true,
        data: resultado.movimientos,
        pagination: {
          total: resultado.total,
          limit: limit ? parseInt(limit as string) : 100,
          offset: offset ? parseInt(offset as string) : 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener movimientos',
      });
    }
  }

  /**
   * Crea un movimiento en una cuenta corriente
   */
  crearMovimiento(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { fecha, tipo_movimiento, concepto, monto } = req.body;

      if (!fecha || !tipo_movimiento || !concepto || !monto) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos (fecha, tipo_movimiento, concepto, monto)',
        });
      }

      const movimiento = cuentasCorrientesService.crearMovimiento({
        cuenta_id: id,
        fecha,
        tipo_movimiento,
        concepto,
        monto,
      });

      res.json({
        success: true,
        message: 'Movimiento creado correctamente',
        movimiento,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al crear movimiento',
      });
    }
  }

  /**
   * Elimina un movimiento
   */
  eliminarMovimiento(req: Request, res: Response) {
    try {
      const movimientoId = parseInt(req.params.movimientoId);
      cuentasCorrientesService.eliminarMovimiento(movimientoId);

      res.json({
        success: true,
        message: 'Movimiento eliminado correctamente',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al eliminar movimiento',
      });
    }
  }

  /**
   * Obtiene resumen de una cuenta
   */
  obtenerResumen(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const resumen = cuentasCorrientesService.obtenerResumen(id);

      res.json({ success: true, resumen });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener resumen',
      });
    }
  }

  /**
   * Importa movimientos desde CSV
   */
  importarCSV(req: Request, res: Response) {
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
   * Recalcula todos los saldos de una cuenta
   */
  recalcularSaldos(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const resultado = cuentasCorrientesService.recalcularTodosSaldos(id);

      res.json({
        success: true,
        message: `Saldos recalculados correctamente: ${resultado.movimientos_actualizados} movimientos actualizados`,
        movimientos_actualizados: resultado.movimientos_actualizados,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al recalcular saldos',
      });
    }
  }
}

export default new CuentasCorrientesController();
