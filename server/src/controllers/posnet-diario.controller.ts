import { Request, Response } from 'express';
import posnetDiarioService from '../services/posnet-diario.service';
import { importarCSV as importarCSVService } from '../services/control-posnet-import.service';

/**
 * Controlador de Control POSNET Diario
 */
export class PosnetDiarioController {
  /**
   * Obtiene los registros diarios del mes
   * GET /api/posnet-diario?mes=1&anio=2026
   */
  obtenerRegistrosMes(req: Request, res: Response) {
    try {
      const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1;
      const anio = parseInt(req.query.anio as string) || new Date().getFullYear();

      if (mes < 1 || mes > 12) {
        return res.status(400).json({ message: 'Mes inválido' });
      }

      const registros = posnetDiarioService.obtenerRegistrosMes(mes, anio);

      res.json({
        success: true,
        data: registros,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener registros',
      });
    }
  }

  /**
   * Actualiza el monto ingresado al banco
   * PUT /api/posnet-diario/:id/banco
   * Body: { monto_ingresado_banco: 1500.50 }
   */
  actualizarMontoIngresado(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const { monto_ingresado_banco } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      if (typeof monto_ingresado_banco !== 'number' || monto_ingresado_banco < 0) {
        return res.status(400).json({ message: 'Monto inválido' });
      }

      const registroActualizado = posnetDiarioService.actualizarMontoIngresado(
        id,
        monto_ingresado_banco
      );

      res.json({
        success: true,
        message: 'Monto ingresado actualizado correctamente',
        data: registroActualizado,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar monto',
      });
    }
  }

  /**
   * Obtiene el resumen mensual
   * GET /api/posnet-diario/resumen/:mes/:anio
   */
  obtenerResumen(req: Request, res: Response) {
    try {
      const mes = parseInt(req.params.mes);
      const anio = parseInt(req.params.anio);

      if (isNaN(mes) || mes < 1 || mes > 12) {
        return res.status(400).json({ message: 'Mes inválido' });
      }

      if (isNaN(anio)) {
        return res.status(400).json({ message: 'Año inválido' });
      }

      const resumen = posnetDiarioService.obtenerResumenMes(mes, anio);

      res.json({
        success: true,
        data: resumen,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener resumen',
      });
    }
  }

  /**
   * Importa registros desde CSV
   * POST /api/posnet-diario/import
   * Body: { contenido: "fecha;posnet_rentas;posnet_caja;monto_ingresado\n..." }
   */
  importarCSV(req: Request, res: Response) {
    try {
      const { contenido } = req.body;

      if (!contenido || typeof contenido !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Contenido del CSV no proporcionado'
        });
      }

      const resultado = importarCSVService(contenido);

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

export default new PosnetDiarioController();
