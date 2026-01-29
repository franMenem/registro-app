import { Router, Request, Response } from 'express';
import db, { transaction } from '../db/database';

const router = Router();

/**
 * DELETE /api/admin/limpiar/todo
 * Limpia TODA la base de datos (excepto conceptos y cuentas corrientes)
 */
router.delete('/limpiar/todo', (req: Request, res: Response) => {
  try {
    transaction(() => {
      // Limpiar en orden correcto (respetando foreign keys)
      db.prepare('DELETE FROM movimientos_cc').run();
      db.prepare('DELETE FROM controles_semanales').run();
      db.prepare('DELETE FROM controles_quincenales').run();
      db.prepare('DELETE FROM movimientos').run();
      db.prepare('DELETE FROM control_posnet_diario').run();

      // Limpiar referencias FK antes de eliminar gastos registrales
      db.prepare('UPDATE formularios_vencimientos SET gasto_registral_id = NULL WHERE gasto_registral_id IS NOT NULL').run();
      db.prepare('DELETE FROM gastos_registrales').run();

      db.prepare('DELETE FROM gastos_personales').run();
      db.prepare('DELETE FROM adelantos_empleados').run();
      db.prepare('DELETE FROM depositos').run();
      db.prepare('UPDATE cuentas_corrientes SET saldo_actual = 0').run();
    });

    res.json({ success: true, message: 'Base de datos limpiada correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/limpiar/gastos-registrales
 * Limpia TODOS los gastos registrales
 */
router.delete('/limpiar/gastos-registrales', (req: Request, res: Response) => {
  try {
    transaction(() => {
      // Primero limpiar referencias FK en formularios_vencimientos
      db.prepare('UPDATE formularios_vencimientos SET gasto_registral_id = NULL WHERE gasto_registral_id IS NOT NULL').run();

      // Ahora eliminar gastos registrales
      const result = db.prepare('DELETE FROM gastos_registrales').run();

      res.json({
        success: true,
        message: `${result.changes} gastos registrales eliminados`
      });
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/limpiar/gastos-registrales/:mes/:anio
 * Limpia gastos registrales de un mes específico
 */
router.delete('/limpiar/gastos-registrales/:mes/:anio', (req: Request, res: Response) => {
  try {
    const { mes, anio } = req.params;
    transaction(() => {
      // Primero obtener los IDs a eliminar
      const idsAEliminar = db.prepare(`
        SELECT id FROM gastos_registrales
        WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      `).all(String(mes).padStart(2, '0'), anio) as { id: number }[];

      // Limpiar referencias FK
      if (idsAEliminar.length > 0) {
        const ids = idsAEliminar.map(r => r.id).join(',');
        db.prepare(`UPDATE formularios_vencimientos SET gasto_registral_id = NULL WHERE gasto_registral_id IN (${ids})`).run();
      }

      // Ahora eliminar gastos
      const result = db.prepare(`
        DELETE FROM gastos_registrales
        WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      `).run(String(mes).padStart(2, '0'), anio);

      res.json({
        success: true,
        message: `${result.changes} gastos registrales eliminados del mes ${mes}/${anio}`
      });
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/limpiar/gastos-personales
 * Limpia TODOS los gastos personales
 */
router.delete('/limpiar/gastos-personales', (req: Request, res: Response) => {
  try {
    transaction(() => {
      const result = db.prepare('DELETE FROM gastos_personales').run();
      res.json({
        success: true,
        message: `${result.changes} gastos personales eliminados`
      });
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/limpiar/gastos-personales/:mes/:anio
 * Limpia gastos personales de un mes específico
 */
router.delete('/limpiar/gastos-personales/:mes/:anio', (req: Request, res: Response) => {
  try {
    const { mes, anio } = req.params;
    transaction(() => {
      const result = db.prepare(`
        DELETE FROM gastos_personales
        WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      `).run(String(mes).padStart(2, '0'), anio);

      res.json({
        success: true,
        message: `${result.changes} gastos personales eliminados del mes ${mes}/${anio}`
      });
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/limpiar/movimientos
 * Limpia TODOS los movimientos (RENTAS y CAJA)
 */
router.delete('/limpiar/movimientos', (req: Request, res: Response) => {
  try {
    transaction(() => {
      db.prepare('DELETE FROM movimientos_cc').run();
      db.prepare('DELETE FROM controles_semanales').run();
      db.prepare('DELETE FROM controles_quincenales').run();
      const result = db.prepare('DELETE FROM movimientos').run();
      db.prepare('UPDATE cuentas_corrientes SET saldo_actual = 0').run();

      res.json({
        success: true,
        message: `${result.changes} movimientos eliminados`
      });
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/limpiar/posnet
 * Limpia TODOS los registros de control POSNET
 */
router.delete('/limpiar/posnet', (req: Request, res: Response) => {
  try {
    transaction(() => {
      const result = db.prepare('DELETE FROM control_posnet_diario').run();
      res.json({
        success: true,
        message: `${result.changes} registros POSNET eliminados`
      });
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
