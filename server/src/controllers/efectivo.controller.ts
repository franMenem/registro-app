import { Request, Response } from 'express';
import efectivoService from '../services/efectivo.service';

export class EfectivoController {
  /**
   * GET /api/efectivo/config
   */
  async getConfig(req: Request, res: Response) {
    try {
      const config = efectivoService.getConfig();
      res.json({ data: config });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * PUT /api/efectivo/config
   */
  async updateSaldoInicial(req: Request, res: Response) {
    try {
      const { saldo_inicial } = req.body;

      if (saldo_inicial === undefined || saldo_inicial < 0) {
        return res.status(400).json({ message: 'Saldo inicial inválido' });
      }

      const config = efectivoService.updateSaldoInicial(saldo_inicial);
      res.json({ data: config, message: 'Saldo inicial actualizado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/efectivo/stats
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = efectivoService.getStats();
      res.json({ data: stats });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/efectivo/movimientos
   */
  async getMovimientos(req: Request, res: Response) {
    try {
      const movimientos = efectivoService.getMovimientos();
      res.json({ data: movimientos });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * POST /api/efectivo/movimientos
   */
  async crearMovimiento(req: Request, res: Response) {
    try {
      const { categoria, concepto_especifico, ...movimientoData } = req.body;
      const movimiento = efectivoService.crearMovimiento(
        movimientoData,
        categoria,
        concepto_especifico
      );
      res.status(201).json({
        data: movimiento,
        message: 'Movimiento de efectivo registrado correctamente'
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/efectivo/movimientos/:id
   */
  async eliminarMovimiento(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      efectivoService.eliminarMovimiento(id);
      res.json({ message: 'Movimiento eliminado correctamente' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new EfectivoController();
