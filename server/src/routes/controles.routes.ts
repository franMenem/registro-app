import { Router } from 'express';
import controlesController from '../controllers/controles.controller';

const router = Router();

// Controles
router.get('/semanales', controlesController.getSemanales.bind(controlesController));
router.get('/quincenales', controlesController.getQuincenales.bind(controlesController));
router.get('/posnet', controlesController.getPOSNET.bind(controlesController));
router.put('/semanales/:id/pagar', controlesController.pagarSemanal.bind(controlesController));
router.put('/quincenales/:id/pagar', controlesController.pagarQuincenal.bind(controlesController));
router.put('/semanales/:id/desmarcar-pago', controlesController.desmarcarPagoSemanal.bind(controlesController));
router.put('/quincenales/:id/desmarcar-pago', controlesController.desmarcarPagoQuincenal.bind(controlesController));
router.put('/semanales/:id/monto', controlesController.actualizarMontoSemanal.bind(controlesController));
router.put('/quincenales/:id/monto', controlesController.actualizarMontoQuincenal.bind(controlesController));
router.delete('/semanales/:id', controlesController.eliminarSemanal.bind(controlesController));
router.delete('/quincenales/:id', controlesController.eliminarQuincenal.bind(controlesController));

export default router;
