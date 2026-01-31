import { Router } from 'express';
import vepsController from '../controllers/veps.controller';

const router = Router();

router.get('/', vepsController.getAll);
router.post('/', vepsController.create);
router.put('/:id', vepsController.update);
router.delete('/:id', vepsController.delete);

export default router;
