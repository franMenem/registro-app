/**
 * Types para Gastos Personales de la Jefa
 * 6 conceptos: Gaspar, Nacion, Efectivo, Patagonia, Credicoop, TERE
 */

export type ConceptoGastoPersonal = 'Gaspar' | 'Nacion' | 'Efectivo' | 'Patagonia' | 'Credicoop' | 'TERE';

export type EstadoGastoPersonal = 'Pagado' | 'Pendiente';

export interface GastoPersonal {
  id: number;
  fecha: string;
  concepto: ConceptoGastoPersonal;
  monto: number;
  observaciones: string | null;
  estado: EstadoGastoPersonal;
  created_at: string;
  updated_at: string;
}

export interface GastoPersonalCreate {
  fecha: string;
  concepto: ConceptoGastoPersonal;
  monto: number;
  observaciones?: string;
  estado?: EstadoGastoPersonal;
}

export interface GastoPersonalUpdate {
  fecha?: string;
  concepto?: ConceptoGastoPersonal;
  monto?: number;
  observaciones?: string;
  estado?: EstadoGastoPersonal;
}

export interface GastoPersonalFilters {
  mes?: number;
  anio?: number;
  concepto?: ConceptoGastoPersonal;
  estado?: EstadoGastoPersonal;
}

export interface ResumenGastosPersonales {
  mes: number;
  anio: number;
  total_general: number;
  gastos_por_concepto: {
    concepto: ConceptoGastoPersonal;
    monto: number;
    pagado: boolean;
  }[];
  pendientes: ConceptoGastoPersonal[];
}
