import { Router } from 'express';
import cuentasCorrientesController from '../controllers/cuentas-corrientes.controller';

const router = Router();

// Obtener todas las cuentas corrientes
router.get('/', (req, res) => cuentasCorrientesController.obtenerTodas(req, res));

// Obtener una cuenta por ID
router.get('/:id', (req, res) => cuentasCorrientesController.obtenerPorId(req, res));

// Obtener resumen de una cuenta
router.get('/:id/resumen', (req, res) => cuentasCorrientesController.obtenerResumen(req, res));

// Obtener movimientos de una cuenta
router.get('/:id/movimientos', (req, res) => cuentasCorrientesController.obtenerMovimientos(req, res));

// Crear un movimiento en una cuenta
router.post('/:id/movimientos', (req, res) => cuentasCorrientesController.crearMovimiento(req, res));

// Importar movimientos desde CSV
router.post('/:id/importar', (req, res) => cuentasCorrientesController.importarCSV(req, res));

// Eliminar un movimiento
router.delete('/movimientos/:movimientoId', (req, res) =>
  cuentasCorrientesController.eliminarMovimiento(req, res)
);

export default router;
