import { supabase } from '../../lib/supabase';

// Types
export interface EPago {
  id: number;
  fecha: string;
  monto: number;
  observaciones: string | null;
  created_at: string;
}

export interface EPagoCreate {
  fecha: string;
  monto: number;
  tipo?: string; // Legacy field, not used in Supabase
  observaciones?: string;
}

export interface EPagosResponse {
  data: EPago[];
  totales: {
    total_general: number;
  };
}

export const epagosApi = {
  /**
   * Obtener todos los ePagos con filtros opcionales
   */
  getAll: async (filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<EPagosResponse> => {
    let query = supabase.from('control_epagos').select('*');

    if (filtros?.fecha_desde) {
      query = query.gte('fecha', filtros.fecha_desde);
    }

    if (filtros?.fecha_hasta) {
      query = query.lte('fecha', filtros.fecha_hasta);
    }

    query = query.order('fecha', { ascending: false });

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    const epagos = data as EPago[];
    const total_general = epagos.reduce((sum, e) => sum + Number(e.monto), 0);

    return {
      data: epagos,
      totales: { total_general },
    };
  },

  /**
   * Crear nuevo ePago
   */
  create: async (epago: EPagoCreate): Promise<{ message: string; data: EPago }> => {
    const { data, error } = await supabase
      .from('control_epagos')
      .insert({
        fecha: epago.fecha,
        monto: epago.monto,
        observaciones: epago.observaciones || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { message: 'ePago registrado correctamente', data: data as EPago };
  },

  /**
   * Actualizar ePago existente
   */
  update: async (
    id: number,
    datos: Partial<EPagoCreate>
  ): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('control_epagos')
      .update({
        fecha: datos.fecha,
        monto: datos.monto,
        observaciones: datos.observaciones,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'ePago actualizado correctamente' };
  },

  /**
   * Eliminar ePago
   */
  delete: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('control_epagos').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'ePago eliminado correctamente' };
  },
};
