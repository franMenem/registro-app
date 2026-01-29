import { Router } from 'express';
import adelantosController from '../controllers/adelantos.controller';

const router = Router();

// Obtener adelantos pendientes (para alertas)
router.get('/pendientes', (req, res) => adelantosController.obtenerPendientes(req, res));

// Obtener resumen de un empleado
router.get('/resumen/:empleado', (req, res) => adelantosController.obtenerResumen(req, res));

// Obtener adelantos de un empleado
router.get('/:empleado', (req, res) => adelantosController.obtenerPorEmpleado(req, res));

// Crear un nuevo adelanto
router.post('/', (req, res) => adelantosController.crear(req, res));

// Marcar adelanto como descontado
router.put('/:id/descontar', (req, res) => adelantosController.marcarDescontado(req, res));

// Actualizar un adelanto
router.put('/:id', (req, res) => adelantosController.actualizar(req, res));

// Eliminar un adelanto
router.delete('/:id', (req, res) => adelantosController.eliminar(req, res));

export default router;
