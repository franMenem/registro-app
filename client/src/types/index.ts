export type TipoMovimiento = 'RENTAS' | 'CAJA';
export type TipoMovimientoCC = 'INGRESO' | 'EGRESO';
export type FrecuenciaPago = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'NINGUNA';
export type Quincena = 'PRIMERA' | 'SEGUNDA';

export interface Concepto {
  id: number;
  nombre: string;
  tipo: TipoMovimiento;
  frecuencia_pago: FrecuenciaPago | null;
  descripcion?: string;
}

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  cuit: string;
  concepto_id: number;
  monto: number;
  observaciones?: string;
  created_at: string;
  concepto?: Concepto;
}

export interface MovimientoCreate {
  fecha: string;
  tipo: TipoMovimiento;
  cuit: string;
  concepto_id: number;
  monto: number;
  observaciones?: string;
}

export interface CuentaCorriente {
  id: number;
  nombre: string;
  tipo: string;
  saldo_actual: number;
}

export interface MovimientoCC {
  id: number;
  cuenta_id: number;
  fecha: string;
  tipo_movimiento: TipoMovimientoCC;
  concepto: string;
  monto: number;
  saldo_resultante: number;
  movimiento_origen_id?: number;
  created_at: string;
}

export interface ControlSemanal {
  id: number;
  concepto_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real?: string;
  created_at: string;
  concepto_nombre: string;
  concepto_tipo: TipoMovimiento;
  concepto?: Concepto;
}

export interface ControlQuincenal {
  id: number;
  concepto_id: number;
  quincena: Quincena;
  mes: number;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real?: string;
  created_at: string;
  concepto_nombre: string;
  concepto_tipo: TipoMovimiento;
  concepto?: Concepto;
}

export interface ControlPOSNET {
  id: number;
  mes: number;
  anio: number;
  total_rentas: number;
  total_caja: number;
  total_general: number;
  fecha_generacion: string;
}

export interface DashboardStats {
  total_rentas_hoy: number;
  total_caja_hoy: number;
  total_semanal_pendiente: number;
  total_quincenal_pendiente: number;
  alertas_pagos: number;
  total_arancel_mes: number;
  efectivo_en_mano: number;
}

export interface ControlPendiente {
  id: number;
  concepto_id: number;
  concepto_nombre: string;
  concepto_tipo: TipoMovimiento;
  frecuencia: 'SEMANAL' | 'QUINCENAL';
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real?: string;
  quincena?: Quincena;
  mes?: number;
  anio?: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  alertas?: string[];
}

export type EstadoDeposito = 'PENDIENTE' | 'LIQUIDADO' | 'A_FAVOR' | 'A_CUENTA' | 'DEVUELTO';
export type TipoUsoDeposito = 'CAJA' | 'RENTAS' | 'A_CUENTA' | 'DEVUELTO';

export interface Deposito {
  id: number;
  monto_original: number;
  saldo_actual: number;
  fecha_ingreso: string;
  fecha_uso: string | null;
  fecha_devolucion: string | null;
  estado: EstadoDeposito;
  tipo_uso: TipoUsoDeposito | null;
  descripcion_uso: string | null;
  monto_devuelto: number;
  titular: string;
  observaciones: string | null;
  cuenta_id: number | null;
  cuenta_nombre?: string;
  cliente_id: number | null;
  cliente_nombre?: string;
  movimiento_origen_id: number | null;
  created_at: string;
}

export interface DepositoCreate {
  monto_original: number;
  fecha_ingreso: string;
  titular: string;
  observaciones?: string;
  cuenta_id?: number;
  cliente_id?: number;
  fecha_uso?: string;
}

export interface DepositoEstadisticas {
  total: number;
  pendientes: number;
  liquidados: number;
  a_favor: number;
  a_cuenta: number;
  devueltos: number;
  saldo_total_disponible: number;
}
