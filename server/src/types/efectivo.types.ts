export type TipoMovimientoEfectivo = 'INGRESO' | 'GASTO' | 'DEPOSITO';

export interface MovimientoEfectivo {
  id: number;
  fecha: string;
  tipo: TipoMovimientoEfectivo;
  concepto: string;
  monto: number;
  cuenta_id: number | null;
  cuenta_nombre?: string;
  observaciones: string | null;
  created_at: string;
}

export interface MovimientoEfectivoCreate {
  fecha: string;
  tipo: TipoMovimientoEfectivo;
  concepto: string;
  monto: number;
  cuenta_id?: number;
  observaciones?: string;
}

export interface ControlEfectivoConfig {
  id: number;
  saldo_inicial: number;
  updated_at: string;
}

export interface EfectivoStats {
  saldo_inicial: number;
  total_rentas: number;
  total_caja: number;
  total_gastos: number;
  total_depositos: number;
  saldo_actual: number;
}
