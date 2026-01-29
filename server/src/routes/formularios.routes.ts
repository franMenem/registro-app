import { Router } from 'express';
import formulariosController from '../controllers/formularios.controller';

const router = Router();

// Importar formularios desde CSV
router.post('/importar', (req, res) => formulariosController.importarCSV(req, res));

// Obtener vencimientos pendientes
router.get('/vencimientos/pendientes', (req, res) =>
  formulariosController.obtenerVencimientosPendientes(req, res)
);

// Obtener resumen
router.get('/resumen', (req, res) => formulariosController.obtenerResumen(req, res));

// Pagar vencimientos (selección múltiple)
router.post('/pagar-vencimientos', (req, res) =>
  formulariosController.pagarVencimientos(req, res)
);

// Obtener todos los formularios
router.get('/', (req, res) => formulariosController.obtenerTodos(req, res));

// Obtener formulario por ID
router.get('/:id', (req, res) => formulariosController.obtenerPorId(req, res));

// Crear formulario
router.post('/', (req, res) => formulariosController.crear(req, res));

// Actualizar formulario
router.put('/:id', (req, res) => formulariosController.actualizar(req, res));

// Eliminar formulario
router.delete('/:id', (req, res) => formulariosController.eliminar(req, res));

export default router;
