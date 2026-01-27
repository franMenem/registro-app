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
  movimientos_count: number;
  alertas_pagos: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  alertas?: string[];
}
