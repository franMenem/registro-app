import { Request, Response } from 'express';
import formulariosService from '../services/formularios.service';

/**
 * Controlador de Formularios
 */
export class FormulariosController {
  /**
   * Obtiene todos los formularios
   * GET /api/formularios
   */
  obtenerTodos(req: Request, res: Response) {
    try {
      const formularios = formulariosService.obtenerTodos();

      res.json({
        success: true,
        data: formularios,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener formularios',
      });
    }
  }

  /**
   * Obtiene un formulario por ID
   * GET /api/formularios/:id
   */
  obtenerPorId(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      const formulario = formulariosService.obtenerPorId(id);

      if (!formulario) {
        return res.status(404).json({ message: 'Formulario no encontrado' });
      }

      res.json({
        success: true,
        data: formulario,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener formulario',
      });
    }
  }

  /**
   * Obtiene vencimientos pendientes
   * GET /api/formularios/vencimientos/pendientes
   */
  obtenerVencimientosPendientes(req: Request, res: Response) {
    try {
      const vencimientos = formulariosService.obtenerVencimientosPendientes();

      res.json({
        success: true,
        data: vencimientos,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al obtener vencimientos',
      });
    }
  }

  /**
   * Obtiene resumen
   * GET /api/formularios/resumen
   */
  obtenerResumen(req: Request, res: Response) {
    try {
      const resumen = formulariosService.obtenerResumen();

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
   * Crea un formulario
   * POST /api/formularios
   * Body: { numero, descripcion?, monto, fecha_compra, proveedor?, vencimientos: [{ numero_vencimiento, fecha_vencimiento, monto }] }
   */
  crear(req: Request, res: Response) {
    try {
      const formulario = formulariosService.crear(req.body);

      res.status(201).json({
        success: true,
        message: 'Formulario creado correctamente',
        data: formulario,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error al crear formulario',
      });
    }
  }

  /**
   * Actualiza un formulario
   * PUT /api/formularios/:id
   */
  actualizar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      const formulario = formulariosService.actualizar(id, req.body);

      res.json({
        success: true,
        message: 'Formulario actualizado correctamente',
        data: formulario,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error al actualizar formulario',
      });
    }
  }

  /**
   * Elimina un formulario
   * DELETE /api/formularios/:id
   */
  eliminar(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        return res.status(400).json({ message: 'ID inválido' });
      }

      formulariosService.eliminar(id);

      res.json({
        success: true,
        message: 'Formulario eliminado correctamente',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error al eliminar formulario',
      });
    }
  }

  /**
   * Marca vencimientos como pagados (selección múltiple)
   * POST /api/formularios/pagar-vencimientos
   * Body: { vencimiento_ids: [1, 2, 3], fecha_pago: '2026-01-27' }
   */
  pagarVencimientos(req: Request, res: Response) {
    try {
      const { vencimiento_ids, fecha_pago } = req.body;

      if (!Array.isArray(vencimiento_ids) || vencimiento_ids.length === 0) {
        return res.status(400).json({ message: 'Debe proporcionar al menos un vencimiento' });
      }

      if (!fecha_pago) {
        return res.status(400).json({ message: 'Debe proporcionar la fecha de pago' });
      }

      const resultado = formulariosService.marcarVencimientosComoPagados(
        vencimiento_ids,
        fecha_pago
      );

      res.json({
        success: true,
        message: `${resultado.vencimientos_pagados} vencimiento(s) pagado(s) correctamente`,
        data: resultado,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error al pagar vencimientos',
      });
    }
  }

  /**
   * Importar formularios desde CSV
   * POST /api/formularios/importar
   * Body: { contenido: 'csv content...' }
   */
  importarCSV(req: Request, res: Response) {
    try {
      const { contenido } = req.body;

      if (!contenido || typeof contenido !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'Debe proporcionar el contenido del CSV',
        });
      }

      const formulariosImport = require('../services/formularios-import.service').default;
      const resultado = formulariosImport.importarFormulariosCSV(contenido);

      res.json({
        success: true,
        message: `Importación completada: ${resultado.insertados} formularios insertados`,
        insertados: resultado.insertados,
        errores: resultado.errores,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error al importar formularios',
      });
    }
  }
}

export default new FormulariosController();
