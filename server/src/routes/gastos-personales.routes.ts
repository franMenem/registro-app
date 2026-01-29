import { Router } from 'express';
import gastosPersonalesController from '../controllers/gastos-personales.controller';

const router = Router();

// Obtener resumen mensual
router.get('/resumen/:mes/:anio', (req, res) =>
  gastosPersonalesController.obtenerResumen(req, res)
);

// Obtener gastos pendientes del mes
router.get('/pendientes/:mes/:anio', (req, res) =>
  gastosPersonalesController.obtenerPendientes(req, res)
);

// Obtener todos los gastos (con filtros opcionales)
router.get('/', (req, res) => gastosPersonalesController.obtenerTodos(req, res));

// Obtener un gasto por ID
router.get('/:id', (req, res) => gastosPersonalesController.obtenerPorId(req, res));

// Importar CSV
router.post('/import', (req, res) => gastosPersonalesController.importarCSV(req, res));

// Crear un nuevo gasto
router.post('/', (req, res) => gastosPersonalesController.crear(req, res));

// Actualizar un gasto
router.put('/:id', (req, res) => gastosPersonalesController.actualizar(req, res));

// Eliminar un gasto
router.delete('/:id', (req, res) => gastosPersonalesController.eliminar(req, res));

export default router;
