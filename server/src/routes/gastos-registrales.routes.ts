import { Router } from 'express';
import gastosRegistralesController from '../controllers/gastos-registrales.controller';

const router = Router();

// Obtener todos los gastos (con filtros opcionales)
router.get('/', (req, res) => gastosRegistralesController.obtenerTodos(req, res));

// Obtener resumen mensual
router.get('/resumen/:mes/:anio', (req, res) =>
  gastosRegistralesController.obtenerResumen(req, res)
);

// Obtener gastos pendientes del mes
router.get('/pendientes/:mes/:anio', (req, res) =>
  gastosRegistralesController.obtenerPendientes(req, res)
);

// Obtener un gasto por ID
router.get('/:id', (req, res) => gastosRegistralesController.obtenerPorId(req, res));

// Importar CSV
router.post('/import', (req, res) => gastosRegistralesController.importarCSV(req, res));

// Crear un nuevo gasto
router.post('/', (req, res) => gastosRegistralesController.crear(req, res));

// Actualizar un gasto
router.put('/:id', (req, res) => gastosRegistralesController.actualizar(req, res));

// Eliminar un gasto
router.delete('/:id', (req, res) => gastosRegistralesController.eliminar(req, res));

export default router;
