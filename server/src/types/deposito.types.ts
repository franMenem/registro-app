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
}

export interface DepositoUpdate {
  titular?: string;
  fecha_ingreso?: string;
  monto_original?: number;
  saldo_actual?: number;
  fecha_uso?: string;
  fecha_devolucion?: string;
  estado?: EstadoDeposito;
  monto_devuelto?: number;
  observaciones?: string;
  cuenta_id?: number;
  cliente_id?: number;
}

export interface DepositoFilters {
  estado?: EstadoDeposito;
  cuenta_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
}
