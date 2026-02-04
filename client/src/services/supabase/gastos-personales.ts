import { supabase } from '../../lib/supabase';

// Types
type ConceptoGP = 'Gaspar' | 'Nacion' | 'Efectivo' | 'Patagonia' | 'Credicoop' | 'TERE';

export interface GastoPersonal {
  id: number;
  fecha: string;
  concepto: ConceptoGP;
  monto: number;
  observaciones: string | null;
  estado: string;
  created_at: string;
  updated_at: string;
}

export interface GastoPersonalCreate {
  fecha: string;
  concepto: ConceptoGP;
  monto: number;
  observaciones?: string;
  estado?: string;
}

export interface ResumenGastosPersonales {
  mes: number;
  anio: number;
  total_general: number;
  gastos_por_concepto: Array<{ concepto: ConceptoGP; monto: number; pagado: boolean }>;
  pendientes: ConceptoGP[];
}

const CONCEPTOS: ConceptoGP[] = ['Gaspar', 'Nacion', 'Efectivo', 'Patagonia', 'Credicoop', 'TERE'];

export const gastosPersonalesApi = {
  /**
   * Obtener todos los gastos con filtros opcionales
   */
  getAll: async (filtros?: {
    mes?: number;
    anio?: number;
    concepto?: string;
    estado?: string;
  }): Promise<GastoPersonal[]> => {
    let query = supabase.from('gastos_personales').select('*');

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

    query = query.order('fecha', { ascending: false }).order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as GastoPersonal[];
  },

  /**
   * Obtener gasto por ID
   */
  getById: async (id: number): Promise<GastoPersonal> => {
    const { data, error } = await supabase
      .from('gastos_personales')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as GastoPersonal;
  },

  /**
   * Obtener resumen mensual
   */
  getResumen: async (mes: number, anio: number): Promise<ResumenGastosPersonales> => {
    const gastos = await gastosPersonalesApi.getAll({ mes, anio });

    // Total general
    const total_general = gastos.reduce((sum, g) => sum + Number(g.monto), 0);

    // Agrupar por concepto
    const conceptoMap = new Map<string, { concepto: ConceptoGP; monto: number; pagado: boolean }>();
    gastos.forEach((g) => {
      const existing = conceptoMap.get(g.concepto);
      if (existing) {
        existing.monto += Number(g.monto);
        if (g.estado === 'Pagado') existing.pagado = true;
      } else {
        conceptoMap.set(g.concepto, {
          concepto: g.concepto,
          monto: Number(g.monto),
          pagado: g.estado === 'Pagado',
        });
      }
    });

    const gastos_por_concepto = Array.from(conceptoMap.values());

    // Conceptos pendientes (sin ningún gasto pagado en el mes)
    const conceptosPagados = gastos
      .filter((g) => g.estado === 'Pagado')
      .map((g) => g.concepto);
    const pendientes = CONCEPTOS.filter((c) => !conceptosPagados.includes(c));

    return {
      mes,
      anio,
      total_general,
      gastos_por_concepto,
      pendientes,
    };
  },

  /**
   * Obtener conceptos pendientes del mes
   */
  getPendientes: async (mes: number, anio: number): Promise<ConceptoGP[]> => {
    const gastos = await gastosPersonalesApi.getAll({ mes, anio, estado: 'Pagado' });
    const conceptosPagados = gastos.map((g) => g.concepto);
    return CONCEPTOS.filter((c) => !conceptosPagados.includes(c));
  },

  /**
   * Crear nuevo gasto
   */
  create: async (
    gasto: GastoPersonalCreate
  ): Promise<{ message: string; data: GastoPersonal }> => {
    const { data, error } = await supabase
      .from('gastos_personales')
      .insert({
        fecha: gasto.fecha,
        concepto: gasto.concepto,
        monto: gasto.monto,
        observaciones: gasto.observaciones || null,
        estado: gasto.estado || 'Pagado',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Gasto creado correctamente', data: data as GastoPersonal };
  },

  /**
   * Actualizar gasto
   */
  update: async (
    id: number,
    datos: Partial<GastoPersonalCreate>
  ): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('gastos_personales')
      .update({
        ...datos,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Gasto actualizado correctamente' };
  },

  /**
   * Eliminar gasto
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('gastos_personales').delete().eq('id', id);

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

      // Validar concepto
      const conceptosValidos: ConceptoGP[] = ['Gaspar', 'Nacion', 'Efectivo', 'Patagonia', 'Credicoop', 'TERE'];
      if (!conceptosValidos.includes(concepto as ConceptoGP)) {
        errores.push(`Línea ${i + 1}: concepto inválido "${concepto}"`);
        continue;
      }

      const monto = parseFloat(montoStr);
      if (isNaN(monto) || monto <= 0) {
        errores.push(`Línea ${i + 1}: monto inválido "${montoStr}"`);
        continue;
      }

      try {
        await gastosPersonalesApi.create({
          fecha,
          concepto: concepto as ConceptoGP,
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
