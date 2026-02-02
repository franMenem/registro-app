import { Request, Response } from 'express';
import gastosMiosService from '../services/gastos-mios.service';
import { GastoMioCreate, GastoMioUpdate } from '../types/gastos-mios.types';

export class GastosMiosController {
  /**
   * GET /api/gastos-mios
   * Obtener todos los gastos con filtros opcionales
   */
  async obtenerTodos(req: Request, res: Response) {
    try {
      const filtros = {
        mes: req.query.mes ? parseInt(req.query.mes as string) : undefined,
        anio: req.query.anio ? parseInt(req.query.anio as string) : undefined,
        concepto: req.query.concepto as any,
        tipo: req.query.tipo as any,
      };

      const gastos = gastosMiosService.obtenerTodos(filtros);

      res.json({
        success: true,
        data: gastos,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/gastos-mios/:id
   * Obtener un gasto por ID
   */
  async obtenerPorId(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const gasto = gastosMiosService.obtenerPorId(id);

      if (!gasto) {
        return res.status(404).json({
          success: false,
          message: 'Gasto no encontrado',
        });
      }

      res.json({
        success: true,
        data: gasto,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * POST /api/gastos-mios
   * Crear un nuevo gasto
   */
  async crear(req: Request, res: Response) {
    try {
      const data: GastoMioCreate = req.body;
      const gasto = gastosMiosService.crear(data);

      res.status(201).json({
        success: true,
        data: gasto,
        message: 'Gasto creado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * PUT /api/gastos-mios/:id
   * Actualizar un gasto existente
   */
  async actualizar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const data: GastoMioUpdate = req.body;

      const gasto = gastosMiosService.actualizar(id, data);

      res.json({
        success: true,
        data: gasto,
        message: 'Gasto actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * DELETE /api/gastos-mios/:id
   * Eliminar un gasto
   */
  async eliminar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      gastosMiosService.eliminar(id);

      res.json({
        success: true,
        message: 'Gasto eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/gastos-mios/resumen/:mes/:anio
   * Obtener resumen mensual
   */
  async obtenerResumenMensual(req: Request, res: Response) {
    try {
      const mes = parseInt(req.params.mes);
      const anio = parseInt(req.params.anio);

      if (mes < 1 || mes > 12) {
        return res.status(400).json({
          success: false,
          message: 'Mes inválido',
        });
      }

      const resumen = gastosMiosService.obtenerResumenMensual(mes, anio);

      res.json({
        success: true,
        data: resumen,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /api/gastos-mios/totales-anuales/:anio
   * Obtener totales anuales
   */
  async obtenerTotalesAnuales(req: Request, res: Response) {
    try {
      const anio = parseInt(req.params.anio);
      const totales = gastosMiosService.obtenerTotalesAnuales(anio);

      res.json({
        success: true,
        data: totales,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new GastosMiosController();
