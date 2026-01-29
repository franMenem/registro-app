import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';

const router = Router();

// Dashboard
router.get('/stats', dashboardController.getStats.bind(dashboardController));
router.get('/controles-pendientes', dashboardController.getControlesPendientes.bind(dashboardController));
router.get('/alertas-pagos', dashboardController.getAlertasPagos.bind(dashboardController));

export default router;
