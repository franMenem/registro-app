/**
 * Types para Gastos Mios (Gastos personales de Efi)
 */

export type ConceptoGastoMio =
  | 'Comida'
  | 'Animales'
  | 'Gas'
  | 'Electricidad'
  | 'Agua'
  | 'Expensas'
  | 'Padel'
  | 'Internet'
  | 'Streaming'
  | 'Transporte'
  | 'Salud'
  | 'Gimnasio'
  | 'Sueldo'
  | 'Otros';

export type CategoriaGastoMio = 'GASTO' | 'INGRESO' | 'AHORRO';
export type TipoGastoMio = 'FIJO' | 'VARIABLE';

export interface GastoMio {
  id: number;
  fecha: string;
  concepto: ConceptoGastoMio;
  monto: number;
  categoria: CategoriaGastoMio;
  tipo: TipoGastoMio;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface GastoMioCreate {
  fecha: string;
  concepto: ConceptoGastoMio;
  monto: number;
  categoria: CategoriaGastoMio;
  tipo: TipoGastoMio;
  observaciones?: string;
}

export interface GastoMioUpdate {
  fecha?: string;
  concepto?: ConceptoGastoMio;
  monto?: number;
  categoria?: CategoriaGastoMio;
  tipo?: TipoGastoMio;
  observaciones?: string;
}

export interface GastoMioFilters {
  mes?: number;
  anio?: number;
  concepto?: ConceptoGastoMio;
  categoria?: CategoriaGastoMio;
  tipo?: TipoGastoMio;
}

export interface ResumenGastosMios {
  total_mes: number;
  total_gastos: number;
  total_ingresos: number;
  total_ahorros: number;
  total_fijos: number;
  total_variables: number;
  gastos_por_concepto: Array<{
    concepto: ConceptoGastoMio;
    total: number;
    categoria: CategoriaGastoMio;
    tipo: TipoGastoMio;
  }>;
  promedio_mensual?: number;
}

export const CONCEPTOS_GASTOS_MIOS: ConceptoGastoMio[] = [
  'Comida',
  'Animales',
  'Gas',
  'Electricidad',
  'Agua',
  'Expensas',
  'Padel',
  'Internet',
  'Streaming',
  'Transporte',
  'Salud',
  'Gimnasio',
  'Sueldo',
  'Otros',
];
