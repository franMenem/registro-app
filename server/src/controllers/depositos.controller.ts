import { Request, Response } from 'express';
import depositosService from '../services/depositos.service';
import { DepositoCreate, DepositoUpdate } from '../types/deposito.types';

export class DepositosController {
  /**
   * GET /api/depositos
   */
  async getDepositos(req: Request, res: Response) {
    try {
      const filters = {
        estado: req.query.estado as any,
        cuenta_id: req.query.cuenta_id ? parseInt(req.query.cuenta_id as string) : undefined,
        fecha_desde: req.query.fecha_desde as string,
        fecha_hasta: req.query.fecha_hasta as string,
      };

      const depositos = depositosService.getDepositos(filters);

      res.json({
        data: depositos,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/depositos/no-asociados
   */
  async getDepositosNoAsociados(req: Request, res: Response) {
    try {
      const depositos = depositosService.getDepositosNoAsociados();

      res.json({
        data: depositos,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/depositos/estadisticas
   */
  async getEstadisticas(req: Request, res: Response) {
    try {
      const stats = depositosService.getEstadisticas();

      res.json({
        data: stats,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/depositos/:id
   */
  async getDepositoById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const deposito = depositosService.getDepositoById(id);

      if (!deposito) {
        return res.status(404).json({ message: 'Depósito no encontrado' });
      }

      res.json({
        data: deposito,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * POST /api/depositos
   */
  async crear(req: Request, res: Response) {
    try {
      const data: DepositoCreate = req.body;

      // Validaciones
      if (!data.monto_original || data.monto_original <= 0) {
        return res.status(400).json({ message: 'Monto inválido' });
      }

      if (!data.fecha_ingreso) {
        return res.status(400).json({ message: 'Fecha de ingreso requerida' });
      }

      if (!data.titular) {
        return res.status(400).json({ message: 'Titular requerido' });
      }

      const deposito = depositosService.crear(data);

      res.status(201).json({
        data: deposito,
        message: 'Depósito creado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/depositos/:id
   */
  async actualizar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const data: DepositoUpdate = req.body;

      const deposito = depositosService.actualizar(id, data);

      res.json({
        data: deposito,
        message: 'Depósito actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/depositos/:id
   */
  async eliminar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      depositosService.eliminar(id);

      res.json({
        message: 'Depósito eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/depositos/:id/liquidar
   */
  async liquidar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { fecha_uso } = req.body;

      if (!fecha_uso) {
        return res.status(400).json({ message: 'Fecha de uso requerida' });
      }

      const deposito = depositosService.marcarComoLiquidado(id, fecha_uso);

      res.json({
        data: deposito,
        message: 'Depósito marcado como liquidado',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/depositos/:id/a-favor
   */
  async marcarAFavor(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { saldo_restante } = req.body;

      if (saldo_restante === undefined || saldo_restante < 0) {
        return res.status(400).json({ message: 'Saldo restante inválido' });
      }

      const deposito = depositosService.marcarComoAFavor(id, saldo_restante);

      res.json({
        data: deposito,
        message: 'Depósito marcado con saldo a favor',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/depositos/:id/devolver
   */
  async devolver(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { fecha_devolucion } = req.body;

      if (!fecha_devolucion) {
        return res.status(400).json({ message: 'Fecha de devolución requerida' });
      }

      const deposito = depositosService.marcarComoDevuelto(id, fecha_devolucion);

      res.json({
        data: deposito,
        message: 'Depósito marcado como devuelto',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/depositos/:id/usar-saldo
   */
  async usarSaldo(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { monto, tipo_uso, descripcion } = req.body;

      if (!monto || monto <= 0) {
        return res.status(400).json({ message: 'Monto inválido' });
      }

      if (!tipo_uso || !['CAJA', 'RENTAS'].includes(tipo_uso)) {
        return res.status(400).json({ message: 'Tipo de uso inválido (debe ser CAJA o RENTAS)' });
      }

      const deposito = depositosService.usarSaldo(id, monto, tipo_uso, descripcion);

      res.json({
        data: deposito,
        message: 'Saldo del depósito actualizado',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/depositos/:id/asociar-cuenta
   */
  async asociarCuenta(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { cuenta_id } = req.body;

      if (!cuenta_id) {
        return res.status(400).json({ message: 'ID de cuenta requerido' });
      }

      const deposito = depositosService.asociarACuenta(id, cuenta_id);

      res.json({
        data: deposito,
        message: 'Depósito asociado a cuenta corriente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new DepositosController();
