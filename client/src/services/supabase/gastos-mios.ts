import { supabase } from '../../lib/supabase';

// Types
type Concepto =
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

type Categoria = 'GASTO' | 'INGRESO' | 'AHORRO';
type Tipo = 'FIJO' | 'VARIABLE';

export interface GastoMio {
  id: number;
  fecha: string;
  concepto: Concepto;
  monto: number;
  categoria: Categoria;
  tipo: Tipo;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumenGastosMios {
  total_mes: number;
  total_gastos: number;
  total_ingresos: number;
  total_ahorros: number;
  total_fijos: number;
  total_variables: number;
  gastos_por_concepto: Array<{
    concepto: Concepto;
    total: number;
    categoria: Categoria;
    tipo: Tipo;
  }>;
  promedio_mensual: number;
}

export const gastosMiosApi = {
  getAll: async (filtros?: {
    mes?: number;
    anio?: number;
    categoria?: Categoria;
    tipo?: Tipo;
  }): Promise<GastoMio[]> => {
    let query = supabase.from('gastos_mios').select('*');

    if (filtros?.mes && filtros?.anio) {
      // Filter by month and year using date range
      const startDate = `${filtros.anio}-${String(filtros.mes).padStart(2, '0')}-01`;
      const endDate =
        filtros.mes === 12
          ? `${filtros.anio + 1}-01-01`
          : `${filtros.anio}-${String(filtros.mes + 1).padStart(2, '0')}-01`;

      query = query.gte('fecha', startDate).lt('fecha', endDate);
    }

    if (filtros?.categoria) {
      query = query.eq('categoria', filtros.categoria);
    }

    if (filtros?.tipo) {
      query = query.eq('tipo', filtros.tipo);
    }

    query = query.order('fecha', { ascending: false }).order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as GastoMio[];
  },

  getResumen: async (mes: number, anio: number): Promise<ResumenGastosMios> => {
    // Get all gastos for the month
    const gastos = await gastosMiosApi.getAll({ mes, anio });

    // Calculate totals
    const total_ingresos = gastos
      .filter((g) => g.categoria === 'INGRESO')
      .reduce((sum, g) => sum + g.monto, 0);

    const total_gastos = gastos
      .filter((g) => g.categoria === 'GASTO')
      .reduce((sum, g) => sum + g.monto, 0);

    const total_ahorros = gastos
      .filter((g) => g.categoria === 'AHORRO')
      .reduce((sum, g) => sum + g.monto, 0);

    const total_fijos = gastos.filter((g) => g.tipo === 'FIJO').reduce((sum, g) => sum + g.monto, 0);

    const total_variables = gastos
      .filter((g) => g.tipo === 'VARIABLE')
      .reduce((sum, g) => sum + g.monto, 0);

    // Group by concepto
    const conceptoMap = new Map<
      string,
      { concepto: Concepto; total: number; categoria: Categoria; tipo: Tipo }
    >();

    gastos.forEach((g) => {
      const existing = conceptoMap.get(g.concepto);
      if (existing) {
        existing.total += g.monto;
      } else {
        conceptoMap.set(g.concepto, {
          concepto: g.concepto,
          total: g.monto,
          categoria: g.categoria,
          tipo: g.tipo,
        });
      }
    });

    const gastos_por_concepto = Array.from(conceptoMap.values());

    // Calculate balance: ingresos - gastos - ahorros
    const total_mes = total_ingresos - total_gastos - total_ahorros;

    return {
      total_mes,
      total_gastos,
      total_ingresos,
      total_ahorros,
      total_fijos,
      total_variables,
      gastos_por_concepto,
      promedio_mensual: gastos.length > 0 ? total_gastos / gastos.length : 0,
    };
  },

  create: async (gasto: {
    fecha: string;
    concepto: Concepto;
    monto: number;
    categoria: Categoria;
    tipo: Tipo;
    observaciones?: string;
  }): Promise<{ message: string; data: GastoMio }> => {
    const { data, error } = await supabase
      .from('gastos_mios')
      .insert({
        fecha: gasto.fecha,
        concepto: gasto.concepto,
        monto: gasto.monto,
        categoria: gasto.categoria,
        tipo: gasto.tipo,
        observaciones: gasto.observaciones || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Gasto creado correctamente', data: data as GastoMio };
  },

  update: async (
    id: number,
    gasto: {
      fecha?: string;
      concepto?: Concepto;
      monto?: number;
      categoria?: Categoria;
      tipo?: Tipo;
      observaciones?: string;
    }
  ): Promise<{ message: string; data: GastoMio }> => {
    const { data, error } = await supabase
      .from('gastos_mios')
      .update({
        ...gasto,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Gasto actualizado correctamente', data: data as GastoMio };
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('gastos_mios').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Gasto eliminado correctamente' };
  },
};
