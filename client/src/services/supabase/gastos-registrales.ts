import { supabase } from '../../lib/supabase';

// Types
export interface GastoRegistral {
  id: number;
  fecha: string;
  concepto: string;
  monto: number;
  observaciones: string | null;
  origen: string;
  estado: string;
  boleta1: number;
  boleta2: number;
  boleta3: number;
  boleta4: number;
  created_at: string;
}

export interface GastoRegistralCreate {
  fecha: string;
  concepto: string;
  monto: number;
  observaciones?: string;
  estado?: string;
  boleta1?: number;
  boleta2?: number;
  boleta3?: number;
  boleta4?: number;
}

export interface ResumenGastosRegistrales {
  mes: number;
  anio: number;
  total_gastos_fijos: number;
  adelantos_dami: number;
  adelantos_mumi: number;
  otros_gastos: number;
  total_general: number;
  gastos_por_concepto: Array<{ concepto: string; monto: number; pagado: boolean }>;
  // Additional properties used by the UI
  total_anio: number;
  gastos_anio: number;
  total_historico: number;
  gastos_historico: number;
}

export const gastosRegistralesApi = {
  /**
   * Obtener todos los gastos con filtros opcionales
   */
  getAll: async (filtros?: {
    mes?: number;
    anio?: number;
    concepto?: string;
    estado?: string;
  }): Promise<GastoRegistral[]> => {
    let query = supabase.from('gastos_registrales').select('*');

    if (filtros?.mes && filtros?.anio) {
      const startDate = `${filtros.anio}-${String(filtros.mes).padStart(2, '0')}-01`;
      const endDate =
        filtros.mes === 12
          ? `${filtros.anio + 1}-01-01`
          : `${filtros.anio}-${String(filtros.mes + 1).padStart(2, '0')}-01`;

      query = query.gte('fecha', startDate).lt('fecha', endDate);
    }

    if (filtros?.concepto) {
      query = query.eq('concepto', filtros.concepto);
    }

    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado);
    }

    query = query.order('fecha', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as GastoRegistral[];
  },

  /**
   * Obtener gasto por ID
   */
  getById: async (id: number): Promise<GastoRegistral> => {
    const { data, error } = await supabase
      .from('gastos_registrales')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as GastoRegistral;
  },

  /**
   * Obtener resumen mensual
   */
  getResumen: async (mes: number, anio: number): Promise<ResumenGastosRegistrales> => {
    // Obtener gastos del mes
    const gastos = await gastosRegistralesApi.getAll({ mes, anio, estado: 'Pagado' });

    // Agrupar por concepto
    const gastosPorConcepto = gastos.reduce(
      (acc, gasto) => {
        const existing = acc.find((g) => g.concepto === gasto.concepto);
        if (existing) {
          existing.monto += Number(gasto.monto);
        } else {
          acc.push({
            concepto: gasto.concepto,
            monto: Number(gasto.monto),
            pagado: gasto.estado === 'Pagado',
          });
        }
        return acc;
      },
      [] as Array<{ concepto: string; monto: number; pagado: boolean }>
    );

    const otrosGastos = gastos
      .filter((g) => g.concepto === 'OTROS')
      .reduce((sum, g) => sum + Number(g.monto), 0);

    const totalGastosFijos = gastos
      .filter((g) => g.concepto !== 'OTROS')
      .reduce((sum, g) => sum + Number(g.monto), 0);

    // Obtener adelantos del mes
    const startDate = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const endDate =
      mes === 12
        ? `${anio + 1}-01-01`
        : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;

    const { data: adelantos } = await supabase
      .from('adelantos_empleados')
      .select('empleado, monto')
      .gte('fecha_adelanto', startDate)
      .lt('fecha_adelanto', endDate);

    const adelantosDami = (adelantos || [])
      .filter((a) => a.empleado === 'DAMI')
      .reduce((sum, a) => sum + Number(a.monto), 0);

    const adelantosMumi = (adelantos || [])
      .filter((a) => a.empleado === 'MUMI')
      .reduce((sum, a) => sum + Number(a.monto), 0);

    // Get year totals
    const startOfYear = `${anio}-01-01`;
    const endOfYear = `${anio + 1}-01-01`;

    const { data: gastosAnio } = await supabase
      .from('gastos_registrales')
      .select('monto')
      .gte('fecha', startOfYear)
      .lt('fecha', endOfYear);

    const totalAnio = (gastosAnio || []).reduce((sum, g) => sum + Number(g.monto), 0);

    // Get historical totals
    const { data: gastosHistorico } = await supabase
      .from('gastos_registrales')
      .select('monto');

    const totalHistorico = (gastosHistorico || []).reduce((sum, g) => sum + Number(g.monto), 0);

    return {
      mes,
      anio,
      total_gastos_fijos: totalGastosFijos,
      adelantos_dami: adelantosDami,
      adelantos_mumi: adelantosMumi,
      otros_gastos: otrosGastos,
      total_general: totalGastosFijos + adelantosDami + adelantosMumi + otrosGastos,
      gastos_por_concepto: gastosPorConcepto,
      total_anio: totalAnio,
      gastos_anio: gastosAnio?.length || 0,
      total_historico: totalHistorico,
      gastos_historico: gastosHistorico?.length || 0,
    };
  },

  /**
   * Obtener conceptos pendientes del mes
   */
  getPendientes: async (mes: number, anio: number): Promise<string[]> => {
    const conceptosRequeridos = [
      'HONORARIOS',
      'MONOTRIBUTO',
      'ABL',
      'AYSA',
      'TELECENTRO',
      'METROGAS',
      'EDESUR',
    ];

    const gastos = await gastosRegistralesApi.getAll({ mes, anio, estado: 'Pagado' });
    const conceptosPagados = gastos.map((g) => g.concepto);

    return conceptosRequeridos.filter((c) => !conceptosPagados.includes(c));
  },

  /**
   * Crear nuevo gasto
   */
  create: async (
    gasto: GastoRegistralCreate
  ): Promise<{ message: string; data: GastoRegistral }> => {
    const { data, error } = await supabase
      .from('gastos_registrales')
      .insert({
        fecha: gasto.fecha,
        concepto: gasto.concepto,
        monto: gasto.monto,
        observaciones: gasto.observaciones || null,
        estado: gasto.estado || 'Pagado',
        origen: 'MANUAL',
        boleta1: gasto.boleta1 || 0,
        boleta2: gasto.boleta2 || 0,
        boleta3: gasto.boleta3 || 0,
        boleta4: gasto.boleta4 || 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Gasto registrado correctamente', data: data as GastoRegistral };
  },

  /**
   * Actualizar gasto
   */
  update: async (
    id: number,
    datos: Partial<GastoRegistralCreate>
  ): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('gastos_registrales')
      .update(datos)
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Gasto actualizado correctamente' };
  },

  /**
   * Eliminar gasto
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('gastos_registrales').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Gasto eliminado correctamente' };
  },

  /**
   * Importar gastos desde CSV
   * Formato esperado: fecha,concepto,monto,observaciones,estado
   */
  importarCSV: async (
    contenido: string
  ): Promise<{ insertados: number; errores: string[] }> => {
    const lineas = contenido.trim().split('\n');
    const errores: string[] = [];
    let insertados = 0;

    // Saltar header si existe
    const startIndex = lineas[0]?.toLowerCase().includes('fecha') ? 1 : 0;

    for (let i = startIndex; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      if (!linea) continue;

      const campos = linea.split(',').map((c) => c.trim());
      if (campos.length < 3) {
        errores.push(`Línea ${i + 1}: formato inválido`);
        continue;
      }

      const [fecha, concepto, montoStr, observaciones, estado] = campos;

      const monto = parseFloat(montoStr);
      if (isNaN(monto) || monto <= 0) {
        errores.push(`Línea ${i + 1}: monto inválido "${montoStr}"`);
        continue;
      }

      try {
        await gastosRegistralesApi.create({
          fecha,
          concepto: concepto.toUpperCase(),
          monto,
          observaciones: observaciones || undefined,
          estado: estado || 'Pagado',
        });
        insertados++;
      } catch (error) {
        errores.push(`Línea ${i + 1}: ${(error as Error).message}`);
      }
    }

    return { insertados, errores };
  },
};
