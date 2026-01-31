import { Router } from 'express';
import clientesController from '../controllers/clientes.controller';

const router = Router();

// Buscar clientes (autocompletado)
router.get('/buscar/:termino', (req, res) => clientesController.buscar(req, res));

// Obtener por CUIT
router.get('/cuit/:cuit', (req, res) => clientesController.obtenerPorCUIT(req, res));

// Obtener resumen de clientes
router.get('/resumen', (req, res) => clientesController.obtenerResumen(req, res));

// Obtener todos los clientes (con búsqueda opcional)
router.get('/', (req, res) => clientesController.obtenerTodos(req, res));

// Obtener un cliente por ID
router.get('/:id', (req, res) => clientesController.obtenerPorId(req, res));

// Obtener cliente con sus depósitos
router.get('/:id/depositos', (req, res) => clientesController.obtenerConDepositos(req, res));

// Crear un nuevo cliente
router.post('/', (req, res) => clientesController.crear(req, res));

// Actualizar un cliente
router.put('/:id', (req, res) => clientesController.actualizar(req, res));

// Eliminar un cliente
router.delete('/:id', (req, res) => clientesController.eliminar(req, res));

export default router;
