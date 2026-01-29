import { Router } from 'express';
import controllers from '../controllers/movimientos.controller';

const router = Router();

// Movimientos
router.get('/', controllers.movimientos.getAll.bind(controllers.movimientos));
router.get('/:id', controllers.movimientos.getById.bind(controllers.movimientos));
router.post('/', controllers.movimientos.create.bind(controllers.movimientos));
router.post('/rentas-diario', controllers.movimientos.createRentasDiario.bind(controllers.movimientos));
router.post('/caja-diario', controllers.movimientos.createCajaDiario.bind(controllers.movimientos));
router.post('/import', controllers.movimientos.importarCSV.bind(controllers.movimientos));
router.put('/:id', controllers.movimientos.update.bind(controllers.movimientos));
router.delete('/:id', controllers.movimientos.delete.bind(controllers.movimientos));

export default router;
