import { Router } from 'express';
import controllers from '../controllers/movimientos.controller';

const router = Router();

// Conceptos
router.get('/', controllers.conceptos.getAll.bind(controllers.conceptos));

export default router;
