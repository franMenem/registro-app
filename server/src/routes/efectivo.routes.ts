import { Router } from 'express';
import efectivoController from '../controllers/efectivo.controller';

const router = Router();

// Configuración
router.get('/config', efectivoController.getConfig.bind(efectivoController));
router.put('/config', efectivoController.updateSaldoInicial.bind(efectivoController));

// Estadísticas
router.get('/stats', efectivoController.getStats.bind(efectivoController));

// Movimientos
router.get('/movimientos', efectivoController.getMovimientos.bind(efectivoController));
router.post('/movimientos', efectivoController.crearMovimiento.bind(efectivoController));
router.delete('/movimientos/:id', efectivoController.eliminarMovimiento.bind(efectivoController));

export default router;
