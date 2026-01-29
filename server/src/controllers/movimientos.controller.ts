import { Request, Response } from 'express';
import movimientosService from '../services/movimientos.service';
import { importarMovimientosCSV } from '../services/movimientos-import.service';
import db from '../db/database';

export class MovimientosController {
  /**
   * GET /api/movimientos
   */
  async getAll(req: Request, res: Response) {
    try {
      const filters = {
        tipo: req.query.tipo as string,
        fechaDesde: req.query.fecha_desde as string,
        fechaHasta: req.query.fecha_hasta as string,
        conceptoId: req.query.concepto_id ? parseInt(req.query.concepto_id as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      };

      const movimientos = movimientosService.getMovimientos(filters);

      res.json({
        data: movimientos,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/movimientos/:id
   */
  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const movimiento = movimientosService.getById(id);

      if (!movimiento) {
        return res.status(404).json({ message: 'Movimiento no encontrado' });
      }

      res.json({
        data: movimiento,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * POST /api/movimientos
   */
  async create(req: Request, res: Response) {
    try {
      const { fecha, tipo, cuit, concepto_id, monto, observaciones } = req.body;

      // Validaciones
      if (!fecha || !tipo || !cuit || !concepto_id || !monto) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, tipo, cuit, concepto_id, monto',
        });
      }

      if (monto <= 0) {
        return res.status(400).json({
          message: 'El monto debe ser mayor a 0',
        });
      }

      const result = await movimientosService.crear({
        fecha,
        tipo,
        cuit,
        concepto_id: parseInt(concepto_id),
        monto: parseFloat(monto),
        observaciones,
      });

      // Obtener el movimiento creado
      const movimiento = movimientosService.getById(result.movimientoId);

      res.status(201).json({
        data: movimiento,
        message: 'Movimiento creado exitosamente',
        alertas: result.alertas,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/movimientos/:id
   */
  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const datos = req.body;

      await movimientosService.actualizar(id, datos);

      const movimiento = movimientosService.getById(id);

      res.json({
        data: movimiento,
        message: 'Movimiento actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/movimientos/:id
   */
  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      await movimientosService.eliminar(id);

      res.json({
        message: 'Movimiento eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * POST /api/movimientos/rentas-diario
   */
  async createRentasDiario(req: Request, res: Response) {
    try {
      const { fecha, values, entregado } = req.body;

      if (!fecha || !values) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, values',
        });
      }

      const result = await movimientosService.crearRentasDiario(fecha, values, entregado);

      res.status(201).json({
        message: `Registro RENTAS guardado exitosamente. ${result.totalMovimientos} movimientos creados.`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * POST /api/movimientos/caja-diario
   */
  async createCajaDiario(req: Request, res: Response) {
    try {
      const { fecha, values, entregado } = req.body;

      if (!fecha || !values) {
        return res.status(400).json({
          message: 'Campos requeridos: fecha, values',
        });
      }

      const result = await movimientosService.crearCajaDiario(fecha, values, entregado);

      res.status(201).json({
        message: `Registro CAJA guardado exitosamente. ${result.totalMovimientos} movimientos creados.`,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * POST /api/movimientos/import
   * Importa movimientos desde CSV
   */
  async importarCSV(req: Request, res: Response) {
    try {
      const { contenido } = req.body;

      if (!contenido || typeof contenido !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Contenido del CSV no proporcionado'
        });
      }

      const resultado = importarMovimientosCSV(contenido);

      res.json({
        success: true,
        message: 'Importación completada',
        data: resultado,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al importar CSV',
      });
    }
  }
}

/**
 * Controlador de conceptos
 */
export class ConceptosController {
  /**
   * GET /api/conceptos
   */
  async getAll(req: Request, res: Response) {
    try {
      const tipo = req.query.tipo as string;

      let query = 'SELECT * FROM conceptos';
      const params: any[] = [];

      if (tipo) {
        query += ' WHERE tipo = ?';
        params.push(tipo);
      }

      query += ' ORDER BY nombre';

      const conceptos = db.prepare(query).all(...params);

      res.json({
        data: conceptos,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default {
  movimientos: new MovimientosController(),
  conceptos: new ConceptosController(),
};
