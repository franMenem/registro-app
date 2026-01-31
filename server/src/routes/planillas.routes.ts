import { Router } from 'express';
import planillasController from '../controllers/planillas.controller';

const router = Router();

router.get('/rentas', planillasController.getRentas.bind(planillasController));
router.get('/caja', planillasController.getCaja.bind(planillasController));
router.put('/rentas/:fecha', planillasController.updateRentas.bind(planillasController));
router.put('/caja/:fecha', planillasController.updateCaja.bind(planillasController));

export default router;
