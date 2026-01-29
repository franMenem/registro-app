import { Request, Response } from 'express';
import clientesService from '../services/clientes.service';
import { ClienteCreate, ClienteUpdate } from '../types/clientes.types';

/**
 * Controlador para Clientes
 * Principio Dependency Inversion: Depende del servicio (abstracción)
 */
export class ClientesController {
  /**
   * GET /api/clientes?search=texto
   */
  async obtenerTodos(req: Request, res: Response) {
    try {
      const { search } = req.query;

      const filtros = {
        search: search as string,
      };

      const clientes = clientesService.obtenerTodos(filtros);
      res.json({ success: true, data: clientes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/clientes/:id
   */
  async obtenerPorId(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const cliente = clientesService.obtenerPorId(parseInt(id));

      if (!cliente) {
        return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
      }

      res.json({ success: true, data: cliente });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/clientes/cuit/:cuit
   */
  async obtenerPorCUIT(req: Request, res: Response) {
    try {
      const { cuit } = req.params;
      const cliente = clientesService.obtenerPorCUIT(cuit);

      if (!cliente) {
        return res.status(404).json({ success: false, error: 'Cliente no encontrado' });
      }

      res.json({ success: true, data: cliente });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/clientes/buscar/:termino
   */
  async buscar(req: Request, res: Response) {
    try {
      const { termino } = req.params;
      const clientes = clientesService.buscar(termino);
      res.json({ success: true, data: clientes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/clientes
   */
  async crear(req: Request, res: Response) {
    try {
      const data: ClienteCreate = req.body;

      // Validaciones básicas
      if (!data.cuit || !data.razon_social) {
        return res.status(400).json({ success: false, error: 'CUIT y razón social son requeridos' });
      }

      const cliente = clientesService.crear(data);
      res.status(201).json({
        success: true,
        message: 'Cliente creado correctamente',
        data: cliente,
      });
    } catch (error: any) {
      if (error.message.includes('ya existe') || error.message.includes('inválido')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/clientes/:id
   */
  async actualizar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data: ClienteUpdate = req.body;

      const cliente = clientesService.actualizar(parseInt(id), data);
      res.json({
        success: true,
        message: 'Cliente actualizado correctamente',
        data: cliente,
      });
    } catch (error: any) {
      if (error.message === 'Cliente no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message.includes('ya existe') || error.message.includes('inválido')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/clientes/:id
   */
  async eliminar(req: Request, res: Response) {
    try {
      const { id } = req.params;
      clientesService.eliminar(parseInt(id));
      res.json({
        success: true,
        message: 'Cliente eliminado correctamente',
      });
    } catch (error: any) {
      if (error.message === 'Cliente no encontrado') {
        return res.status(404).json({ success: false, error: error.message });
      }
      if (error.message.includes('tiene') && error.message.includes('movimiento')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default new ClientesController();
