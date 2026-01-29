import { Router } from 'express';
import posnetDiarioController from '../controllers/posnet-diario.controller';

const router = Router();

// Obtener registros del mes
router.get('/', (req, res) => posnetDiarioController.obtenerRegistrosMes(req, res));

// Obtener resumen mensual
router.get('/resumen/:mes/:anio', (req, res) => posnetDiarioController.obtenerResumen(req, res));

// Actualizar monto ingresado al banco
router.put('/:id/banco', (req, res) => posnetDiarioController.actualizarMontoIngresado(req, res));

// Importar CSV
router.post('/import', (req, res) => posnetDiarioController.importarCSV(req, res));

export default router;
