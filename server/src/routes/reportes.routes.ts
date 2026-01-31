import { Router } from 'express';
import * as reportesController from '../controllers/reportes.controller';

const router = Router();

// ==================== REPORTES DE DEPÓSITOS ====================
router.get('/depositos/periodo', reportesController.getDepositosPorPeriodo);
router.get('/depositos/estado', reportesController.getDepositosPorEstado);
router.get('/depositos/cliente', reportesController.getDepositosPorCliente);
router.get('/depositos/top', reportesController.getTopDepositos);

// ==================== REPORTES DE CUENTAS CORRIENTES ====================
router.get('/cuentas/balance', reportesController.getBalanceCuentas);
router.get('/cuentas/movimientos-periodo', reportesController.getMovimientosCuentaPorPeriodo);
router.get('/cuentas/:cuenta_id/evolucion', reportesController.getEvolucionSaldos);
router.get('/cuentas/saldo-negativo', reportesController.getCuentasConSaldoNegativo);

// ==================== REPORTES DE CLIENTES ====================
router.get('/clientes/top-depositos', reportesController.getClientesConMasDepositos);
router.get('/clientes/saldos-activos', reportesController.getClientesConSaldosActivos);

// ==================== REPORTES FINANCIEROS GENERALES ====================
router.get('/financiero/resumen-mensual', reportesController.getResumenMensual);
router.get('/financiero/comparativa-mensual', reportesController.getComparativaMensual);
router.get('/financiero/flujo-caja', reportesController.getFlujoCajaProyectado);
router.get('/financiero/top-movimientos', reportesController.getTopMovimientos);

export default router;
