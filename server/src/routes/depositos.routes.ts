import { Router } from 'express';
import depositosController from '../controllers/depositos.controller';

const router = Router();

// Rutas especiales primero (antes de :id)
router.get('/no-asociados', depositosController.getDepositosNoAsociados.bind(depositosController));
router.get('/estadisticas', depositosController.getEstadisticas.bind(depositosController));

// CRUD básico
router.get('/', depositosController.getDepositos.bind(depositosController));
router.get('/:id', depositosController.getDepositoById.bind(depositosController));
router.post('/', depositosController.crear.bind(depositosController));
router.put('/:id', depositosController.actualizar.bind(depositosController));
router.delete('/:id', depositosController.eliminar.bind(depositosController));

// Acciones específicas
router.put('/:id/liquidar', depositosController.liquidar.bind(depositosController));
router.put('/:id/a-favor', depositosController.marcarAFavor.bind(depositosController));
router.put('/:id/devolver', depositosController.devolver.bind(depositosController));
router.put('/:id/usar-saldo', depositosController.usarSaldo.bind(depositosController));
router.put('/:id/asociar-cuenta', depositosController.asociarCuenta.bind(depositosController));

export default router;
