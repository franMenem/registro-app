import { Request, Response } from 'express';
import controlSemanalService from '../services/controles-semanales.service';
import controlQuincenalService from '../services/controles-quincenales.service';
import controlPOSNETService from '../services/control-posnet.service';

export class ControlesController {
  /**
   * GET /api/controles/semanales
   */
  async getSemanales(req: Request, res: Response) {
    try {
      const filters = {
        conceptoId: req.query.concepto_id ? parseInt(req.query.concepto_id as string) : undefined,
        pagado: req.query.pagado ? req.query.pagado === 'true' : undefined,
      };

      const controles = controlSemanalService.getControles(filters);

      res.json({
        data: controles,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/controles/quincenales
   */
  async getQuincenales(req: Request, res: Response) {
    try {
      const filters = {
        conceptoId: req.query.concepto_id ? parseInt(req.query.concepto_id as string) : undefined,
        pagado: req.query.pagado ? req.query.pagado === 'true' : undefined,
      };

      const controles = controlQuincenalService.getControles(filters);

      res.json({
        data: controles,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * GET /api/controles/posnet
   */
  async getPOSNET(req: Request, res: Response) {
    try {
      const controles = controlPOSNETService.getControles();

      res.json({
        data: controles,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  /**
   * PUT /api/controles/semanales/:id/pagar
   */
  async pagarSemanal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { fecha_pago } = req.body;

      if (!fecha_pago) {
        return res.status(400).json({ message: 'fecha_pago es requerida' });
      }

      controlSemanalService.marcarComoPagado(id, fecha_pago);

      res.json({
        message: 'Control marcado como pagado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/controles/quincenales/:id/pagar
   */
  async pagarQuincenal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { fecha_pago } = req.body;

      if (!fecha_pago) {
        return res.status(400).json({ message: 'fecha_pago es requerida' });
      }

      controlQuincenalService.marcarComoPagado(id, fecha_pago);

      res.json({
        message: 'Control marcado como pagado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/controles/semanales/:id/desmarcar-pago
   */
  async desmarcarPagoSemanal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      controlSemanalService.desmarcarComoPagado(id);

      res.json({
        message: 'Control desmarcado como no pagado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/controles/quincenales/:id/desmarcar-pago
   */
  async desmarcarPagoQuincenal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      controlQuincenalService.desmarcarComoPagado(id);

      res.json({
        message: 'Control desmarcado como no pagado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/controles/semanales/:id/monto
   */
  async actualizarMontoSemanal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { monto } = req.body;

      if (monto === undefined || monto < 0) {
        return res.status(400).json({ message: 'Monto inválido' });
      }

      controlSemanalService.actualizarMonto(id, monto);

      res.json({
        message: 'Monto actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * PUT /api/controles/quincenales/:id/monto
   */
  async actualizarMontoQuincenal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { monto } = req.body;

      if (monto === undefined || monto < 0) {
        return res.status(400).json({ message: 'Monto inválido' });
      }

      controlQuincenalService.actualizarMonto(id, monto);

      res.json({
        message: 'Monto actualizado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/controles/semanales/:id
   */
  async eliminarSemanal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      controlSemanalService.eliminar(id);

      res.json({
        message: 'Control eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  /**
   * DELETE /api/controles/quincenales/:id
   */
  async eliminarQuincenal(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      controlQuincenalService.eliminar(id);

      res.json({
        message: 'Control eliminado exitosamente',
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
}

export default new ControlesController();
