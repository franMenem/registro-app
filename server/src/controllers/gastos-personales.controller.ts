import { Request, Response } from 'express';
import gastosPersonalesService from '../services/gastos-personales.service';
import { importarGastosPersonalesCSV } from '../services/gastos-personales-import.service';
import { GastoPersonalCreate, GastoPersonalUpdate } from '../types/gastos-personales.types';

/**
 * Controlador para Gastos Personales
 * Principio Dependency Inversion: Depende del servicio (abstracción)
 */
export class GastosPersonalesController {
  /**
   * GET /api/gastos-personales?mes=1&anio=2026&concepto=Gaspar&estado=Pagado
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

      const gastos = gastosPersonalesService.obtenerTodos(filtros);
      res.json({ success: true, data: gastos });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/gastos-personales/:id
   */
  async obtenerPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const gasto = gastosPersonalesService.obtenerPorId(parseInt(id));

      if (!gasto) {
        return res.status(404).json({ success: false, error: 'Gasto personal no encontrado' });
      }

      res.json({ success: true, data: gasto });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/gastos-personales
   */
  async crear(req: Request, res: Response) {
    try {
      const data: GastoPersonalCreate = req.body;

      // Validaciones básicas
      if (!data.fecha || !data.concepto || !data.monto) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
      }

      if (data.monto <= 0) {
        return res.status(400).json({ success: false, error: 'El monto debe ser mayor a 0' });
      }

      const gasto = gastosPersonalesService.crear(data);
      res.status(201).json({
        success: true,
        message: 'Gasto personal creado correctamente',
        data: gasto,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/gastos-personales/:id
   */
  async actualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: GastoPersonalUpdate = req.body;

      const gasto = gastosPersonalesService.actualizar(parseInt(id), data);
      res.json({
        success: true,
        message: 'Gasto personal actualizado correctamente',
        data: gasto,
      });
    } catch (error: any) {
      if (error.message === 'Gasto personal no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/gastos-personales/:id
   */
  async eliminar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      gastosPersonalesService.eliminar(parseInt(id));
      res.json({
        success: true,
        message: 'Gasto personal eliminado correctamente',
      });
    } catch (error: any) {
      if (error.message === 'Gasto personal no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/gastos-personales/resumen/:mes/:anio
   */
  async obtenerResumen(req: Request, res: Response) {
    try {
      const { mes, anio } = req.params;
      const resumen = gastosPersonalesService.obtenerResumenMensual(
        parseInt(mes),
        parseInt(anio)
      );
      res.json({ success: true, data: resumen });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/gastos-personales/pendientes/:mes/:anio
   */
  async obtenerPendientes(req: Request, res: Response) {
    try {
      const { mes, anio } = req.params;
      const pendientes = gastosPersonalesService.obtenerConceptosPendientesMes(
        parseInt(mes),
        parseInt(anio)
      );
      res.json({ success: true, data: pendientes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/gastos-personales/import
   */
  async importarCSV(req: Request, res: Response) {
    try {
      const { contenido } = req.body;

      if (!contenido) {
        return res.status(400).json({ success: false, error: 'Contenido no proporcionado' });
      }

      const resultado = importarGastosPersonalesCSV(contenido);
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

export default new GastosPersonalesController();
