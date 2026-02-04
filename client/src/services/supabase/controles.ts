import { supabase } from '../../lib/supabase';

// Types
type TipoMovimiento = 'RENTAS' | 'CAJA';
type Quincena = 'PRIMERA' | 'SEGUNDA';

// -----------------------------------------------------------------------------
// Internal type for raw Supabase query response with joined conceptos
// -----------------------------------------------------------------------------
interface RawControlWithConcepto {
  id: number;
  concepto_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real: string | null;
  created_at: string;
  quincena?: Quincena;
  mes?: number;
  anio?: number;
  conceptos: { nombre: string; tipo: TipoMovimiento } | null;
}

export interface ControlSemanal {
  id: number;
  concepto_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real: string | null;
  created_at: string;
  // Joined data
  concepto_nombre?: string;
  concepto_tipo?: TipoMovimiento;
}

export interface ControlQuincenal {
  id: number;
  concepto_id: number;
  quincena: Quincena;
  mes: number;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_recaudado: number;
  fecha_pago_programada: string;
  pagado: boolean;
  fecha_pago_real: string | null;
  created_at: string;
  // Joined data
  concepto_nombre?: string;
  concepto_tipo?: TipoMovimiento;
}

export const controlesApi = {
  /**
   * Obtener controles semanales
   */
  getSemanales: async (filters?: {
    concepto_id?: number;
    pagado?: boolean;
  }): Promise<ControlSemanal[]> => {
    let query = supabase
      .from('controles_semanales')
      .select(
        `
        *,
        conceptos (nombre, tipo)
      `
      )
      .order('fecha_pago_programada', { ascending: false });

    if (filters?.concepto_id) {
      query = query.eq('concepto_id', filters.concepto_id);
    }
    if (filters?.pagado !== undefined) {
      query = query.eq('pagado', filters.pagado);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    // Transform with proper typing
    return (data || []).map((c) => {
      const raw = c as RawControlWithConcepto;
      return {
        ...raw,
        concepto_nombre: raw.conceptos?.nombre || null,
        concepto_tipo: raw.conceptos?.tipo || null,
      } as ControlSemanal;
    });
  },

  /**
   * Obtener controles quincenales
   */
  getQuincenales: async (filters?: {
    concepto_id?: number;
    pagado?: boolean;
  }): Promise<ControlQuincenal[]> => {
    let query = supabase
      .from('controles_quincenales')
      .select(
        `
        *,
        conceptos (nombre, tipo)
      `
      )
      .order('fecha_pago_programada', { ascending: false });

    if (filters?.concepto_id) {
      query = query.eq('concepto_id', filters.concepto_id);
    }
    if (filters?.pagado !== undefined) {
      query = query.eq('pagado', filters.pagado);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    // Transform with proper typing
    return (data || []).map((c) => {
      const raw = c as RawControlWithConcepto;
      return {
        ...raw,
        concepto_nombre: raw.conceptos?.nombre || null,
        concepto_tipo: raw.conceptos?.tipo || null,
      } as ControlQuincenal;
    });
  },

  /**
   * Actualizar monto de control semanal
   */
  updateMontoSemanal: async (id: number, monto: number): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('controles_semanales')
      .update({ total_recaudado: monto })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Monto actualizado correctamente' };
  },

  /**
   * Actualizar monto de control quincenal
   */
  updateMontoQuincenal: async (id: number, monto: number): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('controles_quincenales')
      .update({ total_recaudado: monto })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Monto actualizado correctamente' };
  },

  /**
   * Eliminar control semanal
   */
  deleteSemanal: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('controles_semanales').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Control semanal eliminado correctamente' };
  },

  /**
   * Eliminar control quincenal
   */
  deleteQuincenal: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase.from('controles_quincenales').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Control quincenal eliminado correctamente' };
  },

  /**
   * Marcar control semanal como pagado
   */
  pagarSemanal: async (id: number, fechaPago: string): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('controles_semanales')
      .update({
        pagado: true,
        fecha_pago_real: fechaPago,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Control semanal marcado como pagado' };
  },

  /**
   * Marcar control quincenal como pagado
   */
  pagarQuincenal: async (id: number, fechaPago: string): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('controles_quincenales')
      .update({
        pagado: true,
        fecha_pago_real: fechaPago,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Control quincenal marcado como pagado' };
  },

  /**
   * Desmarcar pago de control semanal
   */
  desmarcarPagoSemanal: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('controles_semanales')
      .update({
        pagado: false,
        fecha_pago_real: null,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Pago desmarcado correctamente' };
  },

  /**
   * Desmarcar pago de control quincenal
   */
  desmarcarPagoQuincenal: async (id: number): Promise<{ message: string }> => {
    const { error } = await supabase
      .from('controles_quincenales')
      .update({
        pagado: false,
        fecha_pago_real: null,
      })
      .eq('id', id);

    if (error) throw new Error(error.message);
    return { message: 'Pago desmarcado correctamente' };
  },
};
