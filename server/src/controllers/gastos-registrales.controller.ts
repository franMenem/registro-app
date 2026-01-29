import { Request, Response } from 'express';
import gastosRegistralesService from '../services/gastos-registrales.service';
import { importarGastosRegistralesCSV } from '../services/gastos-registrales-import.service';
import { GastoRegistralCreate, GastoRegistralUpdate } from '../types/gastos-registrales.types';

/**
 * Controlador para Gastos Registrales
 * Principio Dependency Inversion: Depende del servicio (abstracción)
 */
export class GastosRegistralesController {
  /**
   * GET /api/gastos-registrales?mes=1&anio=2026&concepto=AGUA&estado=Pagado
   */
  async obtenerTodos(req: Request, res: Response) {
    try {
      const { mes, anio, concepto, estado } = req.query;

      const filtros = {
        mes: mes ? parseInt(mes as string) : undefined,
        anio: anio ? parseInt(anio as string) : undefined,
        concepto: concepto as any,
        estado: estado as any,
      };

      const gastos = gastosRegistralesService.obtenerTodos(filtros);
      res.json({ success: true, data: gastos });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/gastos-registrales/:id
   */
  async obtenerPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const gasto = gastosRegistralesService.obtenerPorId(parseInt(id));

      if (!gasto) {
        return res.status(404).json({ success: false, error: 'Gasto no encontrado' });
      }

      res.json({ success: true, data: gasto });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/gastos-registrales
   */
  async crear(req: Request, res: Response) {
    try {
      const data: GastoRegistralCreate = req.body;

      // Validaciones básicas
      if (!data.fecha || !data.concepto || !data.monto) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
      }

      if (data.monto <= 0) {
        return res.status(400).json({ success: false, error: 'El monto debe ser mayor a 0' });
      }

      const gasto = gastosRegistralesService.crear(data);
      res.status(201).json({ success: true, data: gasto });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/gastos-registrales/:id
   */
  async actualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: GastoRegistralUpdate = req.body;

      const gasto = gastosRegistralesService.actualizar(parseInt(id), data);
      res.json({ success: true, data: gasto });
    } catch (error: any) {
      if (error.message === 'Gasto no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/gastos-registrales/:id
   */
  async eliminar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      gastosRegistralesService.eliminar(parseInt(id));
      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Gasto no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/gastos-registrales/resumen/:mes/:anio
   */
  async obtenerResumen(req: Request, res: Response) {
    try {
      const { mes, anio } = req.params;
      const resumen = gastosRegistralesService.obtenerResumenMensual(
        parseInt(mes),
        parseInt(anio)
      );
      res.json({ success: true, data: resumen });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/gastos-registrales/pendientes/:mes/:anio
   */
  async obtenerPendientes(req: Request, res: Response) {
    try {
      const { mes, anio } = req.params;
      const pendientes = gastosRegistralesService.obtenerGastosPendientesMes(
        parseInt(mes),
        parseInt(anio)
      );
      res.json({ success: true, data: pendientes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/gastos-registrales/import
   */
  async importarCSV(req: Request, res: Response) {
    try {
      const { contenido } = req.body;

      if (!contenido) {
        return res.status(400).json({ success: false, error: 'Contenido no proporcionado' });
      }

      const resultado = importarGastosRegistralesCSV(contenido);
      res.json({
        success: true,
        message: 'Importación completada',
        data: resultado
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new GastosRegistralesController();
