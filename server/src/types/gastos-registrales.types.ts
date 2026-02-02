export type OrigenGasto = 'MANUAL' | 'CAJA' | 'FORMULARIOS';
export type EstadoGasto = 'Pagado' | 'Pendiente';

// 23 conceptos de gastos registrales
export type ConceptoGastoRegistral =
  | 'ABL'
  | 'ACARA'
  | 'ADT'
  | 'AERPA'
  | 'AFIP'
  | 'AGUA'
  | 'ALEJANDRO'
  | 'AYSA'
  | 'CARCOS'
  | 'CARGAS_SOCIALES'
  | 'CONTADOR'
  | 'CORREO'
  | 'EDESUR'
  | 'EMERGENCIAS'
  | 'EXPENSAS'
  | 'FED_PATRONAL'
  | 'FIBERTEL'
  | 'LIBRERIA'
  | 'MARIA'
  | 'OTROS'
  | 'SUELDOS'
  | 'SUPERMERCADOS'
  | 'TELEFONOS'
  | 'TOTALNET';

export interface GastoRegistral {
  id: number;
  fecha: string;
  concepto: ConceptoGastoRegistral;
  monto: number;
  observaciones: string | null;
  origen: OrigenGasto;
  estado: EstadoGasto;
  boleta1: number;
  boleta2: number;
  boleta3: number;
  boleta4: number;
  created_at: string;
}

export interface GastoRegistralCreate {
  fecha: string;
  concepto: ConceptoGastoRegistral;
  monto: number;
  observaciones?: string;
  origen?: OrigenGasto;
  estado?: EstadoGasto;
  boleta1?: number;
  boleta2?: number;
  boleta3?: number;
  boleta4?: number;
}

export interface GastoRegistralUpdate {
  fecha?: string;
  monto?: number;
  observaciones?: string;
  estado?: EstadoGasto;
  boleta1?: number;
  boleta2?: number;
  boleta3?: number;
  boleta4?: number;
}

export interface GastoRegistralFilters {
  mes?: number;
  anio?: number;
  concepto?: ConceptoGastoRegistral;
  estado?: EstadoGasto;
}

export interface ResumenMensualGR {
  mes: number;
  anio: number;
  total_gastos_fijos: number;
  adelantos_dami: number;
  adelantos_mumi: number;
  otros_gastos: number;
  total_general: number;
  gastos_por_concepto: {
    concepto: string;
    monto: number;
    pagado: boolean;
  }[];
}

// Configuración de conceptos con alertas
export interface ConfigConcepto {
  nombre: ConceptoGastoRegistral;
  requiere_alerta_mensual: boolean;
  modal_especial?: 'ABL' | 'AYSA';
}

export const CONCEPTOS_CONFIG: ConfigConcepto[] = [
  { nombre: 'ABL', requiere_alerta_mensual: true, modal_especial: 'ABL' },
  { nombre: 'ACARA', requiere_alerta_mensual: false },
  { nombre: 'ADT', requiere_alerta_mensual: true },
  { nombre: 'AERPA', requiere_alerta_mensual: true },
  { nombre: 'AFIP', requiere_alerta_mensual: true },
  { nombre: 'AGUA', requiere_alerta_mensual: true },
  { nombre: 'ALEJANDRO', requiere_alerta_mensual: true },
  { nombre: 'AYSA', requiere_alerta_mensual: true, modal_especial: 'AYSA' },
  { nombre: 'CARCOS', requiere_alerta_mensual: true },
  { nombre: 'CARGAS_SOCIALES', requiere_alerta_mensual: true },
  { nombre: 'CONTADOR', requiere_alerta_mensual: true },
  { nombre: 'CORREO', requiere_alerta_mensual: true },
  { nombre: 'EDESUR', requiere_alerta_mensual: true },
  { nombre: 'EMERGENCIAS', requiere_alerta_mensual: true },
  { nombre: 'EXPENSAS', requiere_alerta_mensual: true },
  { nombre: 'FED_PATRONAL', requiere_alerta_mensual: true },
  { nombre: 'FIBERTEL', requiere_alerta_mensual: true },
  { nombre: 'LIBRERIA', requiere_alerta_mensual: true },
  { nombre: 'OTROS', requiere_alerta_mensual: false },
  { nombre: 'SUELDOS', requiere_alerta_mensual: true },
  { nombre: 'SUPERMERCADOS', requiere_alerta_mensual: true },
  { nombre: 'TELEFONOS', requiere_alerta_mensual: true },
  { nombre: 'TOTALNET', requiere_alerta_mensual: true },
];
