import { supabase } from '../../lib/supabase';

// Types
export interface VEP {
  id: number;
  fecha: string;
  monto: number;
  observaciones: string | null;
  created_at: string;
}

export interface VEPCreate {
  fecha: string;
  monto: number;
  tipo?: string; // Legacy field, not used in Supabase
  observaciones?: string;
}

export interface VEPsResponse {
  data: VEP[];
  totales: {
    total_general: number;
  };
}

export const vepsApi = {
  /**
   * Obtener todos los VEPs con filtros opcionales
   */
  getAll: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<VEPsResponse> => {
    let query = supabase.from('control_veps').select('*');

    if (filtros?.fecha_desde) {
      query = query.gte('fecha', filtros.fecha_desde);
    }

    if (filtros?.fecha_hasta) {
      query = query.lte('fecha', filtros.fecha_hasta);
    }

    query = query.order('fecha', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const veps = data as VEP[];
    const total_general = veps.reduce((sum, v) => sum + Number(v.monto), 0);

    return {
      data: veps,
      totales: { total_general },
    };
  },

  /**
   * Crear nuevo VEP
   */
  create: async (vep: VEPCreate): Promise<{ message: string; data: VEP }> => {
    const { data, error } = await supabase
      .from('control_veps')
      .insert({
        fecha: vep.fecha,
        monto: vep.monto,
        observaciones: vep.observaciones || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'VEP registrado correctamente', data: data as VEP };
  },

  /**
   * Actualizar VEP existente
   */
  update: async (
    id: number,
    datos: Partial<VEPCreate>
  ): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('control_veps')
      .update({
        fecha: datos.fecha,
        monto: datos.monto,
        observaciones: datos.observaciones,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'VEP actualizado correctamente' };
  },

  /**
   * Eliminar VEP
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('control_veps').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'VEP eliminado correctamente' };
  },
};
