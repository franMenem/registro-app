import { Request, Response } from 'express';
import migracionService from '../services/migracion.service';

export class MigracionController {
  /**
   * POST /api/migracion/veps-epagos
   * Migra movimientos de VEP y ePagos a las tablas de control
   */
  async migrarVepsYEpagos(req: Request, res: Response) {
    try {
      const resultado = migracionService.migrarVepsYEpagos();

      const mensaje = `Migración completada: ${resultado.veps_migrados} VEPs y ${resultado.epagos_migrados} ePagos migrados`;

      res.json({
        data: resultado,
        message: mensaje,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new MigracionController();
