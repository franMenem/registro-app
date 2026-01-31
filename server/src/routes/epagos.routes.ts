import { Router } from 'express';
import epagosController from '../controllers/epagos.controller';

const router = Router();

router.get('/', epagosController.getAll);
router.post('/', epagosController.create);
router.put('/:id', epagosController.update);
router.delete('/:id', epagosController.delete);

export default router;
