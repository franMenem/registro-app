import { Request, Response } from 'express';
import adelantosService from '../services/adelantos.service';
import { AdelantoCreate, AdelantoUpdate, Empleado } from '../types/adelantos.types';

/**
 * Controlador para Adelantos de Empleados
 */
export class AdelantosController {
  /**
   * GET /api/adelantos/:empleado
   */
  async obtenerPorEmpleado(req: Request, res: Response) {
    try {
      const { empleado } = req.params;

      if (empleado !== 'DAMI' && empleado !== 'MUMI') {
        return res.status(400).json({ success: false, error: 'Empleado inválido' });
      }

      const adelantos = adelantosService.obtenerTodos(empleado as Empleado);
      res.json({ success: true, data: adelantos });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/adelantos
   */
  async crear(req: Request, res: Response) {
    try {
      const data: AdelantoCreate = req.body;

      // Validaciones
      if (!data.empleado || !data.fecha_adelanto || !data.monto) {
        return res.status(400).json({ success: false, error: 'Faltan campos requeridos' });
      }

      if (data.empleado !== 'DAMI' && data.empleado !== 'MUMI') {
        return res.status(400).json({ success: false, error: 'Empleado inválido' });
      }

      if (data.monto <= 0) {
        return res.status(400).json({ success: false, error: 'El monto debe ser mayor a 0' });
      }

      const adelanto = adelantosService.crear(data);
      res.status(201).json({ success: true, data: adelanto });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/adelantos/:id/descontar
   */
  async marcarDescontado(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { fecha_descuento } = req.body;

      if (!fecha_descuento) {
        return res.status(400).json({ success: false, error: 'Falta la fecha de descuento' });
      }

      const adelanto = adelantosService.marcarComoDescontado(
        parseInt(id),
        fecha_descuento
      );
      res.json({ success: true, data: adelanto });
    } catch (error: any) {
      if (error.message === 'Adelanto no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/adelantos/:id
   */
  async actualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: AdelantoUpdate = req.body;

      const adelanto = adelantosService.actualizar(parseInt(id), data);
      res.json({ success: true, data: adelanto });
    } catch (error: any) {
      if (error.message === 'Adelanto no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/adelantos/:id
   */
  async eliminar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      adelantosService.eliminar(parseInt(id));
      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Adelanto no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/adelantos/resumen/:empleado
   */
  async obtenerResumen(req: Request, res: Response) {
    try {
      const { empleado } = req.params;

      if (empleado !== 'DAMI' && empleado !== 'MUMI') {
        return res.status(400).json({ success: false, error: 'Empleado inválido' });
      }

      const resumen = adelantosService.obtenerResumenEmpleado(empleado as Empleado);
      res.json({ success: true, data: resumen });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/adelantos/pendientes
   */
  async obtenerPendientes(req: Request, res: Response) {
    try {
      const pendientes = adelantosService.obtenerAdelantosPendientes();
      res.json({ success: true, data: pendientes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new AdelantosController();
