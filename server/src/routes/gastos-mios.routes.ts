import { Router } from 'express';
import gastosMiosController from '../controllers/gastos-mios.controller';

const router = Router();

// GET /api/gastos-mios - Obtener todos los gastos
router.get('/', gastosMiosController.obtenerTodos.bind(gastosMiosController));

// GET /api/gastos-mios/resumen/:mes/:anio - Obtener resumen mensual
router.get(
  '/resumen/:mes/:anio',
  gastosMiosController.obtenerResumenMensual.bind(gastosMiosController)
);

// GET /api/gastos-mios/totales-anuales/:anio - Obtener totales anuales
router.get(
  '/totales-anuales/:anio',
  gastosMiosController.obtenerTotalesAnuales.bind(gastosMiosController)
);

// GET /api/gastos-mios/:id - Obtener un gasto por ID
router.get('/:id', gastosMiosController.obtenerPorId.bind(gastosMiosController));

// POST /api/gastos-mios - Crear nuevo gasto
router.post('/', gastosMiosController.crear.bind(gastosMiosController));

// PUT /api/gastos-mios/:id - Actualizar gasto
router.put('/:id', gastosMiosController.actualizar.bind(gastosMiosController));

// DELETE /api/gastos-mios/:id - Eliminar gasto
router.delete('/:id', gastosMiosController.eliminar.bind(gastosMiosController));

export default router;
