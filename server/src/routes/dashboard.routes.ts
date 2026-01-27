import { Router } from 'express';
import dashboardController from '../controllers/dashboard.controller';

const router = Router();

// Dashboard
router.get('/stats', dashboardController.getStats.bind(dashboardController));

export default router;
