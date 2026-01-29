export type Empleado = 'DAMI' | 'MUMI';
export type EstadoAdelanto = 'Pendiente' | 'Descontado';
export type OrigenAdelanto = 'MANUAL' | 'CAJA';

export interface Adelanto {
  id: number;
  empleado: Empleado;
  fecha_adelanto: string;
  monto: number;
  estado: EstadoAdelanto;
  fecha_descuento: string | null;
  observaciones: string | null;
  origen: OrigenAdelanto;
  created_at: string;
}

export interface AdelantoCreate {
  empleado: Empleado;
  fecha_adelanto: string;
  monto: number;
  observaciones?: string;
  origen?: OrigenAdelanto;
}

export interface AdelantoUpdate {
  estado?: EstadoAdelanto;
  fecha_descuento?: string;
  observaciones?: string;
}

export interface ResumenAdelantosEmpleado {
  empleado: Empleado;
  pendientes_mes_actual: number;
  total_anio_actual: number;
  total_historico: number;
  adelantos_pendientes: Adelanto[];
  adelantos_descontados: Adelanto[];
}
