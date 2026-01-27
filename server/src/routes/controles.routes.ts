import { Router } from 'express';
import controlesController from '../controllers/controles.controller';

const router = Router();

// Controles
router.get('/semanales', controlesController.getSemanales.bind(controlesController));
router.get('/quincenales', controlesController.getQuincenales.bind(controlesController));
router.get('/posnet', controlesController.getPOSNET.bind(controlesController));
router.put('/semanales/:id/pagar', controlesController.pagarSemanal.bind(controlesController));
router.put('/quincenales/:id/pagar', controlesController.pagarQuincenal.bind(controlesController));

export default router;
