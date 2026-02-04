// Supabase Services - Centralized exports

export { vepsApi, type VEP } from './veps';
export { epagosApi, type EPago } from './epagos';
export { clientesApi, type Cliente, type ClienteCreate, type ClienteConDepositos } from './clientes';
export { adelantosApi, type Adelanto, type AdelantoCreate, type AdelantoResumen } from './adelantos';
export {
  gastosRegistralesApi,
  type GastoRegistral,
  type ResumenGastosRegistrales,
} from './gastos-registrales';
export {
  gastosPersonalesApi,
  type GastoPersonal,
  type GastoPersonalCreate,
  type ResumenGastosPersonales,
} from './gastos-personales';
export { gastosMiosApi, type GastoMio, type ResumenGastosMios } from './gastos-mios';
export {
  controlEfectivoApi,
  type MovimientoEfectivo,
  type EfectivoConfig,
  type EfectivoStats,
} from './control-efectivo';
export { conceptosApi, type Concepto } from './conceptos';
export {
  cuentasApi,
  type CuentaCorriente,
  type MovimientoCC,
} from './cuentas-corrientes';
export {
  depositosApi,
  type Deposito,
  type DepositoCreate,
  type DepositoEstadisticas,
} from './depositos';
export {
  controlesApi,
  type ControlSemanal,
  type ControlQuincenal,
} from './controles';
export {
  dashboardApi,
  type DashboardStats,
  type ControlPendiente,
} from './dashboard';
export {
  movimientosApi,
  type Movimiento,
  type MovimientoCreate,
  type RentasDiarioValues,
  type CajaDiarioValues,
  type BatchResult,
  type BatchResponse,
} from './movimientos';
export {
  planillasApi,
  type DiaRentas,
  type DiaCaja,
  type PlanillaFilters,
  type UpdateResult as PlanillaUpdateResult,
} from './planillas';
export {
  formulariosApi,
  type Formulario,
  type Vencimiento,
  type FormularioCreate,
  type FormularioResumen,
  type ImportResult as FormularioImportResult,
} from './formularios';
export {
  posnetDiarioApi,
  type RegistroPosnet,
  type ResumenMensual,
  type ImportResult as PosnetImportResult,
} from './control-posnet';
export {
  reportesApi,
  type DepositoPorEstado,
  type DepositoPorCliente,
  type TopDeposito,
  type BalanceCuenta,
  type CuentaSaldoNegativo,
  type EvolucionSaldo,
  type ClienteTopDepositos,
  type ClienteSaldoActivo,
  type ResumenMensualItem,
  type ComparativaMensualItem,
  type FlujoCajaItem,
  type TopMovimiento,
} from './reportes';
export {
  adminApi,
  migracionApi,
  type CleanupResult,
  type MigracionResult,
} from './admin';
