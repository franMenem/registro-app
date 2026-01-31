import { Router } from 'express';
import migracionController from '../controllers/migracion.controller';

const router = Router();

router.post('/veps-epagos', migracionController.migrarVepsYEpagos.bind(migracionController));

export default router;
