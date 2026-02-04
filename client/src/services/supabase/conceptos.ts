import { supabase } from '../../lib/supabase';

// Types
type TipoConcepto = 'RENTAS' | 'CAJA';
type FrecuenciaPago = 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'NINGUNA';

export interface Concepto {
  id: number;
  nombre: string;
  tipo: TipoConcepto;
  frecuencia_pago: FrecuenciaPago | null;
  descripcion: string | null;
}

export const conceptosApi = {
  /**
   * Obtener todos los conceptos
   */
  getAll: async (tipo?: TipoConcepto): Promise<Concepto[]> => {
    let query = supabase.from('conceptos').select('*');

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    query = query.order('nombre');

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data as Concepto[];
  },

  /**
   * Obtener concepto por ID
   */
  getById: async (id: number): Promise<Concepto> => {
    const { data, error } = await supabase
      .from('conceptos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);
    return data as Concepto;
  },

  /**
   * Crear concepto
   */
  create: async (concepto: {
    nombre: string;
    tipo: TipoConcepto;
    frecuencia_pago?: FrecuenciaPago;
    descripcion?: string;
  }): Promise<{ message: string; data: Concepto }> => {
    const { data, error } = await supabase
      .from('conceptos')
      .insert({
        nombre: concepto.nombre,
        tipo: concepto.tipo,
        frecuencia_pago: concepto.frecuencia_pago || null,
        descripcion: concepto.descripcion || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'Concepto creado correctamente', data: data as Concepto };
  },

  /**
   * Actualizar concepto
   */
  update: async (
    id: number,
    datos: Partial<{
      nombre: string;
      tipo: TipoConcepto;
      frecuencia_pago: FrecuenciaPago;
      descripcion: string;
    }>
  ): Promise<{ message: string }> => {
    const { error } = await supabase.from('conceptos').update(datos).eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Concepto actualizado correctamente' };
  },

  /**
   * Eliminar concepto
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('conceptos').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Concepto eliminado correctamente' };
  },
};
