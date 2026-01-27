import { Router } from 'express';
import cuentasController from '../controllers/cuentas.controller';

const router = Router();

// Cuentas corrientes
router.get('/', cuentasController.getAll.bind(cuentasController));
router.get('/:id', cuentasController.getById.bind(cuentasController));
router.get('/:id/movimientos', cuentasController.getMovimientos.bind(cuentasController));
router.post('/:id/movimientos', cuentasController.createMovimiento.bind(cuentasController));

export default router;
