import { Router } from 'express';
import cuentasController from '../controllers/cuentas.controller';

const router = Router();

// Cuentas corrientes
router.get('/', cuentasController.getAll.bind(cuentasController));
router.get('/:id', cuentasController.getById.bind(cuentasController));
router.get('/:id/movimientos', cuentasController.getMovimientos.bind(cuentasController));
router.post('/:id/movimientos', cuentasController.createMovimiento.bind(cuentasController));
router.post('/:id/importar', cuentasController.importarCSV.bind(cuentasController));
router.delete('/:id/limpiar', cuentasController.limpiarCuenta.bind(cuentasController));
router.put('/movimientos/:movimientoId', cuentasController.updateMovimiento.bind(cuentasController));
router.delete('/movimientos/:movimientoId', cuentasController.deleteMovimiento.bind(cuentasController));

export default router;
